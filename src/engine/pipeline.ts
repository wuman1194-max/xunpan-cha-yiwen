import type {
  AnalysisResult,
  EmailRound,
  EngineConfig,
  ExtractedRoundData,
  FieldKey,
  HistoryResolution,
  MergedField,
  ReplyTone,
} from '../types/rfq';
import { extractRoundLocally, type ExtractionPriorContext } from './localExtractor';
import { extractRoundsWithLlm } from './llmExtractor';
import { mergeExtractedRounds, type MergedState } from './merger';
import { evaluateSheetMetalRules } from './sheetMetalRules';
import { generateEnglishReply } from './replyGenerator';

export interface PipelineOptions {
  askCustomerForHistoryFields?: Partial<Record<FieldKey, boolean>>;
  resolvedHistoryValues?: Partial<Record<FieldKey, HistoryResolution>>;
  engineConfig?: EngineConfig;
}

export interface PipelineOutput {
  result: AnalysisResult;
  mergedState: MergedState;
}

function buildResultFromExtracted(
  extractedRounds: ExtractedRoundData[],
  engineUsed: 'local' | 'llm',
  ungroundedBlockedCount: number,
  fallbackReason: string | undefined,
  askCustomerForHistoryFields: Partial<Record<FieldKey, boolean>>,
  resolvedHistoryValues: Partial<Record<FieldKey, HistoryResolution>>,
): PipelineOutput {
  const mergedState = mergeExtractedRounds(extractedRounds);
  const rulesOutput = evaluateSheetMetalRules(
    mergedState,
    askCustomerForHistoryFields,
    resolvedHistoryValues,
  );

  const totalGroundedSpans = rulesOutput.fields.reduce((sum, field) => sum + field.evidence.length, 0);

  return {
    mergedState,
    result: {
      fields: rulesOutput.fields,
      questions: rulesOutput.questions,
      skippedQuestions: rulesOutput.skippedQuestions,
      historyCheckItems: rulesOutput.historyCheckItems,
      resolvedHistoryItems: rulesOutput.resolvedHistoryItems,
      scopeWarnings: mergedState.scopeWarnings,
      readinessSummary: rulesOutput.readinessSummary,
      audit: {
        engineUsed,
        ungroundedBlockedCount,
        totalGroundedSpans,
        fallbackReason,
      },
      extractedRounds,
    },
  };
}

export function analyzeRoundsLocally(
  rounds: EmailRound[],
  askCustomerForHistoryFields: Partial<Record<FieldKey, boolean>> = {},
  fallbackReason?: string,
  resolvedHistoryValues: Partial<Record<FieldKey, HistoryResolution>> = {},
): PipelineOutput {
  const nonEmptyRounds = rounds.filter((r) => r.text.trim().length > 0);
  const extractedRounds: ExtractedRoundData[] = [];
  const priorContext: ExtractionPriorContext = {};

  for (const round of nonEmptyRounds) {
    const extracted = extractRoundLocally(round, priorContext);
    extractedRounds.push(extracted);
    if (extracted.material?.family) {
      priorContext.materialFamily = extracted.material.family;
    }
    if (extracted.quantity && extracted.quantity.values.length > 0) {
      priorContext.hasPriorQuantity = true;
    }
  }

  return buildResultFromExtracted(
    extractedRounds,
    'local',
    0,
    fallbackReason,
    askCustomerForHistoryFields,
    resolvedHistoryValues,
  );
}

export async function analyzeRounds(
  rounds: EmailRound[],
  options: PipelineOptions = {},
): Promise<PipelineOutput> {
  const askMap = options.askCustomerForHistoryFields || {};
  const resolvedMap = options.resolvedHistoryValues || {};
  const config = options.engineConfig;
  const nonEmptyRounds = rounds.filter((r) => r.text.trim().length > 0);

  if (!config || config.mode === 'local' || nonEmptyRounds.length === 0) {
    return analyzeRoundsLocally(rounds, askMap, undefined, resolvedMap);
  }

  try {
    const grounded = await extractRoundsWithLlm(nonEmptyRounds, config);
    return buildResultFromExtracted(
      grounded.rounds,
      'llm',
      grounded.ungroundedBlockedCount,
      undefined,
      askMap,
      resolvedMap,
    );
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'LLM 调用失败，已自动切回内置本地引擎';
    return analyzeRoundsLocally(
      rounds,
      askMap,
      `外部模型不可用（${reason}），已自动回退至本地规则与原句锚定引擎。`,
      resolvedMap,
    );
  }
}

export function composeReplyFromAnalysis(
  output: PipelineOutput,
  selectedQuestionIds: Set<string>,
  askCustomerForHistoryFields: Partial<Record<FieldKey, boolean>>,
  tone: ReplyTone,
  resolvedHistoryValues: Partial<Record<FieldKey, HistoryResolution>> = {},
): string {
  const selectedQuestions = output.result.questions.filter((q) => selectedQuestionIds.has(q.id));
  return generateEnglishReply(
    output.mergedState,
    selectedQuestions,
    output.result.historyCheckItems,
    askCustomerForHistoryFields as Record<string, boolean>,
    tone,
    resolvedHistoryValues,
  );
}

export function formatChineseEngineeringBrief(result: AnalysisResult): string {
  const lines: string[] = [
    '【钣金询盘工程需求单】',
    `报价状态：${result.readinessSummary.headline}`,
    '',
    '一、核实字段清单：',
  ];

  for (const field of result.fields) {
    const evidenceQuotes = field.evidence.map((e) => `"${e.quote}"`).join(' / ');
    const histTag = field.resolvedFromHistory
      ? `（旧单核对：${field.resolvedFromHistory.orderNo || '业务员查单填入'}）`
      : '';
    lines.push(
      `- ${field.title}：${field.displayValue}${histTag}${evidenceQuotes ? `（原文：${evidenceQuotes}）` : ''}`,
    );
  }

  if (result.historyCheckItems.length > 0) {
    lines.push('', '二、需业务员先查旧单核对：');
    for (const item of result.historyCheckItems) {
      lines.push(`- ${item.title}：${item.displayValue}`);
    }
  }

  if (result.questions.length > 0) {
    lines.push('', '三、下一封邮件建议追问：');
    result.questions.forEach((q, idx) => {
      lines.push(`${idx + 1}. [${q.priority}] ${q.zhQuestion}`);
    });
  }

  return lines.join('\n');
}

export function getStatusLabel(field: MergedField): string {
  switch (field.status) {
    case 'confirmed':
      return '已说清';
    case 'check_history':
      return '先翻旧单，别问客户';
    case 'pending_customer':
      return '客户待会儿发，别催';
    case 'needs_disambiguation':
      return '容易误会，要确认';
    case 'partial_detail':
      return '缺关键细节，要问';
    case 'needs_clarification':
      return '没写，必须问';
    case 'optional_missing':
      return '这次先不管';
  }
}
