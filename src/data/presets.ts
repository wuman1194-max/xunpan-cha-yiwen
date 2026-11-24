import type { PresetSample } from '../types/rfq';

export const PRESET_SAMPLES: PresetSample[] = [
  {
    id: 'stainless-bracket',
    shortTitle: '样例 1｜不锈钢支架',
    badge: '新手推荐先看',
    description: '老外想买 500 个或 2,000 个拉丝不锈钢支架，但没写具体型号，厚度说“和上次一样”，也没发图纸。',
    round1Text:
      'Please quote 500 brushed stainless steel brackets. Same thickness as last time. Could you also price 2,000?',
    round1ZhSummary: '「请报 500 个拉丝不锈钢支架的价格。厚度和上次一样。顺便也报一下 2,000 个的价格可以吗？」',
    demoRound2Text: '304 stainless, 1.5 mm for both quantities. Drawing to follow.',
    demoRound2ZhSummary: '「304 不锈钢，两个数量都按 1.5 毫米厚。图纸待会儿发。」',
  },
  {
    id: 'aluminum-enclosure',
    shortTitle: '样例 2｜铝合金外壳',
    badge: '中途改数量+工艺二选一',
    description: '老外发了图纸，但在两种表面做法间犹豫，还把原定的 300 个改成了 800 个，看系统怎么帮你确认避免搞错。',
    round1Text:
      'Hi, we need an anodized or black powder-coated aluminum bending enclosure, 2.0 mm thick, STEP file attached. Originally planned 300 pcs, actually please change it to 800 pcs for FOB Shenzhen.',
    round1ZhSummary:
      '「你好，我们需要做阳极氧化或黑色喷粉的铝折弯外壳，2.0 毫米厚，已附 STEP 3D 图。本来计划 300 个，其实请改成按 800 个报深圳离岸价。」',
    demoRound2Text:
      "Let's go with 5052-H32 aluminum, matte black powder coat (RAL 9005). Please quote 800 pcs only.",
    demoRound2ZhSummary: '「就按 5052-H32 铝合金，哑光黑喷粉（色号 RAL 9005）。请只报 800 个的价格。」',
  },
  {
    id: 'mild-steel-plate',
    shortTitle: '样例 3｜碳钢安装板',
    badge: '缺太多项·自动挑重点',
    description: '这封邮件同时缺型号、缺厚度、缺数量、缺防锈做法和正式图纸，看系统怎么只挑最关键的 3 个问题去问。',
    round1Text:
      'Dear team, could you quote our mild steel mounting plate with tight bending tolerance? Please send your best price soon, target lead time 2 weeks. No drawing ready yet, we have a rough sketch.',
    round1ZhSummary:
      '「你们好，能给我们这个要求严格折弯精度的碳钢安装板报个价吗？希望两周交货。正式图纸还没好，我们只有一张手绘草图。」',
    demoRound2Text:
      'Quantity is 1,000 pcs, SPCC 2.0 mm, zinc plated. Tolerance is ±0.2 mm on overall dimensions, PDF sketch attached.',
    demoRound2ZhSummary:
      '「数量 1,000 个，用 SPCC 冷轧钢 2.0 毫米厚，镀锌防锈。整体尺寸误差要求 ±0.2 毫米，PDF 图纸已附在附件里。」',
  },
];
