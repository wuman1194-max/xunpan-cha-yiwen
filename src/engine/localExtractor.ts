import type { EmailRound, EvidenceSpan, ExtractedRoundData, FieldKey } from '../types/rfq';

export interface ExtractionPriorContext {
  materialFamily?: string;
  hasPriorQuantity?: boolean;
}

function addSpan(
  list: EvidenceSpan[],
  round: EmailRound,
  fieldKey: FieldKey,
  start: number,
  end: number,
): void {
  if (start < 0 || end <= start || end > round.text.length) return;
  const quote = round.text.slice(start, end);
  const exists = list.some((s) => s.roundId === round.id && s.start === start && s.end === end);
  if (!exists) {
    list.push({
      roundId: round.id,
      roundNumber: round.roundNumber,
      quote,
      start,
      end,
      fieldKey,
    });
  }
}

function maskRange(mask: boolean[], start: number, end: number): void {
  const from = Math.max(0, start);
  const to = Math.min(mask.length, end);
  for (let i = from; i < to; i += 1) {
    mask[i] = true;
  }
}

function isRangeMasked(mask: boolean[], start: number, end: number): boolean {
  for (let i = Math.max(0, start); i < Math.min(mask.length, end); i += 1) {
    if (mask[i]) return true;
  }
  return false;
}

const PART_TYPE_MAP: Array<{ pattern: RegExp; zhLabel: string }> = [
  { pattern: /\bmounting\s+plates?\b/gi, zhLabel: '安装板' },
  { pattern: /\bbending\s+enclosures?\b/gi, zhLabel: '折弯外壳' },
  { pattern: /\benclosures?\b/gi, zhLabel: '折弯外壳' },
  { pattern: /\bbrackets?\b/gi, zhLabel: '折弯支架' },
  { pattern: /\bchassis\b/gi, zhLabel: '机箱/底盘' },
  { pattern: /\bhousings?\b/gi, zhLabel: '壳体/罩壳' },
  { pattern: /\bcovers?\b/gi, zhLabel: '盖板/罩盖' },
  { pattern: /\bpanels?\b/gi, zhLabel: '面板' },
  { pattern: /\bplates?\b/gi, zhLabel: '安装板/平板件' },
  { pattern: /\btrays?\b/gi, zhLabel: '托盘' },
  { pattern: /\bclips?\b/gi, zhLabel: '弹片/卡扣' },
  { pattern: /\bguards?\b/gi, zhLabel: '防护罩' },
  { pattern: /\bflanges?\b/gi, zhLabel: '法兰/翻边件' },
  { pattern: /\bframes?\b/gi, zhLabel: '框架件' },
  { pattern: /\bcabinets?\b/gi, zhLabel: '箱柜壳体' },
  { pattern: /\bboxes?\b/gi, zhLabel: '盒体' },
  { pattern: /\bshields?\b/gi, zhLabel: '屏蔽罩/挡板' },
  { pattern: /\bbaffles?\b/gi, zhLabel: '挡板/隔板' },
  { pattern: /\bsheet\s+metal\s+parts?\b/gi, zhLabel: '钣金件' },
];

const SECONDARY_OP_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /\bpem(?:\s+(?:nuts?|studs?|standoffs?|fasteners?))?\b/gi, label: '压铆件 (PEM)' },
  { pattern: /\b(?:tapped\s+holes?|tapping|threading)\b/gi, label: '攻丝/螺纹' },
  { pattern: /\bcountersunk|countersink|counterbore\b/gi, label: '沉孔' },
  {
    pattern:
      /\b(?:tig\s+weld(?:ing|ed)?|mig\s+weld(?:ing|ed)?|spot\s+weld(?:ing|ed)?|laser\s+weld(?:ing|ed)?|weld(?:ing|ed)?)\b/gi,
    label: '焊接',
  },
  { pattern: /\b(?:silkscreen|screen\s+print(?:ing)?|laser\s+mark(?:ing)?|engraving)\b/gi, label: '丝印/激光打标' },
  { pattern: /\bhemming|hemmed\s+edge\b/gi, label: '拍死边' },
];

const FINISH_ZH_MAP: Array<[RegExp, string]> = [
  [/matte\s+black\s+powder[\s-]*coat/i, '哑光黑喷粉'],
  [/black\s+powder[\s-]*coat/i, '黑色喷粉'],
  [/white\s+powder[\s-]*coat/i, '白色喷粉'],
  [/powder[\s-]*coat/i, '静电喷粉'],
  [/clear\s+anodiz/i, '本色阳极氧化'],
  [/black\s+anodiz/i, '黑色阳极氧化'],
  [/hard\s+anodiz/i, '硬质阳极氧化'],
  [/anodiz/i, '阳极氧化'],
  [/brushed|hairline|#4/i, '拉丝'],
  [/zinc[\s-]*plat/i, '镀锌'],
  [/galvaniz/i, '镀锌/热浸镀锌'],
  [/nickel[\s-]*plat/i, '镀镍'],
  [/chrome[\s-]*plat/i, '镀铬'],
  [/passivat/i, '钝化'],
  [/electropolish/i, '电解抛光'],
  [/alodine|chromate/i, '导电氧化/铬酸盐钝化'],
  [/black\s+oxide/i, '发黑处理'],
  [/bead[\s-]*blast|sandblast/i, '喷砂'],
  [/mirror|satin/i, '镜面/丝光抛光'],
  [/2b/i, '2B 原面'],
  [/raw|mill\s+finish|unfinished|no\s+(?:surface\s+)?(?:finish|coating)|as\s+cut/i, '本色/不做表面处理'],
];

function translateFinish(raw: string): string {
  for (const [regex, zh] of FINISH_ZH_MAP) {
    if (regex.test(raw)) return zh;
  }
  return raw;
}

function normalizeGradeString(raw: string): string {
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (cleaned === '1.4301') return '304 (1.4301)';
  if (cleaned === '1.4404') return '316L (1.4404)';
  if (/^SUS/i.test(cleaned)) return cleaned.replace(/^SUS/i, '').toUpperCase();
  if (/^SS/i.test(cleaned)) return cleaned.replace(/^SS/i, '').toUpperCase();
  if (/^AL/i.test(cleaned)) return cleaned.replace(/^AL/i, '').toUpperCase();
  return raw.trim().toUpperCase();
}

function inferFamilyFromGrade(grade: string): { family: string; zhFamily: string } | null {
  const g = grade.toUpperCase();
  if (/^(304|304L|316|316L|201|430|301|17-4PH)/.test(g)) {
    return { family: 'stainless steel', zhFamily: '不锈钢' };
  }
  if (/^(5052|5052-H32|6061|6061-T6|3003|1060|1100|7075)/.test(g)) {
    return { family: 'aluminum', zhFamily: '铝合金' };
  }
  if (/^(SGCC|SECC|DX51D)$/.test(g)) {
    return { family: 'carbon steel', zhFamily: '镀锌钢板' };
  }
  if (/^(SPCC|DC01|Q235|Q235B|Q355|Q355B|A36|1018|1020)$/.test(g)) {
    return { family: 'carbon steel', zhFamily: '碳钢/冷轧钢' };
  }
  if (/^(C110|C11000|T2)$/.test(g)) {
    return { family: 'copper/brass', zhFamily: '紫铜' };
  }
  if (/^(C260|C360|H62)$/.test(g)) {
    return { family: 'copper/brass', zhFamily: '黄铜' };
  }
  return null;
}

function gradeBelongsToFamily(grade: string, family?: string): boolean {
  if (!family) return false;
  const inferred = inferFamilyFromGrade(grade);
  return inferred?.family === family;
}

export function extractRoundLocally(
  round: EmailRound,
  priorContext?: ExtractionPriorContext,
): ExtractedRoundData {
  const text = round.text;
  const masked = new Array<boolean>(text.length).fill(false);

  const result: ExtractedRoundData = {
    roundId: round.id,
    roundNumber: round.roundNumber,
    scopeWarnings: [],
  };

  // 0. Mask PO / Order / Drawing / Part reference numbers so they never turn into quantities
  const refRegex = /\b(?:PO|order|ref|item|rev|part)\s*(?:no\.?|number|#|:)?\s*[A-Z0-9-]*\d+[A-Z0-9-]*\b/gi;
  for (const m of text.matchAll(refRegex)) {
    if (m.index !== undefined) maskRange(masked, m.index, m.index + m[0].length);
  }

  // Mask overall dimensions like "100 x 200 mm" or "100x200x1.5 mm"
  const dimRegex = /\b\d+(?:\.\d+)?\s*[x×]\s*\d+(?:\.\d+)?(?:\s*[x×]\s*\d+(?:\.\d+)?)?\s*(?:mm|cm|in|inch)\b/gi;
  for (const m of text.matchAll(dimRegex)) {
    if (m.index !== undefined) maskRange(masked, m.index, m.index + m[0].length);
  }

  // 1. Scope warnings (non-blocking boundaries)
  if (/\b(cnc\s+machin(?:ed|ing)|machined\s+from\s+solid|billet|lathe|turning)\b/i.test(text)) {
    result.scopeWarnings.push('检测到 CNC 机加工表述，首版仅聚焦单件钣金折弯澄清，机加特征需单独核图。');
  }
  if (/\b(injection\s+mold(?:ing|ed)?|die\s+cast(?:ing)?)\b/i.test(text)) {
    result.scopeWarnings.push('检测到注塑/压铸工艺表述，可能超出普通钣金折弯首版范围。');
  }
  if (/\b(welded\s+assembly|sub-?assembly|multi-part\s+assembly|weldment|bom)\b/i.test(text)) {
    result.scopeWarnings.push('检测到多件焊接/BOM 总成表述，建议按单件拆分后再核对折弯与焊装工时。');
  }

  // 2. Tolerance & Secondary Ops (mask numeric tolerances before thickness/quantity)
  const tolEvidence: EvidenceSpan[] = [];
  let numericTolerance: string | undefined;
  let vagueTightTolerance = false;
  const secondaryOps: string[] = [];

  const numTolRegex = /(?:±|\+\/-|\+\s*\/\s*-)\s*\d+(?:\.\d+)?\s*(?:mm|in|inch|"|um|µm)?/gi;
  for (const m of text.matchAll(numTolRegex)) {
    if (m.index !== undefined) {
      numericTolerance = numericTolerance ? `${numericTolerance}, ${m[0].trim()}` : m[0].trim();
      addSpan(tolEvidence, round, 'toleranceAndFeatures', m.index, m.index + m[0].length);
      maskRange(masked, m.index, m.index + m[0].length);
    }
  }

  const stdTolRegex = /\b(?:ISO\s*2768(?:-[fmcve]{1,2})?|DIN\s*6930(?:-[fmc])?)\b/gi;
  for (const m of text.matchAll(stdTolRegex)) {
    if (m.index !== undefined) {
      numericTolerance = numericTolerance ? `${numericTolerance}, ${m[0].trim()}` : m[0].trim();
      addSpan(tolEvidence, round, 'toleranceAndFeatures', m.index, m.index + m[0].length);
      maskRange(masked, m.index, m.index + m[0].length);
    }
  }

  const vagueTolMatch = text.match(
    /\b(?:tight(?:er)?\s+(?:bending\s+)?tolerances?|high\s+precision|strict\s+tolerances?|close\s+tolerances?)\b/i,
  );
  if (vagueTolMatch && vagueTolMatch.index !== undefined) {
    vagueTightTolerance = true;
    addSpan(
      tolEvidence,
      round,
      'toleranceAndFeatures',
      vagueTolMatch.index,
      vagueTolMatch.index + vagueTolMatch[0].length,
    );
  }

  for (const op of SECONDARY_OP_PATTERNS) {
    for (const m of text.matchAll(op.pattern)) {
      if (m.index !== undefined) {
        if (!secondaryOps.includes(op.label)) secondaryOps.push(op.label);
        addSpan(tolEvidence, round, 'toleranceAndFeatures', m.index, m.index + m[0].length);
      }
    }
  }

  if (numericTolerance || vagueTightTolerance || secondaryOps.length > 0) {
    result.toleranceAndFeatures = {
      numericTolerance,
      vagueTightTolerance,
      secondaryOps,
      evidence: tolEvidence,
    };
  }

  // 3. Compound & General History References (before individual field checks)
  const compoundThickFinishRegex =
    /\bsame\s+(?:sheet\s+)?thickness\s+and\s+(?:surface\s+)?finish\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order|batch)\b/gi;
  const compoundMatThickRegex =
    /\bsame\s+(?:material|alloy|grade)\s+and\s+(?:sheet\s+)?thickness\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order|batch)\b/gi;
  const generalHistoryRegex =
    /\b(?:same\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order|batch)|same\s+specs?\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order|batch)|as\s+per\s+(?:our\s+)?(?:last|previous)\s+(?:order|po\b[^,.]*)|repeat\s+order)\b/gi;

  let compoundThicknessHistory = false;
  let compoundFinishHistory = false;
  let compoundMaterialHistory = false;

  const thicknessEvidence: EvidenceSpan[] = [];
  const finishEvidence: EvidenceSpan[] = [];
  const matEvidence: EvidenceSpan[] = [];

  for (const m of text.matchAll(compoundThickFinishRegex)) {
    if (m.index !== undefined) {
      compoundThicknessHistory = true;
      compoundFinishHistory = true;
      addSpan(thicknessEvidence, round, 'thickness', m.index, m.index + m[0].length);
      addSpan(finishEvidence, round, 'surfaceFinish', m.index, m.index + m[0].length);
      maskRange(masked, m.index, m.index + m[0].length);
    }
  }

  for (const m of text.matchAll(compoundMatThickRegex)) {
    if (m.index !== undefined) {
      compoundMaterialHistory = true;
      compoundThicknessHistory = true;
      addSpan(matEvidence, round, 'material', m.index, m.index + m[0].length);
      addSpan(thicknessEvidence, round, 'thickness', m.index, m.index + m[0].length);
      maskRange(masked, m.index, m.index + m[0].length);
    }
  }

  const generalHistoryMatches = [...text.matchAll(generalHistoryRegex)].filter((m) => m.index !== undefined);
  if (generalHistoryMatches.length > 0 && !compoundThicknessHistory && !compoundMaterialHistory) {
    // Prefer "same as last time" / "same spec..." over bare "repeat order" for cleaner quote anchor
    const preferred =
      generalHistoryMatches.find((m) => /same|as\s+per/i.test(m[0])) || generalHistoryMatches[0];
    if (preferred.index !== undefined) {
      result.generalHistoryRef = {
        roundId: round.id,
        roundNumber: round.roundNumber,
        quote: round.text.slice(preferred.index, preferred.index + preferred[0].length),
        start: preferred.index,
        end: preferred.index + preferred[0].length,
        fieldKey: 'material',
      };
    }
    for (const gm of generalHistoryMatches) {
      if (gm.index !== undefined) maskRange(masked, gm.index, gm.index + gm[0].length);
    }
  }

  // 4. Thickness (explicit thickness + history reference)
  let thicknessDisplay: string | undefined;
  let thicknessNumericMm: number | undefined;
  let gaugeNumber: number | undefined;
  let thicknessHistory = compoundThicknessHistory;

  const thicknessHistoryRegex =
    /\b(?:(?:use\s+(?:the\s+)?)?same\s+(?:sheet\s+)?(?:thickness|gauge|gage|thick)\s+(?:as|from)\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order|batch|quote|job|po)|(?:thickness|gauge)\s+as\s+(?:last|previous)\s+(?:time|order)|same\s+(?:spec|specs|specification)\s+as\s+last\s+(?:time|order))\b/gi;
  for (const m of text.matchAll(thicknessHistoryRegex)) {
    if (m.index !== undefined) {
      thicknessHistory = true;
      addSpan(thicknessEvidence, round, 'thickness', m.index, m.index + m[0].length);
      maskRange(masked, m.index, m.index + m[0].length);
    }
  }

  // Metric thickness (mm or shorthand "1.5t" / "t=1.5")
  const metricThickRegex =
    /(?:(?:thickness(?:\s+is|\s*[:=])?\s*|t\s*[:=]\s*)?)(\d+(?:\.\d+)?)\s*mm\b(?:\s*thick(?:ness)?)?/gi;
  for (const m of text.matchAll(metricThickRegex)) {
    if (m.index === undefined) continue;
    const matchStart = m.index;
    const matchEnd = m.index + m[0].length;
    if (isRangeMasked(masked, matchStart, matchEnd)) continue;
    const prefix = text.slice(Math.max(0, matchStart - 4), matchStart);
    if (/[±/]/.test(prefix)) continue;
    const val = parseFloat(m[1]);
    if (!Number.isNaN(val) && val > 0 && val <= 30) {
      thicknessDisplay = `${m[1]} mm`;
      thicknessNumericMm = val;
      addSpan(thicknessEvidence, round, 'thickness', matchStart, matchEnd);
      maskRange(masked, matchStart, matchEnd);
      break;
    }
  }

  if (!thicknessDisplay) {
    const tShorthandRegex = /\b(?:t\s*[:=]\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*[tT])\b/g;
    for (const m of text.matchAll(tShorthandRegex)) {
      if (m.index === undefined) continue;
      const start = m.index;
      const end = start + m[0].length;
      if (isRangeMasked(masked, start, end)) continue;
      const numStr = m[1] || m[2];
      const val = parseFloat(numStr);
      if (!Number.isNaN(val) && val > 0 && val <= 25) {
        thicknessDisplay = `${numStr} mm`;
        thicknessNumericMm = val;
        addSpan(thicknessEvidence, round, 'thickness', start, end);
        maskRange(masked, start, end);
        break;
      }
    }
  }

  // Gauge thickness
  if (!thicknessDisplay) {
    const gaugeRegex = /\b(\d{1,2})\s*(?:gauge|ga|swg|awg)\b(?:\s*thick)?/gi;
    for (const m of text.matchAll(gaugeRegex)) {
      if (m.index === undefined) continue;
      const start = m.index;
      const end = start + m[0].length;
      if (isRangeMasked(masked, start, end)) continue;
      gaugeNumber = parseInt(m[1], 10);
      thicknessDisplay = `${m[1]} Gauge`;
      addSpan(thicknessEvidence, round, 'thickness', start, end);
      maskRange(masked, start, end);
      break;
    }
  }

  // Imperial thickness
  if (!thicknessDisplay) {
    const imperialRegex = /(?:^|[\s,(])(\d+(?:\.\d+)?|\d+\/\d+)\s*(?:inch(?:es)?|in\.?\b|")(?:\s*thick)?/gi;
    for (const m of text.matchAll(imperialRegex)) {
      if (m.index === undefined) continue;
      const tokenOffset = m[0].search(/\d/);
      const start = m.index + Math.max(0, tokenOffset);
      const end = m.index + m[0].length;
      if (isRangeMasked(masked, start, end)) continue;
      thicknessDisplay = text.slice(start, end).trim();
      addSpan(thicknessEvidence, round, 'thickness', start, end);
      maskRange(masked, start, end);
      break;
    }
  }

  if (thicknessDisplay || thicknessHistory) {
    result.thickness = {
      valueDisplay: thicknessDisplay,
      numericMm: thicknessNumericMm,
      gaugeNumber,
      isHistoryRef: thicknessDisplay ? false : thicknessHistory,
      evidence: thicknessEvidence,
    };
  }

  // 5. Surface Finish (and mask RAL codes / #4 / 2B)
  const ralRegex = /\bRAL\s*\d{4}\b/gi;
  const ralMatches: Array<{ value: string; start: number; end: number }> = [];
  for (const m of text.matchAll(ralRegex)) {
    if (m.index !== undefined) {
      ralMatches.push({
        value: m[0].toUpperCase().replace(/\s+/, ' '),
        start: m.index,
        end: m.index + m[0].length,
      });
      maskRange(masked, m.index, m.index + m[0].length);
    }
  }

  const finishChoiceRegex =
    /\b((?:clear|black|hard)?\s*anodiz(?:ed|ing)|(?:matte\s+)?(?:black|white|gray|grey|silver)?\s*powder[\s-]*coat(?:ed|ing)?|brushed|zinc[\s-]*plat(?:ed|ing)|nickel[\s-]*plat(?:ed|ing)|galvaniz(?:ed|ing)|passivat(?:ed|ion)|bead[\s-]*blast(?:ed|ing))\b\s+or\s+\b((?:clear|black|hard)?\s*anodiz(?:ed|ing)|(?:matte\s+)?(?:black|white|gray|grey|silver)?\s*powder[\s-]*coat(?:ed|ing)?|brushed|zinc[\s-]*plat(?:ed|ing)|nickel[\s-]*plat(?:ed|ing)|galvaniz(?:ed|ing)|passivat(?:ed|ion)|bead[\s-]*blast(?:ed|ing))\b/i;
  const choiceMatch = text.match(finishChoiceRegex);

  const finishHistoryMatch = text.match(
    /\bsame\s+(?:surface\s+)?finish\s+as\s+(?:the\s+)?(?:last|previous)\s+(?:time|order)\b/i,
  );

  if (choiceMatch && choiceMatch.index !== undefined) {
    addSpan(finishEvidence, round, 'surfaceFinish', choiceMatch.index, choiceMatch.index + choiceMatch[0].length);
    const opt1 = choiceMatch[1].trim();
    const opt2 = choiceMatch[2].trim();
    result.surfaceFinish = {
      valueDisplay: `${translateFinish(opt1)} 或 ${translateFinish(opt2)}（二选一待确认）`,
      zhLabel: `${translateFinish(opt1)} / ${translateFinish(opt2)}`,
      isChoiceAmbiguous: true,
      choiceOptions: [opt1, opt2],
      evidence: finishEvidence,
    };
  } else if (finishHistoryMatch && finishHistoryMatch.index !== undefined) {
    addSpan(
      finishEvidence,
      round,
      'surfaceFinish',
      finishHistoryMatch.index,
      finishHistoryMatch.index + finishHistoryMatch[0].length,
    );
    result.surfaceFinish = {
      isHistoryRef: true,
      evidence: finishEvidence,
    };
  } else {
    const singleFinishRegex =
      /\b(?:matte\s+black\s+powder[\s-]*coat(?:ed|ing)?|(?:black|white|gray|grey|silver|red|blue|green)\s+powder[\s-]*coat(?:ed|ing)?|powder[\s-]*coat(?:ed|ing)?|(?:clear|black|hard)\s+anodiz(?:ed|ing)|anodiz(?:ed|ing)|brushed|hairline|satin|mirror\s+polish(?:ed)?|zinc[\s-]*plat(?:ed|ing)|galvaniz(?:ed|ing)|nickel[\s-]*plat(?:ed|ing)|chrome[\s-]*plat(?:ed|ing)|passivat(?:ed|ion)|electropolish(?:ed|ing)|alodine|chromate|black\s+oxide|bead[\s-]*blast(?:ed|ing)|sandblast(?:ed|ing)|raw\s+finish|mill\s+finish|unfinished|no\s+(?:surface\s+)?(?:finish|coating)|as\s+cut)\b|#4\b|\b2B\b/gi;
    const foundFinishes: string[] = [];
    for (const m of text.matchAll(singleFinishRegex)) {
      if (m.index === undefined) continue;
      addSpan(finishEvidence, round, 'surfaceFinish', m.index, m.index + m[0].length);
      maskRange(masked, m.index, m.index + m[0].length);
      foundFinishes.push(m[0].trim());
    }
    for (const ral of ralMatches) {
      addSpan(finishEvidence, round, 'surfaceFinish', ral.start, ral.end);
    }

    if (foundFinishes.length > 0) {
      const primaryRaw = foundFinishes.join(' + ');
      const zhLabel = foundFinishes.map(translateFinish).join(' + ');
      const hasRal = ralMatches.length > 0;
      const ralSuffix = hasRal ? ` (${ralMatches.map((r) => r.value).join(', ')})` : '';
      const isPowder = /powder/i.test(primaryRaw);
      const hasColorWord =
        /\b(?:black|white|gray|grey|silver|red|blue|green|matte|gloss)\b/i.test(primaryRaw) || hasRal;
      const isExplicitRaw = /\b(?:raw|mill\s+finish|unfinished|no\s+(?:surface\s+)?(?:finish|coating)|as\s+cut)\b/i.test(
        primaryRaw,
      );

      result.surfaceFinish = {
        valueDisplay: `${zhLabel}${ralSuffix}`,
        zhLabel: `${zhLabel}${ralSuffix}`,
        missingColorDetail: isPowder && !hasColorWord,
        isExplicitRaw,
        evidence: finishEvidence,
      };
    } else if (compoundFinishHistory) {
      result.surfaceFinish = {
        isHistoryRef: true,
        evidence: finishEvidence,
      };
    }
  }

  // 6. Material & Grade (mask grades + family tokens so numbers like 304/5052/6061 don't leak into quantity)
  let materialFamily: string | undefined;
  let zhFamily: string | undefined;
  let materialGrade: string | undefined;
  let materialHistory = compoundMaterialHistory;

  const matHistoryMatch = text.match(
    /\bsame\s+(?:material|alloy|grade)\s+as\s+(?:the\s+)?(?:last|previous)\s+(?:time|order)\b/i,
  );
  if (matHistoryMatch && matHistoryMatch.index !== undefined) {
    materialHistory = true;
    addSpan(matEvidence, round, 'material', matHistoryMatch.index, matHistoryMatch.index + matHistoryMatch[0].length);
    maskRange(masked, matHistoryMatch.index, matHistoryMatch.index + matHistoryMatch[0].length);
  }

  // Explicit prefixed/suffixed/alloy-standard grades (including DIN 1.4301 / 1.4404 and C110/C260/T2/H62)
  const gradeRegex =
    /\b(?:SUS\s*304L?|SS\s*304L?|SUS\s*316L?|SS\s*316L?|AL\s*5052(?:-H\d+)?|AL\s*6061(?:-T\d+)?|5052(?:-H\d+)?|6061(?:-T\d+)?|304L?|316L?|201|430|301|17-4\s*PH|1\.4301|1\.4404|3003|1060|1100|7075(?:-T\d+)?|SPCC|SGCC|SECC|DX51D|DC01|Q235B?|Q355B?|A36|1018|1020|C11000|C110|C260|C360|H62|T2)(?!\s*(?:pcs|pieces|units|brackets|plates|enclosures|parts|sets|ea|mm|cm|in|inch|gauge|ga)\b)\b/gi;
  for (const m of text.matchAll(gradeRegex)) {
    if (m.index === undefined) continue;
    const start = m.index;
    const end = start + m[0].length;
    if (isRangeMasked(masked, start, end)) continue;

    const raw = m[0].trim();
    const isPureDigits = /^\d{3,4}$/.test(raw);
    if (isPureDigits) {
      const windowAround = text.slice(Math.max(0, start - 35), Math.min(text.length, end + 35));
      const hasMatContext =
        /\b(?:stainless|steel|aluminum|aluminium|alloy|grade|material|ss|sus|al|sheet|plate|make\s+it|use|go\s+with|switch\s+to|aisi)\b/i.test(
          windowAround,
        );
      const matchesPriorFamily = gradeBelongsToFamily(raw, priorContext?.materialFamily);
      if (!hasMatContext && !matchesPriorFamily) continue;
    }

    materialGrade = normalizeGradeString(raw);
    addSpan(matEvidence, round, 'material', start, end);
    maskRange(masked, start, end);
    break;
  }

  const familyPatterns: Array<{ regex: RegExp; family: string; zh: string }> = [
    { regex: /\b(?:stainless\s+steel|stainless)\b/gi, family: 'stainless steel', zh: '不锈钢' },
    { regex: /\b(?:aluminum|aluminium)\b/gi, family: 'aluminum', zh: '铝合金' },
    {
      regex:
        /\b(?:mild\s+steel|carbon\s+steel|cold[\s-]*rolled\s+steel|hot[\s-]*rolled\s+steel|galvanized\s+steel|crs|hrs)\b/gi,
      family: 'carbon steel',
      zh: '碳钢/冷轧钢',
    },
    { regex: /\bbrass\b/gi, family: 'copper/brass', zh: '黄铜' },
    { regex: /\bcopper\b/gi, family: 'copper/brass', zh: '紫铜/铜材' },
  ];

  for (const fp of familyPatterns) {
    for (const m of text.matchAll(fp.regex)) {
      if (m.index === undefined) continue;
      if (!materialFamily) {
        materialFamily = fp.family;
        zhFamily = fp.zh;
      }
      addSpan(matEvidence, round, 'material', m.index, m.index + m[0].length);
      maskRange(masked, m.index, m.index + m[0].length);
    }
  }

  // Generic "steel" only if no family matched yet
  if (!materialFamily) {
    const genericSteel = text.match(/\bsteel\b/i);
    if (genericSteel && genericSteel.index !== undefined) {
      materialFamily = 'steel';
      zhFamily = '钢材（未区分碳钢/不锈钢）';
      addSpan(matEvidence, round, 'material', genericSteel.index, genericSteel.index + genericSteel[0].length);
    }
  }

  if (materialGrade && !materialFamily) {
    const inferred = inferFamilyFromGrade(materialGrade);
    if (inferred) {
      materialFamily = inferred.family;
      zhFamily = inferred.zhFamily;
    }
  }

  if (materialFamily || materialGrade || materialHistory) {
    result.material = {
      family: materialFamily,
      zhFamily,
      grade: materialGrade,
      isHistoryRef: !materialFamily && !materialGrade ? materialHistory : false,
      evidence: matEvidence,
    };
  }

  // 7. Delivery terms & lead time (mask durations so "2 weeks" isn't treated as quantity)
  const deliveryEvidence: EvidenceSpan[] = [];
  let incoterm: string | undefined;
  let leadTime: string | undefined;
  let isUrgent = false;

  const incotermMatch = text.match(
    /\b(EXW|FOB|CIF|DDP|DAP|FCA|CFR)(?:\s+(?!(?:for|and|or|to|with|by|in|on|the|a|an)\b)[A-Z][A-Za-z-]+(?:\s+(?!(?:for|and|or|to|with|by|in|on|the|a|an)\b)[A-Z][A-Za-z-]+)?)?/i,
  );
  if (incotermMatch && incotermMatch.index !== undefined) {
    const rawInco = incotermMatch[0].trim();
    const code = incotermMatch[1].toUpperCase();
    const rest = rawInco.slice(incotermMatch[1].length).trim();
    incoterm = rest ? `${code} ${rest}` : code;
    addSpan(deliveryEvidence, round, 'deliveryTerms', incotermMatch.index, incotermMatch.index + rawInco.length);
    maskRange(masked, incotermMatch.index, incotermMatch.index + rawInco.length);
  }

  const leadTimeMatch = text.match(
    /\b(?:target\s+)?lead\s*time(?:\s*(?:is|of|:))?\s*\d+(?:\s*-\s*\d+)?\s*(?:days?|working\s+days?|business\s+days?|weeks?|wks?|months?)\b|\bwithin\s+\d+\s*(?:days?|working\s+days?|weeks?|wks?)\b/i,
  );
  if (leadTimeMatch && leadTimeMatch.index !== undefined) {
    leadTime = leadTimeMatch[0].trim();
    addSpan(
      deliveryEvidence,
      round,
      'deliveryTerms',
      leadTimeMatch.index,
      leadTimeMatch.index + leadTimeMatch[0].length,
    );
    maskRange(masked, leadTimeMatch.index, leadTimeMatch.index + leadTimeMatch[0].length);
  }

  for (const dm of text.matchAll(
    /\b\d+(?:\s*-\s*\d+)?\s*(?:days?|working\s+days?|business\s+days?|weeks?|wks?|months?|hours?|hrs?)\b/gi,
  )) {
    if (dm.index !== undefined) maskRange(masked, dm.index, dm.index + dm[0].length);
  }

  const urgentMatch = text.match(/\b(urgent|asap|rush\s+order)\b/i);
  if (urgentMatch && urgentMatch.index !== undefined) {
    isUrgent = true;
    addSpan(deliveryEvidence, round, 'deliveryTerms', urgentMatch.index, urgentMatch.index + urgentMatch[0].length);
  }

  if (incoterm || leadTime || isUrgent) {
    result.deliveryTerms = {
      incoterm,
      leadTime,
      isUrgent,
      evidence: deliveryEvidence,
    };
  }

  // 8. Drawing
  const drawingEvidence: EvidenceSpan[] = [];
  const pendingDrawingMatch = text.match(
    /\b(?:(?:the\s+)?(?:drawing|drawings|cad|step|stp|dxf|dwg|2d|3d|files?|prints?)\s+(?:will\s+)?(?:to\s+follow|follow(?:ing)?\s*(?:soon|shortly|later)?|coming\s+soon|on\s+the\s+way)|(?:will\s+send|send(?:ing)?|share|provide)\s+(?:the\s+)?(?:drawing|drawings|cad|step|dxf|dwg|files?)\s+(?:later|soon|shortly|tomorrow))\b/i,
  );
  const noDrawingSketchMatch = text.match(
    /\b(?:no\s+(?:formal\s+)?drawing(?:s)?\s+(?:ready\s+)?yet(?:,\s*we\s+have\s+(?:a\s+)?rough\s+sketch)?|(?:only\s+)?(?:a\s+)?(?:rough|hand)\s+sketch)\b/i,
  );
  const attachedDrawingMatch = text.match(
    /\b(?:(?:step|stp|iges|igs|dxf|dwg|cad|pdf\s+sketch|pdf|2d|3d|drawing|drawings|print)\s+(?:file\s+)?(?:is\s+|are\s+)?(?:attached|enclosed|included|herewith)|(?:see|find)\s+attached\s+(?:step|stp|dxf|dwg|cad|pdf|drawing|drawings|files?)|attached\s+(?:is\s+|are\s+)?(?:the\s+)?(?:step|stp|dxf|dwg|cad|pdf|drawing|drawings))\b/i,
  );
  const historyDrawingMatch = text.match(
    /\bsame\s+(?:drawing|cad|design|file)\s+as\s+(?:the\s+)?(?:last|previous)\s+(?:time|order)\b/i,
  );

  if (pendingDrawingMatch && pendingDrawingMatch.index !== undefined) {
    addSpan(
      drawingEvidence,
      round,
      'drawing',
      pendingDrawingMatch.index,
      pendingDrawingMatch.index + pendingDrawingMatch[0].length,
    );
    result.drawing = {
      state: 'pending_customer',
      evidence: drawingEvidence,
    };
  } else if (noDrawingSketchMatch && noDrawingSketchMatch.index !== undefined) {
    addSpan(
      drawingEvidence,
      round,
      'drawing',
      noDrawingSketchMatch.index,
      noDrawingSketchMatch.index + noDrawingSketchMatch[0].length,
    );
    result.drawing = {
      state: 'sketch_only',
      evidence: drawingEvidence,
    };
  } else if (attachedDrawingMatch && attachedDrawingMatch.index !== undefined) {
    addSpan(
      drawingEvidence,
      round,
      'drawing',
      attachedDrawingMatch.index,
      attachedDrawingMatch.index + attachedDrawingMatch[0].length,
    );
    const matchedStr = attachedDrawingMatch[0];
    const fmt = /\b(step|stp|dxf|dwg|iges|igs|pdf\s+sketch|pdf|cad|2d|3d)\b/i.exec(matchedStr)?.[1];
    result.drawing = {
      state: 'attached',
      formatDetail: fmt ? fmt.toUpperCase() : '图纸文件',
      evidence: drawingEvidence,
    };
  } else if (historyDrawingMatch && historyDrawingMatch.index !== undefined) {
    addSpan(
      drawingEvidence,
      round,
      'drawing',
      historyDrawingMatch.index,
      historyDrawingMatch.index + historyDrawingMatch[0].length,
    );
    result.drawing = {
      state: 'check_history',
      evidence: drawingEvidence,
    };
  }

  // 9. Part Type (scan all non-overlapping part matches to detect multi-part emails)
  const partEvidence: EvidenceSpan[] = [];
  const matchedPartLabels: string[] = [];
  const partMask = new Array<boolean>(text.length).fill(false);
  let primaryPartValue: string | undefined;
  let primaryPartZh: string | undefined;

  for (const pt of PART_TYPE_MAP) {
    for (const pm of text.matchAll(pt.pattern)) {
      if (pm.index === undefined) continue;
      const start = pm.index;
      const end = start + pm[0].length;
      if (isRangeMasked(partMask, start, end)) continue;
      maskRange(partMask, start, end);
      addSpan(partEvidence, round, 'partType', start, end);
      if (!primaryPartValue) {
        primaryPartValue = pm[0].trim();
        primaryPartZh = pt.zhLabel;
      }
      if (!matchedPartLabels.includes(pt.zhLabel)) {
        matchedPartLabels.push(pt.zhLabel);
      }
    }
  }

  if (primaryPartValue && primaryPartZh) {
    result.partType = {
      value: primaryPartValue,
      zhLabel: primaryPartZh,
      evidence: partEvidence,
    };
  }
  if (matchedPartLabels.length >= 2) {
    result.scopeWarnings.push(
      `检测到单封邮件可能包含多款不同零件（${matchedPartLabels.join('、')}），首版按单件合并解析，建议按零件拆分核对。`,
    );
  }

  // 10. Quantity extraction on unmasked spans
  const qtyEvidence: EvidenceSpan[] = [];
  const confirmPrevMatch = text.match(/\b(?:for\s+)?both\s+(?:quantities|tiers|volumes)|same\s+quantit(?:y|ies)\b/i);
  if (confirmPrevMatch && confirmPrevMatch.index !== undefined) {
    addSpan(
      qtyEvidence,
      round,
      'quantity',
      confirmPrevMatch.index,
      confirmPrevMatch.index + confirmPrevMatch[0].length,
    );
    result.quantity = {
      values: [],
      mode: 'confirm_previous',
      evidence: qtyEvidence,
    };
  } else {
    const qtyNumberRegex = /\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?\s*[kK]|\d+)\b/g;
    const foundQuantities: Array<{ value: number; start: number; end: number }> = [];
    const hasGlobalQtyContext = /\b(?:quote|price|qty|quantity|pcs|pieces|units|order|need)\b/i.test(text);

    for (const m of text.matchAll(qtyNumberRegex)) {
      if (m.index === undefined) continue;
      const start = m.index;
      const end = start + m[0].length;
      if (isRangeMasked(masked, start, end)) continue;

      const rawToken = m[1].trim();
      let numericValue: number;
      if (/k$/i.test(rawToken)) {
        numericValue = Math.round(parseFloat(rawToken.slice(0, -1)) * 1000);
      } else {
        numericValue = parseInt(rawToken.replace(/,/g, ''), 10);
      }
      if (!Number.isFinite(numericValue) || numericValue <= 0) continue;

      const beforeWindow = text.slice(Math.max(0, start - 45), start);
      const afterWindow = text.slice(end, Math.min(text.length, end + 50));

      const hasBeforeCue =
        /\b(?:quote|price|also\s+price|also\s+quote|qty|quantity(?:\s+is|\s*[:=])?|need|order|planned|change(?:\s+it)?\s+to|revised\s+to|make\s+it|around|about|approx\.?|for|of|and|or|plus|add)\s*$/i.test(
          beforeWindow,
        ) ||
        /(?:^|\s)[/:]\s*$/.test(beforeWindow) ||
        (hasGlobalQtyContext && /\d\s*,\s*$/.test(beforeWindow));

      const hasAfterCue =
        /^\s*(?:pcs|pieces|units|ea|each|sets|lots|only|brackets?|enclosures?|plates?|panels?|covers?|chassis|parts?|housings?|trays?|clips?|flanges?|frames?|boxes?|for\s+both|\?|\s+(?:brushed|stainless|aluminum|mild|carbon|steel|galvanized|sheet|metal|brass|copper))/i.test(
          afterWindow,
        ) ||
        (hasGlobalQtyContext && /^\s*(?:,|\/)\s*(?:(?:and|or)\s+)?\d/.test(afterWindow));

      if (hasBeforeCue || hasAfterCue) {
        const unitAfter = /^\s*(?:pcs|pieces|units|ea|sets)\b/i.exec(afterWindow);
        const spanEnd = unitAfter ? end + unitAfter[0].length : end;
        foundQuantities.push({ value: numericValue, start, end: spanEnd });
        addSpan(qtyEvidence, round, 'quantity', start, spanEnd);
      }
    }

    if (foundQuantities.length === 1) {
      const beforeSingle = text.slice(Math.max(0, foundQuantities[0].start - 35), foundQuantities[0].start);
      const afterSingle = text.slice(foundQuantities[0].end, foundQuantities[0].end + 25);
      const hasOnly = /\bonly\b/i.test(afterSingle);
      const isAdditive =
        Boolean(priorContext?.hasPriorQuantity) &&
        (/\b(?:also\s+price|also\s+quote|add(?:itionally)?|plus)\b/i.test(beforeSingle) ||
          /\bas\s+well\b/i.test(afterSingle)) &&
        !/\b(?:only|instead|change|replace)\b/i.test(beforeSingle + afterSingle);

      result.quantity = {
        values: [foundQuantities[0].value],
        mode: 'single',
        isOnly: hasOnly,
        isAdditive,
        evidence: qtyEvidence,
      };
    } else if (foundQuantities.length >= 2) {
      const betweenText = text.slice(
        Math.max(0, foundQuantities[0].start - 25),
        foundQuantities[foundQuantities.length - 1].end + 15,
      );
      const isRevision =
        /\b(?:originally|planned|actually|change(?:\s+it)?\s+to|revised?\s+to|instead\s+of|replace|not\s+\d)\b/i.test(
          betweenText,
        );
      const isTiered =
        /\b(?:also\s+price|also\s+quote|price\s+breaks?|tiers?|both|or\s+quote|and\s+\d)\b/i.test(betweenText) ||
        /\d[\s,]*(?:\/|,)\s*\d/.test(betweenText);

      const mode: 'tiered' | 'revised' | 'ambiguous' = isRevision
        ? 'revised'
        : isTiered
          ? 'tiered'
          : 'ambiguous';

      result.quantity = {
        values: foundQuantities.map((q) => q.value),
        mode,
        evidence: qtyEvidence,
      };
    }
  }

  return result;
}
