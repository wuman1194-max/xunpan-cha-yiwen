import type { BenchmarkCase } from '../types/rfq';
import { PRESET_SAMPLES } from './presets';

export const BENCHMARK_CASES: BenchmarkCase[] = [
  {
    id: 'case-01-ss-r1',
    title: '01｜不锈钢支架首轮（两档+旧单板厚+缺牌号缺图）',
    category: '核心演示',
    rounds: [
      { id: 'round-1', roundNumber: 1, label: '客户首封英文询盘', text: PRESET_SAMPLES[0].round1Text },
    ],
    expected: {
      mustAskFields: ['material', 'drawing'],
      forbiddenAskFields: ['thickness', 'quantity', 'surfaceFinish'],
      forbiddenConfirmedTokens: ['304', '1.5 mm'],
      expectedStatusByField: {
        quantity: 'confirmed',
        thickness: 'check_history',
        surfaceFinish: 'confirmed',
        material: 'partial_detail',
        drawing: 'needs_clarification',
      },
      expectedNotesSummary: '分档识别 500/2,000，板厚转查旧单，仅追问牌号与图纸。',
    },
  },
  {
    id: 'case-02-ss-r2',
    title: '02｜不锈钢支架两轮闭环（Drawing to follow 不催图）',
    category: '多轮追踪',
    rounds: [
      { id: 'round-1', roundNumber: 1, label: '客户首封英文询盘', text: PRESET_SAMPLES[0].round1Text },
      { id: 'round-2', roundNumber: 2, label: '客户第 2 轮补充回复', text: PRESET_SAMPLES[0].demoRound2Text },
    ],
    expected: {
      mustAskFields: [],
      forbiddenAskFields: ['material', 'thickness', 'quantity', 'drawing', 'surfaceFinish'],
      forbiddenConfirmedTokens: [],
      expectedStatusByField: {
        material: 'confirmed',
        thickness: 'confirmed',
        quantity: 'confirmed',
        drawing: 'pending_customer',
        surfaceFinish: 'confirmed',
      },
      expectedNotesSummary: '更新 304 与 1.5 mm，保留两档数量，图纸标为客户待发，追问清零。',
    },
  },
  {
    id: 'case-03-al-r2',
    title: '03｜铝合金外壳两轮（5052-H32 + 改单 800 only + RAL 9005）',
    category: '多轮追踪',
    rounds: [
      { id: 'round-1', roundNumber: 1, label: '客户首封英文询盘', text: PRESET_SAMPLES[1].round1Text },
      { id: 'round-2', roundNumber: 2, label: '客户第 2 轮补充回复', text: PRESET_SAMPLES[1].demoRound2Text },
    ],
    expected: {
      mustAskFields: [],
      forbiddenAskFields: ['material', 'thickness', 'quantity', 'drawing', 'surfaceFinish'],
      forbiddenConfirmedTokens: [],
      expectedStatusByField: {
        material: 'confirmed',
        surfaceFinish: 'confirmed',
        quantity: 'confirmed',
        drawing: 'confirmed',
        deliveryTerms: 'confirmed',
      },
      expectedNotesSummary: '解决二选一工艺与 300→800 改单，锁定 5052-H32 与 FOB Shenzhen。',
    },
  },
  {
    id: 'case-04-carbon-r1',
    title: '04｜碳钢安装板多项缺失（P0>P1 严格截断至 ≤3 问）',
    category: '优先级收敛',
    rounds: [
      { id: 'round-1', roundNumber: 1, label: '客户首封英文询盘', text: PRESET_SAMPLES[2].round1Text },
    ],
    expected: {
      mustAskFields: ['material', 'thickness', 'quantity'],
      forbiddenAskFields: ['deliveryTerms', 'partType'],
      forbiddenConfirmedTokens: ['SPCC', '2.0 mm', '1,000'],
      expectedStatusByField: {
        material: 'partial_detail',
        thickness: 'needs_clarification',
        quantity: 'needs_clarification',
        drawing: 'needs_clarification',
        surfaceFinish: 'needs_clarification',
        toleranceAndFeatures: 'needs_clarification',
      },
      expectedNotesSummary: '6 项待确认中优先截取前 3 项 P0 问法，绝不超限塞满回信。',
    },
  },
  {
    id: 'case-05-repeat-order',
    title: '05｜全单引用历史订单（Repeat order, same as last time）',
    category: '查旧单分流',
    rounds: [
      {
        id: 'round-1',
        roundNumber: 1,
        label: '客户首封英文询盘',
        text: 'Hi, repeat order for 1,000 brackets, same as last time.',
      },
    ],
    expected: {
      mustAskFields: [],
      forbiddenAskFields: ['material', 'thickness', 'quantity', 'drawing', 'surfaceFinish'],
      forbiddenConfirmedTokens: ['304', '5052', '1.5 mm', '2.0 mm'],
      expectedStatusByField: {
        quantity: 'confirmed',
        material: 'check_history',
        thickness: 'check_history',
        surfaceFinish: 'check_history',
        drawing: 'check_history',
      },
      expectedNotesSummary: '数量锁定 1,000 件，材质/板厚/表面/图纸均转内部核对旧单，0 项盲目打扰客户。',
    },
  },
  {
    id: 'case-06-3tier-gauge',
    title: '06｜3 档分档询价 + 16 Gauge 英制板厚换算参考',
    category: '规格扩展',
    rounds: [
      {
        id: 'round-1',
        roundNumber: 1,
        label: '客户首封英文询盘',
        text: 'Please quote 100, 500, and 2,000 pcs of 16 gauge 304 stainless panels, brushed finish, STEP attached.',
      },
    ],
    expected: {
      mustAskFields: [],
      forbiddenAskFields: ['material', 'thickness', 'quantity', 'drawing', 'surfaceFinish'],
      forbiddenConfirmedTokens: [],
      expectedStatusByField: {
        quantity: 'confirmed',
        thickness: 'confirmed',
        material: 'confirmed',
        surfaceFinish: 'confirmed',
        drawing: 'confirmed',
      },
      expectedNotesSummary: '完整抓取 100 / 500 / 2,000 三档数量，保持 16 Gauge 原文显示并附不锈钢 ≈1.59 mm 工程提示。',
    },
  },
  {
    id: 'case-07-sgcc-pem',
    title: '07｜SGCC 预镀锌板 + PEM 压铆件（不误问碳钢防锈）',
    category: '材料成型专业性',
    rounds: [
      {
        id: 'round-1',
        roundNumber: 1,
        label: '客户首封英文询盘',
        text: 'Need 600 pcs SGCC 1.5 mm chassis with PEM nuts, DXF attached, FOB Ningbo.',
      },
    ],
    expected: {
      mustAskFields: [],
      forbiddenAskFields: ['material', 'thickness', 'quantity', 'drawing', 'surfaceFinish'],
      forbiddenConfirmedTokens: [],
      expectedStatusByField: {
        material: 'confirmed',
        thickness: 'confirmed',
        quantity: 'confirmed',
        drawing: 'confirmed',
        surfaceFinish: 'optional_missing',
        deliveryTerms: 'confirmed',
      },
      expectedNotesSummary: '识别 SGCC 为预镀锌板，不误触碳钢防锈 P1 追问，同时提取 PEM 压铆特征与 FOB Ningbo。',
    },
  },
  {
    id: 'case-08-brass-cross-round-tier',
    title: '08｜黄铜弹片跨轮补牌号与加报分档（C260, also price 1,500）',
    category: '跨轮增量合并',
    rounds: [
      {
        id: 'round-1',
        roundNumber: 1,
        label: '客户首封英文询盘',
        text: 'Quote 300 brass clips, 0.8 mm, drawing attached.',
      },
      {
        id: 'round-2',
        roundNumber: 2,
        label: '客户第 2 轮补充回复',
        text: 'C260, also price 1,500.',
      },
    ],
    expected: {
      mustAskFields: [],
      forbiddenAskFields: ['material', 'thickness', 'quantity', 'drawing'],
      forbiddenConfirmedTokens: [],
      expectedStatusByField: {
        material: 'confirmed',
        thickness: 'confirmed',
        quantity: 'confirmed',
        drawing: 'confirmed',
      },
      expectedNotesSummary: '第 2 轮锁定黄铜牌号 C260，并将 1,500 与第 1 轮 300 合并为两档分档询价。',
    },
  },
  {
    id: 'case-09-6061-powder-nocolor',
    title: '09｜6061-T6 折弯裂纹风险提示 + 喷粉缺色号追问',
    category: '材料成型专业性',
    rounds: [
      {
        id: 'round-1',
        roundNumber: 1,
        label: '客户首封英文询盘',
        text: 'Please quote 400 pcs 6061-T6 aluminum covers, 2.0 mm, powder coated, STEP attached.',
      },
    ],
    expected: {
      mustAskFields: ['surfaceFinish'],
      forbiddenAskFields: ['material', 'thickness', 'quantity', 'drawing'],
      forbiddenConfirmedTokens: ['RAL 9005', 'black'],
      expectedStatusByField: {
        material: 'confirmed',
        thickness: 'confirmed',
        quantity: 'confirmed',
        drawing: 'confirmed',
        surfaceFinish: 'partial_detail',
      },
      expectedNotesSummary: '给出 6061-T6 折弯裂纹核对提醒，并精准追问喷粉颜色/RAL 色号与光泽度。',
    },
  },
  {
    id: 'case-10-multipart-bom-boundary',
    title: '10｜【已知边界/失败案例】单封邮件混写两款不同零件 BOM',
    category: '已知边界记录',
    isKnownBoundaryCase: true,
    boundaryNote:
      '首版定位单件折弯澄清：当前会触发“多款不同零件”边界警告，但单件合并器会将 304/5052 与 1.5mm/2.0mm 合并覆盖；此案例已作为真实失败案例留存，供计划书说明 V2 多件拆单演进方向。',
    rounds: [
      {
        id: 'round-1',
        roundNumber: 1,
        label: '客户首封英文询盘',
        text: 'Please quote 200 pcs of 304 stainless brackets (1.5 mm) and 500 pcs of 5052 aluminum covers (2.0 mm), drawings attached.',
      },
    ],
    expected: {
      mustAskFields: [],
      forbiddenAskFields: [],
      forbiddenConfirmedTokens: [],
      expectedNotesSummary: '触发多零件拆单警告，但单件需求卡无法同时呈现两套独立 BOM 规格。',
    },
  },
];
