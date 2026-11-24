import { BENCHMARK_CASES } from '../data/benchmarkCases';
import { analyzeRoundsLocally, composeReplyFromAnalysis } from './pipeline';
import type { BenchmarkCaseResult, BenchmarkReport, FieldKey } from '../types/rfq';

export function runBenchmarkSuite(): BenchmarkReport {
  const results: BenchmarkCaseResult[] = [];
  let passedTargetCases = 0;
  let targetSinglePartCases = 0;
  let knownBoundaryCount = 0;
  let totalMissedQuestions = 0;
  let totalRepeatedQuestions = 0;
  let totalHallucinations = 0;

  for (const bc of BENCHMARK_CASES) {
    const out = analyzeRoundsLocally(bc.rounds, {});
    const { fields, questions, scopeWarnings } = out.result;
    const selectedSet = new Set(questions.filter((q) => q.defaultSelected).map((q) => q.id));
    const reply = composeReplyFromAnalysis(out, selectedSet, {}, 'concise');
    const ackParagraph = reply.split('\n\n')[1] || reply;

    const actualAskedFields = questions.map((q) => q.fieldKey);
    const missedQuestions: FieldKey[] = bc.expected.mustAskFields.filter(
      (fk) => !actualAskedFields.includes(fk),
    );
    const repeatedQuestions: FieldKey[] = bc.expected.forbiddenAskFields.filter((fk) =>
      actualAskedFields.includes(fk),
    );

    const hallucinations: string[] = [];
    for (const token of bc.expected.forbiddenConfirmedTokens) {
      const confirmedValues = fields
        .filter((f) => f.status === 'confirmed')
        .map((f) => f.displayValue)
        .join(' ');
      if (confirmedValues.includes(token) || ackParagraph.includes(token)) {
        hallucinations.push(token);
      }
    }

    const statusMismatches: string[] = [];
    if (bc.expected.expectedStatusByField) {
      for (const [key, expStatus] of Object.entries(bc.expected.expectedStatusByField)) {
        const found = fields.find((f) => f.key === key);
        if (!found || found.status !== expStatus) {
          statusMismatches.push(`${key}: 期望 ${expStatus}，实际 ${found?.status || 'missing'}`);
        }
      }
    }

    if (bc.isKnownBoundaryCase) {
      knownBoundaryCount += 1;
      const hasMultiPartWarning = scopeWarnings.some((w) => w.includes('多款不同零件'));
      results.push({
        caseId: bc.id,
        title: bc.title,
        category: bc.category,
        passed: false,
        isKnownBoundaryCase: true,
        boundaryNote: bc.boundaryNote,
        missedQuestions,
        repeatedQuestions,
        hallucinations,
        statusMismatches: hasMultiPartWarning
          ? ['已触发多零件警告，但单件模型合并了两套规格（已知边界）']
          : ['未触发多零件边界警告'],
        actualAskedFields,
        summaryNote: bc.boundaryNote || bc.expected.expectedNotesSummary || '',
        rounds: bc.rounds,
      });
      continue;
    }

    targetSinglePartCases += 1;
    const passed =
      missedQuestions.length === 0 &&
      repeatedQuestions.length === 0 &&
      hallucinations.length === 0 &&
      statusMismatches.length === 0 &&
      questions.length <= 3;

    if (passed) passedTargetCases += 1;
    totalMissedQuestions += missedQuestions.length;
    totalRepeatedQuestions += repeatedQuestions.length;
    totalHallucinations += hallucinations.length;

    results.push({
      caseId: bc.id,
      title: bc.title,
      category: bc.category,
      passed,
      isKnownBoundaryCase: false,
      missedQuestions,
      repeatedQuestions,
      hallucinations,
      statusMismatches,
      actualAskedFields,
      summaryNote: bc.expected.expectedNotesSummary || '',
      rounds: bc.rounds,
    });
  }

  return {
    totalCases: BENCHMARK_CASES.length,
    targetSinglePartCases,
    passedTargetCases,
    knownBoundaryCount,
    totalMissedQuestions,
    totalRepeatedQuestions,
    totalHallucinations,
    results,
  };
}

export function formatBenchmarkMarkdown(report: BenchmarkReport): string {
  const lines: string[] = [
    '# 「询盘差一问」10 封扩展样例实测报告',
    '',
    `- 单件钣金目标样例通过率：**${report.passedTargetCases} / ${report.targetSinglePartCases}**（另有 ${report.knownBoundaryCount} 个诚实记录的多件边界失败案例）`,
    `- 漏问次数：**${report.totalMissedQuestions}**`,
    `- 重复追问次数：**${report.totalRepeatedQuestions}**`,
    `- 擅自补值（幻觉）次数：**${report.totalHallucinations}**`,
    '',
    '| 编号与场景 | 类别 | 结果 | 实际追问字段 | 说明 |',
    '| :--- | :--- | :--- | :--- | :--- |',
  ];

  for (const r of report.results) {
    const statusText = r.isKnownBoundaryCase ? '⚠️ 已知边界' : r.passed ? '✅ 通过' : '❌ 异常';
    const asked = r.actualAskedFields.length > 0 ? r.actualAskedFields.join(', ') : '无（已闭环/仅查旧单）';
    lines.push(`| ${r.title} | ${r.category} | ${statusText} | \`${asked}\` | ${r.summaryNote} |`);
  }

  return lines.join('\n');
}
