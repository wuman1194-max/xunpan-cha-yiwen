import type { FieldKey } from '../types/rfq';

export interface SheetMetalRuleDefinition {
  key: FieldKey;
  title: string;
  englishTitle: string;
  defaultPriority: 'P0' | 'P1' | 'P2';
  whyItMatters: string;
  askCondition: string;
  skipCondition: string;
  antiHallucinationRule: string;
}

export const SHEET_METAL_RULES_CATALOG: SheetMetalRuleDefinition[] = [
  {
    key: 'material',
    title: '材料与具体牌号',
    englishTitle: 'Material & Grade',
    defaultPriority: 'P0',
    whyItMatters:
      '单价与折弯成型性直接取决于牌号：不锈钢 304 与 316L/201 料价差明显；铝合金 5052-H32 折弯韧性好，而 6061-T6 锐角折弯极易开裂；普通碳钢涉及防锈选材（SPCC/SGCC/Q235）。',
    askCondition: '未提材料大类，或仅写了“stainless steel / aluminum / mild steel”而未明确具体牌号。',
    skipCondition: '已写出明确牌号（如 304、316L、5052-H32、SPCC），或客户明确引用旧单（先内部核对）。',
    antiHallucinationRule: '严禁把“stainless steel”自动补成 304，或把“aluminum”自动补成 5052；未写牌号只能标为“未指定”。',
  },
  {
    key: 'thickness',
    title: '板材厚度',
    englishTitle: 'Sheet Thickness',
    defaultPriority: 'P0',
    whyItMatters:
      '板厚决定激光切割功率与工时、折弯吨位及下模 V 槽宽度（通常取 6t–8t），也直接影响最小内折弯半径与翻边最小高度。',
    askCondition: '全文未提及毫米/英寸/Gauge 规格，且未引用历史订单。',
    skipCondition: '已有明确板厚（如 1.5 mm、16 gauge），或写明“Same thickness as last time”（转入业务员先查旧单）。',
    antiHallucinationRule: '严禁默认填入 1.5 mm 或 2.0 mm 等常用板厚；历史引用不得擅自翻译为具体数字。',
  },
  {
    key: 'quantity',
    title: '采购数量 / 分档逻辑',
    englishTitle: 'Quantity & Price Breaks',
    defaultPriority: 'P0',
    whyItMatters:
      '数量决定激光排版套料利用率、模具/折弯机调机摊销成本及表面处理起订费（如喷粉最低收费）。分档询价需分开报阶梯价，改单则只按最终数量报价。',
    askCondition: '未提数量，或邮件同时出现多个数字且上下文是改单还是分档不清楚。',
    skipCondition: '明确单档数量，或明确为分档询价（如 500 + also price 2,000），或第 2 轮已确认沿用两档。',
    antiHallucinationRule: '严禁把材料牌号（304/5052）、板厚（1.5 mm）、RAL 色号或交期数字误识别为数量。',
  },
  {
    key: 'drawing',
    title: '工程图纸 / 3D 模型',
    englishTitle: 'CAD / Engineering Drawing',
    defaultPriority: 'P0',
    whyItMatters:
      '钣金展开面积、折弯道数、K 因子补偿、孔边到折弯边最小距离、压铆螺母及焊接特征全部依赖 2D/3D 图纸，缺图只能粗估或无法算准折弯工时。',
    askCondition: '完全未提及图纸，或仅有口头草图（rough sketch）且未附正式尺寸图。',
    skipCondition: '已附图纸（STEP/DXF/DWG/PDF），或客户明确说明“Drawing to follow”（标为客户待发，不再反复催问）。',
    antiHallucinationRule: '客户说“Drawing to follow”时只能标记为“客户待发”，不可当成已收图，也不可重复发问索要。',
  },
  {
    key: 'surfaceFinish',
    title: '表面处理 / 防锈要求',
    englishTitle: 'Surface Finish',
    defaultPriority: 'P1',
    whyItMatters:
      '表面处理（拉丝、阳极氧化、喷粉、镀锌）往往占小件报价 15%–35%，碳钢裸板不说明表面处理还存在生锈与外观验收风险；不同工序对表面保护膜和折弯划痕控制要求也不同。',
    askCondition: '在两种工艺间犹豫（如 anodized or powder-coated）、喷粉未定颜色，或普通碳钢完全未提防锈工艺。',
    skipCondition: '已明确工艺（如 brushed、zinc plated、RAL 9005）或明确说明“raw / mill finish”。不锈钢/铝未提表面处理时仅作低优先级可选确认。',
    antiHallucinationRule: '“brushed”仅确认表面拉丝，不能替客户推导出 2B 或 #4 砂号。',
  },
  {
    key: 'toleranceAndFeatures',
    title: '公差等级与二次加工',
    englishTitle: 'Tolerance & Secondary Ops',
    defaultPriority: 'P1',
    whyItMatters:
      '钣金折弯通常按 ISO 2768-m/c 级执行，若客户笼统要求“tight bending tolerance”会大幅影响压弯整形工序、良率与返工成本；压铆、攻丝、焊接也决定装配工时。',
    askCondition: '出现模糊紧公差措辞（如 tight tolerance / high precision）但未给出具体数值或基准。',
    skipCondition: '未提紧公差（常规折弯按标准执行），或已写明具体数值（如 ±0.2 mm / ISO 2768-m）。',
    antiHallucinationRule: '严禁把客户说的“tight tolerance”自动补写为 ±0.05 mm 或 ±0.1 mm。',
  },
  {
    key: 'partType',
    title: '零件类型与加工边界',
    englishTitle: 'Part Type & Scope',
    defaultPriority: 'P2',
    whyItMatters:
      '确认属于单件折弯支架/外壳/安装板，防止把纯 CNC 机加件或复杂多件焊接组件按普通单折弯件估价。',
    askCondition: '通常不单独作为阻塞追问，仅作信息确认与超范围提醒。',
    skipCondition: '一般不占追问名额。',
    antiHallucinationRule: '若检测到 CNC machining / die casting / welded assembly，仅提示边界风险，不强行拆解组件。',
  },
  {
    key: 'deliveryTerms',
    title: '贸易术语与目标交期',
    englishTitle: 'Incoterm & Lead Time',
    defaultPriority: 'P2',
    whyItMatters:
      'EXW/FOB/CIF/DDP 影响运费与报关包装成本分摊；加急交期影响激光排产与表面外发加急费。',
    askCondition: '仅在核心 P0/P1 均已齐备或明确“urgent/ASAP”而缺具体目标天数时，作为最多 1 条补充确认。',
    skipCondition: 'P0 阻塞项尚未补齐时优先让位，避免一封邮件塞入过多问题降低客户回复率。',
    antiHallucinationRule: '严禁擅自填入 EXW 或 FOB 默认条款。',
  },
];
