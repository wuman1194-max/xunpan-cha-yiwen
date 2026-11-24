import { describe, expect, it } from 'vitest';
import { PRESET_SAMPLES } from '../data/presets';
import { BENCHMARK_CASES } from '../data/benchmarkCases';
import { DEMO_FACTORY_ORDERS, FACTORY_ORDER_CSV_TEMPLATE } from '../data/demoFactoryOrders';
import { analyzeRoundsLocally, composeReplyFromAnalysis } from '../engine/pipeline';
import { validateAndGroundLlmOutput } from '../engine/groundingValidator';
import { formatBenchmarkMarkdown, runBenchmarkSuite } from '../engine/evaluator';
import { translateReplyToChinese, translateRfqRoundToChinese } from '../engine/localTranslator';
import { matchHistoryOrders, parseCsvText, rowsToFactoryOrders } from '../engine/historyOrderStore';
import type { EmailRound, HistoryResolution } from '../types/rfq';

function fieldByKey(fields: ReturnType<typeof analyzeRoundsLocally>['result']['fields'], key: string) {
  const found = fields.find((f) => f.key === key);
  if (!found) throw new Error(`Missing field: ${key}`);
  return found;
}

function makeSelectedSet(out: ReturnType<typeof analyzeRoundsLocally>) {
  return new Set(out.result.questions.filter((q) => q.defaultSelected).map((q) => q.id));
}

describe('询盘差一问 核心引擎与规则测试', () => {
  it('样例 1 第 1 轮：识别两档询价、拉丝、历史板厚（查旧单）、缺牌号与缺图纸', () => {
    const p1 = PRESET_SAMPLES[0];
    const rounds: EmailRound[] = [{ id: 'round-1', roundNumber: 1, label: 'R1', text: p1.round1Text }];
    const out = analyzeRoundsLocally(rounds);
    const { fields, questions, historyCheckItems, skippedQuestions } = out.result;

    // Quantities: 500 & 2,000 two-tier
    const qty = fieldByKey(fields, 'quantity');
    expect(qty.status).toBe('confirmed');
    expect(qty.displayValue).toContain('500');
    expect(qty.displayValue).toContain('2,000');
    expect(qty.displayValue).toContain('分档');

    // Surface finish: brushed
    const finish = fieldByKey(fields, 'surfaceFinish');
    expect(finish.status).toBe('confirmed');
    expect(finish.displayValue).toContain('拉丝');

    // Material: stainless steel, grade missing -> partial_detail (no hallucinated 304!)
    const material = fieldByKey(fields, 'material');
    expect(material.status).toBe('partial_detail');
    expect(material.displayValue).toContain('未指定');
    expect(material.displayValue).not.toContain('304');

    // Thickness: check_history -> internal check box, NOT asked to customer
    const thickness = fieldByKey(fields, 'thickness');
    expect(thickness.status).toBe('check_history');
    expect(thickness.displayValue).toContain('引用上次订单');
    expect(historyCheckItems.map((h) => h.key)).toContain('thickness');
    expect(questions.some((q) => q.fieldKey === 'thickness')).toBe(false);

    // Drawing: missing -> P0 blocker
    const drawing = fieldByKey(fields, 'drawing');
    expect(drawing.status).toBe('needs_clarification');

    // Must-ask questions <= 3 and include material + drawing
    expect(questions.length).toBeLessThanOrEqual(3);
    expect(questions.map((q) => q.fieldKey)).toEqual(['material', 'drawing']);
    expect(skippedQuestions.some((s) => s.fieldKey === 'thickness')).toBe(true);

    // Reply mentions checking previous order, asks grade & drawing, and never assumes 304 or 1.5 mm in confirmed specs
    const reply = composeReplyFromAnalysis(out, makeSelectedSet(out), {}, 'concise');
    const ackParagraph = reply.split('\n\n')[1];
    expect(ackParagraph).toContain('500 and 2,000 pcs');
    expect(ackParagraph).toContain('brushed stainless steel brackets');
    expect(ackParagraph).toContain('previous order records');
    expect(ackParagraph).not.toMatch(/\b304\b/);
    expect(ackParagraph).not.toContain('1.5 mm');
    expect(reply).toContain('stainless steel grade');
    expect(reply).toContain('drawing');
  });

  it('样例 1 第 2 轮：更新 304 与 1.5 mm，保留两档数量与拉丝，图纸更新为客户待发且不再催问', () => {
    const p1 = PRESET_SAMPLES[0];
    const rounds: EmailRound[] = [
      { id: 'round-1', roundNumber: 1, label: 'R1', text: p1.round1Text },
      { id: 'round-2', roundNumber: 2, label: 'R2', text: p1.demoRound2Text },
    ];
    const out = analyzeRoundsLocally(rounds);
    const { fields, questions, historyCheckItems, readinessSummary } = out.result;

    const material = fieldByKey(fields, 'material');
    expect(material.status).toBe('confirmed');
    expect(material.displayValue).toContain('304');
    expect(material.updatedInRound).toBe(2);

    const thickness = fieldByKey(fields, 'thickness');
    expect(thickness.status).toBe('confirmed');
    expect(thickness.displayValue).toBe('1.5 mm');
    expect(thickness.updatedInRound).toBe(2);
    expect(historyCheckItems).toHaveLength(0);

    const qty = fieldByKey(fields, 'quantity');
    expect(qty.status).toBe('confirmed');
    expect(qty.displayValue).toContain('500');
    expect(qty.displayValue).toContain('2,000');

    const finish = fieldByKey(fields, 'surfaceFinish');
    expect(finish.status).toBe('confirmed');
    expect(finish.displayValue).toContain('拉丝');

    const drawing = fieldByKey(fields, 'drawing');
    expect(drawing.status).toBe('pending_customer');
    expect(drawing.displayValue).toContain('客户待发');

    expect(questions).toHaveLength(0);
    expect(readinessSummary.level).toBe('waiting_drawing');

    const reply = composeReplyFromAnalysis(out, makeSelectedSet(out), {}, 'concise');
    expect(reply).toContain('304');
    expect(reply).toContain('1.5 mm');
    expect(reply).toContain('500 and 2,000 pcs');
    expect(reply).toContain('as soon as your drawing arrives');
  });

  it('评委改字测试 1：把 stainless 改为 316L brushed stainless steel，立即消除牌号追问', () => {
    const rounds: EmailRound[] = [
      {
        id: 'round-1',
        roundNumber: 1,
        label: 'R1',
        text: 'Please quote 500 316L brushed stainless steel brackets. Same thickness as last time. Could you also price 2,000?',
      },
    ];
    const out = analyzeRoundsLocally(rounds);
    const material = fieldByKey(out.result.fields, 'material');
    expect(material.status).toBe('confirmed');
    expect(material.displayValue).toContain('316L');
    expect(out.result.questions.some((q) => q.fieldKey === 'material')).toBe(false);
    const qty = fieldByKey(out.result.fields, 'quantity');
    expect(qty.displayValue).toContain('500 / 2,000');
  });

  it('评委改字测试 2：删除 Same thickness as last time. 后，板厚立即成为 P0 必问项', () => {
    const rounds: EmailRound[] = [
      {
        id: 'round-1',
        roundNumber: 1,
        label: 'R1',
        text: 'Please quote 500 brushed stainless steel brackets. Could you also price 2,000?',
      },
    ];
    const out = analyzeRoundsLocally(rounds);
    const thickness = fieldByKey(out.result.fields, 'thickness');
    expect(thickness.status).toBe('needs_clarification');
    expect(out.result.questions.some((q) => q.fieldKey === 'thickness')).toBe(true);
  });

  it('评委改字测试 3：把 Could you also price 2,000? 改为改单语句，数量状态识别为改单消歧', () => {
    const rounds: EmailRound[] = [
      {
        id: 'round-1',
        roundNumber: 1,
        label: 'R1',
        text: 'Please quote 500 brushed stainless steel brackets. Same thickness as last time. Actually please change it to 2,000 instead.',
      },
    ];
    const out = analyzeRoundsLocally(rounds);
    const qty = fieldByKey(out.result.fields, 'quantity');
    expect(qty.status).toBe('needs_disambiguation');
    expect(qty.displayValue).toContain('疑似改单');
    expect(out.result.questions.some((q) => q.fieldKey === 'quantity')).toBe(true);
  });

  it('评委改字测试 4：补充 STEP file attached. 后，图纸状态变成已核实并移出追问', () => {
    const rounds: EmailRound[] = [
      {
        id: 'round-1',
        roundNumber: 1,
        label: 'R1',
        text: 'Please quote 500 brushed stainless steel brackets. Same thickness as last time. Could you also price 2,000? STEP file attached.',
      },
    ];
    const out = analyzeRoundsLocally(rounds);
    const drawing = fieldByKey(out.result.fields, 'drawing');
    expect(drawing.status).toBe('confirmed');
    expect(drawing.displayValue).toContain('STEP');
    expect(out.result.questions.some((q) => q.fieldKey === 'drawing')).toBe(false);
  });

  it('业务员开关：勾选“查不到旧单，改为向客户追问”后，板厚进入追问清单与回信', () => {
    const p1 = PRESET_SAMPLES[0];
    const rounds: EmailRound[] = [{ id: 'round-1', roundNumber: 1, label: 'R1', text: p1.round1Text }];
    const out = analyzeRoundsLocally(rounds, { thickness: true });
    expect(out.result.questions.some((q) => q.fieldKey === 'thickness')).toBe(true);
    const reply = composeReplyFromAnalysis(out, makeSelectedSet(out), { thickness: true }, 'concise');
    expect(reply).toContain('previous order record');
    expect(reply).toContain('thickness');
  });

  it('样例 2（铝合金外壳）两轮：识别 5052/6061 风险、二选一表面处理与 300→800 改单并在第 2 轮闭环', () => {
    const p2 = PRESET_SAMPLES[1];
    const r1Out = analyzeRoundsLocally([{ id: 'round-1', roundNumber: 1, label: 'R1', text: p2.round1Text }]);
    expect(fieldByKey(r1Out.result.fields, 'material').engineeringNote).toContain('5052-H32');
    expect(fieldByKey(r1Out.result.fields, 'surfaceFinish').status).toBe('needs_disambiguation');
    expect(fieldByKey(r1Out.result.fields, 'quantity').status).toBe('needs_disambiguation');
    expect(fieldByKey(r1Out.result.fields, 'drawing').status).toBe('confirmed');
    expect(fieldByKey(r1Out.result.fields, 'deliveryTerms').displayValue).toBe('FOB Shenzhen');

    const r2Out = analyzeRoundsLocally([
      { id: 'round-1', roundNumber: 1, label: 'R1', text: p2.round1Text },
      { id: 'round-2', roundNumber: 2, label: 'R2', text: p2.demoRound2Text },
    ]);
    expect(fieldByKey(r2Out.result.fields, 'material').displayValue).toContain('5052-H32');
    expect(fieldByKey(r2Out.result.fields, 'surfaceFinish').displayValue).toContain('RAL 9005');
    expect(fieldByKey(r2Out.result.fields, 'quantity').displayValue).toContain('800');
    expect(r2Out.result.questions).toHaveLength(0);
    expect(r2Out.result.readinessSummary.level).toBe('ready');
  });

  it('样例 3（碳钢安装板）第 1 轮多项阻塞严格截断至 ≤ 3 问，第 2 轮全部闭环', () => {
    const p3 = PRESET_SAMPLES[2];
    const r1Out = analyzeRoundsLocally([{ id: 'round-1', roundNumber: 1, label: 'R1', text: p3.round1Text }]);
    expect(r1Out.result.questions.length).toBe(3);
    expect(fieldByKey(r1Out.result.fields, 'surfaceFinish').status).toBe('needs_clarification');
    expect(fieldByKey(r1Out.result.fields, 'toleranceAndFeatures').status).toBe('needs_clarification');
    const r1Reply = composeReplyFromAnalysis(r1Out, makeSelectedSet(r1Out), {}, 'concise');
    expect(r1Reply).not.toContain('for of');

    const r2Out = analyzeRoundsLocally([
      { id: 'round-1', roundNumber: 1, label: 'R1', text: p3.round1Text },
      { id: 'round-2', roundNumber: 2, label: 'R2', text: p3.demoRound2Text },
    ]);
    expect(fieldByKey(r2Out.result.fields, 'material').displayValue).toContain('SPCC');
    expect(fieldByKey(r2Out.result.fields, 'thickness').displayValue).toBe('2.0 mm');
    expect(fieldByKey(r2Out.result.fields, 'quantity').displayValue).toContain('1,000');
    expect(fieldByKey(r2Out.result.fields, 'surfaceFinish').displayValue).toContain('镀锌');
    expect(fieldByKey(r2Out.result.fields, 'toleranceAndFeatures').displayValue).toContain('±0.2 mm');
    expect(fieldByKey(r2Out.result.fields, 'drawing').status).toBe('confirmed');
    expect(r2Out.result.questions).toHaveLength(0);
  });

  it('非数量数字隔离：304、5052、1.5 mm、RAL 9005、2 weeks 绝不会被误识别为采购数量', () => {
    const rounds: EmailRound[] = [
      {
        id: 'round-1',
        roundNumber: 1,
        label: 'R1',
        text: 'Need 304 stainless mounting plate, 1.5 mm thick, powder coated RAL 9005, lead time 2 weeks.',
      },
    ];
    const out = analyzeRoundsLocally(rounds);
    const qty = fieldByKey(out.result.fields, 'quantity');
    expect(qty.status).toBe('needs_clarification');
    expect(qty.displayValue).toBe('未写明采购数量');
  });

  it('所有抽取证据的 start/end 索引都能精确切出原文 quote', () => {
    for (const preset of PRESET_SAMPLES) {
      const rounds: EmailRound[] = [
        { id: 'round-1', roundNumber: 1, label: 'R1', text: preset.round1Text },
        { id: 'round-2', roundNumber: 2, label: 'R2', text: preset.demoRound2Text },
      ];
      const out = analyzeRoundsLocally(rounds);
      for (const field of out.result.fields) {
        for (const ev of field.evidence) {
          const targetRound = rounds.find((r) => r.id === ev.roundId);
          expect(targetRound).toBeDefined();
          expect(targetRound!.text.slice(ev.start, ev.end)).toBe(ev.quote);
        }
      }
    }
  });

  it('防幻觉校验器：模型擅自输出原文不存在的 304 与 1.5 mm 时必须拦截并计入拦截数', () => {
    const rounds: EmailRound[] = [
      {
        id: 'round-1',
        roundNumber: 1,
        label: 'R1',
        text: 'Please quote 500 brushed stainless steel brackets.',
      },
    ];
    const fakeHallucinatedLlm = {
      rounds: [
        {
          roundNumber: 1,
          material: {
            family: 'stainless steel',
            zhFamily: '不锈钢',
            grade: '304',
            quotes: ['stainless steel'],
          },
          thickness: {
            valueDisplay: '1.5 mm',
            quotes: ['brackets'],
          },
          quantity: {
            values: [500],
            mode: 'single',
            quotes: ['500'],
          },
        },
      ],
    };

    const validated = validateAndGroundLlmOutput(rounds, fakeHallucinatedLlm);
    expect(validated.ungroundedBlockedCount).toBeGreaterThanOrEqual(2);
    expect(validated.rounds[0].material?.grade).toBeUndefined();
    expect(validated.rounds[0].thickness?.valueDisplay).toBeUndefined();
    expect(validated.rounds[0].quantity?.values).toEqual([500]);
  });

  it('第 2 轮极简牌号识别：Make it 304, 1.5 mm. 自动承接第 1 轮不锈钢且不把 304 误当数量', () => {
    const rounds: EmailRound[] = [
      { id: 'round-1', roundNumber: 1, label: 'R1', text: 'Please quote 500 brushed stainless steel brackets.' },
      { id: 'round-2', roundNumber: 2, label: 'R2', text: 'Make it 304, 1.5 mm.' },
    ];
    const out = analyzeRoundsLocally(rounds);
    expect(fieldByKey(out.result.fields, 'material').displayValue).toContain('304');
    expect(fieldByKey(out.result.fields, 'thickness').displayValue).toBe('1.5 mm');
    expect(fieldByKey(out.result.fields, 'quantity').displayValue).toContain('500');
  });

  it('3 档分档询价 + 16 Gauge 板厚参考：保留 16 Gauge 原文并输出 3 档数量到回信', () => {
    const rounds: EmailRound[] = [
      {
        id: 'round-1',
        roundNumber: 1,
        label: 'R1',
        text: 'Please quote 100, 500, and 2,000 pcs of 16 gauge 304 stainless panels, brushed finish, STEP attached.',
      },
    ];
    const out = analyzeRoundsLocally(rounds);
    const qty = fieldByKey(out.result.fields, 'quantity');
    expect(qty.displayValue).toContain('3 档分档询价');
    expect(qty.displayValue).toContain('100 / 500 / 2,000');

    const thickness = fieldByKey(out.result.fields, 'thickness');
    expect(thickness.displayValue).toBe('16 Gauge');
    expect(thickness.engineeringNote).toContain('1.59 mm');

    const reply = composeReplyFromAnalysis(out, makeSelectedSet(out), {}, 'concise');
    expect(reply).toContain('100, 500, and 2,000 pcs');
  });

  it('通用历史订单引用（same as last time）自动转入内部核对旧单，不打扰客户', () => {
    const rounds: EmailRound[] = [
      { id: 'round-1', roundNumber: 1, label: 'R1', text: 'Hi, repeat order for 1,000 brackets, same as last time.' },
    ];
    const out = analyzeRoundsLocally(rounds);
    expect(fieldByKey(out.result.fields, 'quantity').status).toBe('confirmed');
    expect(fieldByKey(out.result.fields, 'material').status).toBe('check_history');
    expect(fieldByKey(out.result.fields, 'thickness').status).toBe('check_history');
    expect(fieldByKey(out.result.fields, 'drawing').status).toBe('check_history');
    expect(out.result.questions).toHaveLength(0);
    expect(out.result.historyCheckItems.length).toBeGreaterThanOrEqual(3);
  });

  it('跨轮增量加档 + 黄铜专属规则 + SGCC 预镀锌板不误问碳钢防锈', () => {
    const brassOut = analyzeRoundsLocally([
      { id: 'round-1', roundNumber: 1, label: 'R1', text: 'Quote 300 brass clips, 0.8 mm, drawing attached.' },
      { id: 'round-2', roundNumber: 2, label: 'R2', text: 'C260, also price 1,500.' },
    ]);
    expect(fieldByKey(brassOut.result.fields, 'material').displayValue).toContain('C260');
    expect(fieldByKey(brassOut.result.fields, 'quantity').displayValue).toContain('300 / 1,500');

    const sgccOut = analyzeRoundsLocally([
      {
        id: 'round-1',
        roundNumber: 1,
        label: 'R1',
        text: 'Need 600 pcs SGCC 1.5 mm chassis with PEM nuts, DXF attached, FOB Ningbo.',
      },
    ]);
    expect(fieldByKey(sgccOut.result.fields, 'surfaceFinish').status).toBe('optional_missing');
    expect(sgccOut.result.questions).toHaveLength(0);
  });

  it('10 封多样化实时评测套件：9/9 单件目标案例全通过且 0 漏问/0 重复/0 脑补，Case 10 记录为多件边界案例', () => {
    const report = runBenchmarkSuite();
    expect(report.totalCases).toBe(10);
    expect(report.targetSinglePartCases).toBe(9);
    expect(report.passedTargetCases).toBe(9);
    expect(report.knownBoundaryCount).toBe(1);
    expect(report.totalMissedQuestions).toBe(0);
    expect(report.totalRepeatedQuestions).toBe(0);
    expect(report.totalHallucinations).toBe(0);

    const md = formatBenchmarkMarkdown(report);
    expect(md).toContain('9 / 9');
    expect(md).toContain('已知边界');
  });

  it('实时英文询盘中文翻译：改字、自定义询盘与全量 10 例都能实时产出自然中文大意', () => {
    const p1Orig = translateRfqRoundToChinese(PRESET_SAMPLES[0].round1Text);
    expect(p1Orig).toContain('500 个');
    expect(p1Orig).toContain('拉丝不锈钢支架');
    expect(p1Orig).toContain('厚度和上次一样');
    expect(p1Orig).toContain('2,000 个');

    // Mutation 1: + 316L
    const p1Mut316 = translateRfqRoundToChinese(
      'Please quote 500 316L brushed stainless steel brackets. Same thickness as last time. Could you also price 2,000?',
    );
    expect(p1Mut316).toContain('316L');
    expect(p1Mut316).toContain('拉丝不锈钢支架');

    // Mutation 2: remove Same thickness as last time
    const p1NoHist = translateRfqRoundToChinese(
      'Please quote 500 brushed stainless steel brackets. Could you also price 2,000?',
    );
    expect(p1NoHist).not.toContain('上次一样');

    // Mutation 3: revision to 2,000
    const p1Rev = translateRfqRoundToChinese(
      'Please quote 500 brushed stainless steel brackets. Same thickness as last time. Actually please change it to 2,000 instead.',
    );
    expect(p1Rev).toContain('改为 2,000');

    // Freeform custom RFQ
    const customZh = translateRfqRoundToChinese(
      'Need 800 5052 aluminum covers, 2.0 mm thick, black anodized. Drawing attached.',
    );
    expect(customZh).toContain('800 个');
    expect(customZh).toContain('5052 铝合金盖板');
    expect(customZh).toContain('2.0 毫米厚');
    expect(customZh).toContain('黑色阳极氧化');
    expect(customZh).toContain('已附图纸');

    // All 10 benchmark cases translate cleanly with zero placeholder fallback
    for (const bc of BENCHMARK_CASES) {
      for (const r of bc.rounds) {
        const zh = translateRfqRoundToChinese(r.text);
        expect(zh.length).toBeGreaterThan(5);
        expect(zh).not.toContain('你已修改英文原句');
      }
    }
  });

  it('英文回信实时中文对照：第 1 轮追问回信与第 2 轮等待图纸回信均准确翻译为中文', () => {
    const p1 = PRESET_SAMPLES[0];
    const r1Out = analyzeRoundsLocally([{ id: 'round-1', roundNumber: 1, label: 'R1', text: p1.round1Text }]);
    const r1Reply = composeReplyFromAnalysis(r1Out, makeSelectedSet(r1Out), {}, 'concise');
    const r1ReplyZh = translateReplyToChinese(r1Reply);
    expect(r1ReplyZh).toContain('500 和 2,000 个');
    expect(r1ReplyZh).toContain('板厚');
    expect(r1ReplyZh).toContain('不锈钢具体需要哪个牌号');

    const r2Out = analyzeRoundsLocally([
      { id: 'round-1', roundNumber: 1, label: 'R1', text: p1.round1Text },
      { id: 'round-2', roundNumber: 2, label: 'R2', text: p1.demoRound2Text },
    ]);
    const r2Reply = composeReplyFromAnalysis(r2Out, makeSelectedSet(r2Out), {}, 'polite');
    const r2ReplyZh = translateReplyToChinese(r2Reply);
    expect(r2ReplyZh).toContain('尊敬的客户');
    expect(r2ReplyZh).toContain('304 不锈钢');
    expect(r2ReplyZh).toContain('1.5 毫米');
    expect(r2ReplyZh).toContain('图纸发来后');
  });

  it('工厂旧单 CSV 解析（支持 UTF-8 BOM、中文/英文表头与带引号逗号）', () => {
    const templateRows = parseCsvText(FACTORY_ORDER_CSV_TEMPLATE);
    const parsed = rowsToFactoryOrders(templateRows);
    expect(parsed.orders).toHaveLength(3);
    expect(parsed.orders[0].orderNo).toBe('PO-2025-0812');
    expect(parsed.orders[0].thickness).toBe('1.5 mm');
    expect(parsed.orders[0].notes).toContain('500/2,000');

    const englishCsv = 'PO#,Customer,Part Name,Material,Thickness,Finish\nPO-999,Acme,Cover,5052,2.0 mm,Anodized';
    const enParsed = rowsToFactoryOrders(parseCsvText(englishCsv));
    expect(enParsed.orders).toHaveLength(1);
    expect(enParsed.orders[0].orderNo).toBe('PO-999');
    expect(enParsed.orders[0].thickness).toBe('2.0 mm');
  });

  it('工厂旧单智能匹配 + 方案 A 确认带入 + 方案 B 手填确认 + 全单复购带入', () => {
    const p1 = PRESET_SAMPLES[0];
    const baseOut = analyzeRoundsLocally([{ id: 'round-1', roundNumber: 1, label: 'R1', text: p1.round1Text }]);

    // Smart matching surfaces PO-2025-0812 at top
    const matches = matchHistoryOrders(DEMO_FACTORY_ORDERS, baseOut.mergedState, p1.round1Text);
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0].order.orderNo).toBe('PO-2025-0812');

    // Scheme A: Confirm PO-2025-0812 thickness 1.5 mm
    const resolvedA: Partial<Record<'thickness', HistoryResolution>> = {
      thickness: {
        value: '1.5 mm',
        source: 'imported_order',
        orderNo: 'PO-2025-0812',
      },
    };
    const outA = analyzeRoundsLocally(
      [{ id: 'round-1', roundNumber: 1, label: 'R1', text: p1.round1Text }],
      {},
      undefined,
      resolvedA,
    );
    expect(fieldByKey(outA.result.fields, 'thickness').status).toBe('confirmed');
    expect(fieldByKey(outA.result.fields, 'thickness').displayValue).toBe('1.5 mm');
    expect(outA.result.historyCheckItems).toHaveLength(0);
    expect(outA.result.resolvedHistoryItems).toHaveLength(1);

    const replyA = composeReplyFromAnalysis(outA, makeSelectedSet(outA), {}, 'concise', resolvedA);
    expect(replyA).toContain('Per our previous order record (PO-2025-0812), the sheet thickness was 1.5 mm');
    expect(replyA).not.toContain('We are checking our previous order records');
    const replyAZh = translateReplyToChinese(replyA);
    expect(replyAZh).toContain('PO-2025-0812');
    expect(replyAZh).toContain('1.5 毫米');

    // Scheme B: Manual input 1.8 mm without PO
    const resolvedB: Partial<Record<'thickness', HistoryResolution>> = {
      thickness: { value: '1.8 mm', source: 'manual_input' },
    };
    const outB = analyzeRoundsLocally(
      [{ id: 'round-1', roundNumber: 1, label: 'R1', text: p1.round1Text }],
      {},
      undefined,
      resolvedB,
    );
    expect(fieldByKey(outB.result.fields, 'thickness').displayValue).toBe('1.8 mm');
    const replyB = composeReplyFromAnalysis(outB, makeSelectedSet(outB), {}, 'concise', resolvedB);
    expect(replyB).toContain('Per our previous order record, the sheet thickness was 1.8 mm');

    // Multi-field resolution on repeat order ("same as last time")
    const repeatRounds: EmailRound[] = [
      { id: 'round-1', roundNumber: 1, label: 'R1', text: 'Hi, repeat order for 1,000 brackets, same as last time.' },
    ];
    const resolvedAll: Partial<Record<'material' | 'thickness' | 'surfaceFinish' | 'drawing', HistoryResolution>> = {
      material: { value: '304 stainless steel', source: 'imported_order', orderNo: 'PO-2025-0812' },
      thickness: { value: '1.5 mm', source: 'imported_order', orderNo: 'PO-2025-0812' },
      surfaceFinish: { value: '拉丝 (brushed)', source: 'imported_order', orderNo: 'PO-2025-0812' },
      drawing: { value: 'BRK-304-RevB.step', source: 'imported_order', orderNo: 'PO-2025-0812' },
    };
    const repeatOut = analyzeRoundsLocally(repeatRounds, {}, undefined, resolvedAll);
    expect(repeatOut.result.historyCheckItems).toHaveLength(0);
    expect(repeatOut.result.resolvedHistoryItems).toHaveLength(4);
    const repeatReply = composeReplyFromAnalysis(repeatOut, makeSelectedSet(repeatOut), {}, 'concise', resolvedAll);
    expect(repeatReply).toContain('PO-2025-0812:');
    expect(repeatReply).toContain('remain unchanged for this quote');
    expect(translateReplyToChinese(repeatReply)).toContain('全部沿用原规格不变');
  });

  it('纯英文回信防中文混入校验 + FOB 港口翻译无重复括号', () => {
    // 1. Every preset (R1 and R1+R2) and every benchmark case must emit 100% pure English reply (no Chinese leak!)
    for (const preset of PRESET_SAMPLES) {
      const r1Out = analyzeRoundsLocally([{ id: 'round-1', roundNumber: 1, label: 'R1', text: preset.round1Text }]);
      const r1Reply = composeReplyFromAnalysis(r1Out, makeSelectedSet(r1Out), {}, 'concise');
      expect(r1Reply).not.toMatch(/[\u4e00-\u9fa5]/);

      const r2Out = analyzeRoundsLocally([
        { id: 'round-1', roundNumber: 1, label: 'R1', text: preset.round1Text },
        { id: 'round-2', roundNumber: 2, label: 'R2', text: preset.demoRound2Text },
      ]);
      const r2Reply = composeReplyFromAnalysis(r2Out, makeSelectedSet(r2Out), {}, 'polite');
      expect(r2Reply).not.toMatch(/[\u4e00-\u9fa5]/);
    }

    for (const bc of BENCHMARK_CASES) {
      const out = analyzeRoundsLocally(bc.rounds);
      const reply = composeReplyFromAnalysis(out, makeSelectedSet(out), {}, 'concise');
      expect(reply).not.toMatch(/[\u4e00-\u9fa5]/);
    }

    // 2. FOB Shenzhen translates once without nested double parens
    const p2Zh = translateRfqRoundToChinese(PRESET_SAMPLES[1].round1Text);
    expect(p2Zh).toContain('深圳离岸价（FOB Shenzhen）');
    expect(p2Zh).not.toContain('（（');
    expect((p2Zh.match(/FOB Shenzhen/g) || []).length).toBe(1);
  });
});
