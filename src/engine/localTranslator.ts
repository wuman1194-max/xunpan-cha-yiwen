import type { ExtractedRoundData } from '../types/rfq';

const SPEC_REPLACEMENTS: Array<[RegExp, string]> = [
  // Multi-word finishes & colors first
  [/\bmatte\s+black\s+powder[\s-]*coat(?:ed|ing)?\b/gi, '哑光黑喷粉'],
  [/\bgloss\s+black\s+powder[\s-]*coat(?:ed|ing)?\b/gi, '亮黑喷粉'],
  [/\bblack\s+powder[\s-]*coat(?:ed|ing)?\b/gi, '黑色喷粉'],
  [/\bwhite\s+powder[\s-]*coat(?:ed|ing)?\b/gi, '白色喷粉'],
  [/\bgray\s+powder[\s-]*coat(?:ed|ing)?|\bgrey\s+powder[\s-]*coat(?:ed|ing)?\b/gi, '灰色喷粉'],
  [/\bpowder[\s-]*coat(?:ed|ing)?\b/gi, '静电喷粉'],
  [/\bclear\s+anodiz(?:ed|ing)\b/gi, '本色阳极氧化'],
  [/\bblack\s+anodiz(?:ed|ing)\b/gi, '黑色阳极氧化'],
  [/\bhard\s+anodiz(?:ed|ing)\b/gi, '硬质阳极氧化'],
  [/\banodiz(?:ed|ing)\b/gi, '阳极氧化'],
  [/\bbrushed\b|\bhairline\b|#4\s*(?:finish)?\b/gi, '拉丝'],
  [/\bzinc[\s-]*plat(?:ed|ing)\b/gi, '镀锌'],
  [/\bgalvaniz(?:ed|ing)\b/gi, '镀锌'],
  [/\bnickel[\s-]*plat(?:ed|ing)\b/gi, '镀镍'],
  [/\bchrome[\s-]*plat(?:ed|ing)\b/gi, '镀铬'],
  [/\bpassivat(?:ed|ion)\b/gi, '钝化处理'],
  [/\belectropolish(?:ed|ing)\b/gi, '电解抛光'],
  [/\balodine\b|\bchromate\b/gi, '导电氧化'],
  [/\bblack\s+oxide\b/gi, '发黑处理'],
  [/\bbead[\s-]*blast(?:ed|ing)\b|\bsandblast(?:ed|ing)\b/gi, '喷砂'],
  [/\bmirror\s+polish(?:ed)?\b/gi, '镜面抛光'],
  [/\braw\s+finish\b|\bmill\s+finish\b|\bunfinished\b|\bno\s+(?:surface\s+)?(?:finish|coating)\b|\bas\s+cut\b/gi, '保持金属本色（不做表面处理）'],
  [/\bsurface\s+finish\b|\bfinish\b/gi, '表面处理'],

  // Drawing statuses
  [/\bno\s+(?:formal\s+)?drawing(?:s)?\s+(?:ready\s+)?yet(?:,\s*we\s+have\s+(?:a\s+)?rough\s+sketch)?\b/gi, '正式图纸还没准备好，目前只有一张粗略草图'],
  [/\b(?:a\s+)?(?:rough|hand)\s+sketch\b/gi, '一张粗略草图'],
  [/\b(?:the\s+)?(?:drawing|drawings|cad|files?|prints?)\s+(?:will\s+)?(?:to\s+follow|follow(?:ing)?\s*(?:soon|shortly|later)?|coming\s+soon)\b/gi, '图纸待会儿发'],
  [/\bstep\s+file\s+(?:is\s+)?attached\b/gi, '已附 STEP 3D 图纸'],
  [/\bstep\s+(?:is\s+)?attached\b/gi, '已附 STEP 图纸'],
  [/\bdxf\s+(?:file\s+)?(?:is\s+)?attached\b/gi, '已附 DXF 图纸'],
  [/\bdwg\s+(?:file\s+)?(?:is\s+)?attached\b/gi, '已附 DWG 图纸'],
  [/\bpdf\s+sketch\s+(?:is\s+)?attached\b/gi, '已附 PDF 草图'],
  [/\bpdf\s+(?:file\s+)?(?:is\s+)?attached\b/gi, '已附 PDF 图纸'],
  [/\bdrawings?\s+(?:are\s+|is\s+)?attached\b/gi, '已附图纸'],
  [/\b(?:see|find)\s+attached\s+(?:drawing|drawings|step|dxf|dwg|pdf|cad|files?)\b/gi, '请看附件里的图纸'],

  // Materials
  [/\bstainless\s+steel\b|\bstainless\b/gi, '不锈钢'],
  [/\baluminum\b|\baluminium\b/gi, '铝合金'],
  [/\bmild\s+steel\b|\bcarbon\s+steel\b/gi, '碳钢'],
  [/\bcold[\s-]*rolled\s+steel\b/gi, '冷轧钢'],
  [/\bhot[\s-]*rolled\s+steel\b/gi, '热轧钢'],
  [/\bgalvanized\s+steel\b/gi, '镀锌钢'],
  [/\bbrass\b/gi, '黄铜'],
  [/\bcopper\b/gi, '紫铜'],
  [/\bsteel\b/gi, '钢材'],

  // Part nouns
  [/\bmounting\s+plates?\b/gi, '安装板'],
  [/\bbending\s+enclosures?\b/gi, '折弯外壳'],
  [/\benclosures?\b/gi, '外壳'],
  [/\bbrackets?\b/gi, '支架'],
  [/\bchassis\b/gi, '机箱'],
  [/\bhousings?\b/gi, '壳体'],
  [/\bcovers?\b/gi, '盖板'],
  [/\bpanels?\b/gi, '面板'],
  [/\bplates?\b/gi, '安装板'],
  [/\btrays?\b/gi, '托盘'],
  [/\bclips?\b/gi, '弹片'],
  [/\bguards?\b/gi, '防护罩'],
  [/\bflanges?\b/gi, '法兰件'],
  [/\bframes?\b/gi, '框架'],
  [/\bcabinets?\b/gi, '箱柜'],
  [/\bboxes?\b/gi, '盒体'],
  [/\bshields?\b/gi, '屏蔽罩'],
  [/\bbaffles?\b/gi, '挡板'],
  [/\bsheet\s+metal\s+parts?\b/gi, '钣金零件'],
  [/\bparts?\b/gi, '零件'],

  // Tolerances & secondary ops
  [/\btight(?:er)?\s+bending\s+tolerances?\b/gi, '严格折弯精度（紧公差）'],
  [/\btight(?:er)?\s+tolerances?\b|\bhigh\s+precision\b|\bstrict\s+tolerances?\b/gi, '严格精度（紧公差）'],
  [/\bon\s+overall\s+dimensions\b/gi, '（整体尺寸）'],
  [/\bwith\s+pem\s+nuts?\b/gi, '带 PEM 压铆螺母'],
  [/\bpem\s+nuts?\b/gi, 'PEM 压铆螺母'],
  [/\btapped\s+holes?\b/gi, '攻丝螺孔'],
  [/\bsilkscreen\b/gi, '丝印'],
  [/\bwelding\b|\bwelded\b/gi, '焊接'],

  // Delivery & Incoterms
  [/\btarget\s+lead\s*time\s*(?:is|of|:)?\s*(\d+(?:\s*-\s*\d+)?)\s*weeks?\b/gi, '期望交期 $1 周'],
  [/\btarget\s+lead\s*time\s*(?:is|of|:)?\s*(\d+(?:\s*-\s*\d+)?)\s*(?:working\s+|business\s+)?days?\b/gi, '期望交期 $1 天'],
  [/\blead\s*time\s*(?:is|of|:)?\s*(\d+(?:\s*-\s*\d+)?)\s*weeks?\b/gi, '交期 $1 周'],
  [/\blead\s*time\s*(?:is|of|:)?\s*(\d+(?:\s*-\s*\d+)?)\s*(?:working\s+|business\s+)?days?\b/gi, '交期 $1 天'],
  [/\b(\d+)\s*weeks?\b/gi, '$1 周'],
  [/\b(\d+)\s*(?:working\s+|business\s+)?days?\b/gi, '$1 天'],
  [/(?:\bfor\s+)?\bEXW\b/gi, '，出厂价（EXW）'],
  [/(?:\bfor\s+)?\bCIF\s+([A-Za-z-]+)\b/gi, '，$1 到岸价（CIF $1）'],
  [/(?:\bfor\s+)?\bDDP\b/gi, '，完税后交货（DDP）'],
  [/\burgent\b|\basap\b/gi, '加急'],

  // History & Misc
  [/\bsame\s+(?:sheet\s+)?thickness\s+and\s+(?:surface\s+)?finish\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order)\b/gi, '厚度和表面做法和上次一样'],
  [/\bsame\s+(?:material|alloy|grade)\s+and\s+(?:sheet\s+)?thickness\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order)\b/gi, '材料和厚度和上次一样'],
  [/\bsame\s+(?:sheet\s+)?thickness\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order)\b/gi, '板材厚度和上次一样'],
  [/\bsame\s+(?:surface\s+)?finish\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order)\b/gi, '表面做法和上次一样'],
  [/\bsame\s+(?:material|alloy|grade)\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order)\b/gi, '材料和上次一样'],
  [/\bsame\s+(?:drawing|cad|design|file)\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order)\b/gi, '图纸沿用上次那版'],
  [/\bsame\s+as\s+(?:the\s+)?(?:last|previous|prior)\s+(?:time|order)\b/gi, '规格和上次一样'],
  [/\bfor\s+both\s+(?:quantities|tiers|volumes)\b|\bboth\s+(?:quantities|tiers)\b/gi, '两个数量都按这个规格'],
];

function translateSpecFragment(raw: string): string {
  let out = raw.trim();
  if (!out) return '';

  // Format RAL code in parens
  out = out.replace(/\(\s*RAL\s*(\d{4})\s*\)/gi, '（色号 RAL $1）');
  out = out.replace(/\bRAL\s*(\d{4})\b/gi, '色号 RAL $1');

  // 3+ or 2 quantity lists: "100, 500, and 2,000 pcs of" -> "100、500 和 2,000 个"
  out = out.replace(
    /\b(\d{1,3}(?:,\d{3})+|\d+)\s*,\s*(\d{1,3}(?:,\d{3})+|\d+)\s*,?\s*(?:and|or)\s+(\d{1,3}(?:,\d{3})+|\d+)\s*(?:pcs|pieces|units|ea|sets)?(?:\s+of)?\b/gi,
    '$1、$2 和 $3 个 ',
  );
  // "both 500 and 2,000 pcs" -> "500 和 2,000 个"
  out = out.replace(
    /\bboth\s+(\d{1,3}(?:,\d{3})+|\d+)\s+and\s+(\d{1,3}(?:,\d{3})+|\d+)\s*(?:pcs|pieces|units|ea|sets)?(?:\s+of)?\b/gi,
    '$1 和 $2 个 ',
  );
  // Single "500 pcs of" / "500 pcs" -> "500 个"
  out = out.replace(/\b(\d{1,3}(?:,\d{3})+|\d+)\s*(?:pcs|pieces|units|ea|sets)(?:\s+of)?\b/gi, '$1 个 ');
  // Bare quantity before material/finish/part (never add 个 to alloy grades like 304, 316, 5052, 6061)
  const GRADE_NUMBERS = new Set(['201', '301', '304', '316', '430', '1018', '1020', '1060', '1100', '3003', '5052', '6061', '7075']);
  out = out.replace(
    /\b(\d{1,3}(?:,\d{3})+|\d+)\b(?=\s+(?:304|316|5052|6061|SPCC|SGCC|SECC|brushed|anodized|powder|stainless|aluminum|aluminium|mild|carbon|steel|brass|copper|brackets?|enclosures?|covers?|plates?|panels?|clips?|chassis))/gi,
    (match, num: string) => (GRADE_NUMBERS.has(num) ? match : `${num} 个 `),
  );

  // Thickness expressions
  out = out.replace(/\b(\d+(?:\.\d+)?)\s*mm\s*thick(?:ness)?\b/gi, '$1 毫米厚');
  out = out.replace(/\b(\d+(?:\.\d+)?)\s*mm\b/gi, '$1 毫米');
  out = out.replace(/\b(\d+(?:\.\d+)?)\s*[tT]\b/g, '$1 毫米厚');
  out = out.replace(/\b(\d{1,2})\s*(?:gauge|ga)\b(?:\s*thick)?/gi, '$1 Gauge（英美厚度规格）');
  out = out.replace(/\b(\d+(?:\.\d+)?|\d+\/\d+)\s*(?:inch(?:es)?|in\.?)\s*(?:thick)?\b/gi, '$1 英寸厚');

  // Single-pass FOB port translation (prevents nested double-matching)
  const PORT_ZH: Record<string, string> = {
    shenzhen: '深圳',
    ningbo: '宁波',
    shanghai: '上海',
    guangzhou: '广州',
    qingdao: '青岛',
    xiamen: '厦门',
  };
  out = out.replace(/(?:\bfor\s+)?\bFOB\s+([A-Za-z-]+)\b/gi, (_m, port: string) => {
    const zhPort = PORT_ZH[port.toLowerCase()] || port;
    return `，${zhPort}离岸价（FOB ${port}）`;
  });

  // Apply domain replacements
  for (const [pattern, replacement] of SPEC_REPLACEMENTS) {
    out = out.replace(pattern, replacement);
  }

  // Connectors
  out = out.replace(/\bwith\b/gi, '带');
  out = out.replace(/\bor\b/gi, '或');
  out = out.replace(/\band\b/gi, '和');
  out = out.replace(/\bof\b/gi, '');
  out = out.replace(/\b(?:a|an|the|our)\b/gi, '');

  // Clean spacing around Chinese punctuation and characters (preserve numeric thousands separators like 2,000)
  out = out
    .replace(/\s+/g, ' ')
    .replace(/(?<!\d)\s*,\s*|,\s*(?!\d{3}\b)/g, '，')
    .replace(/\(\s*/g, '（')
    .replace(/\s*\)/g, '）')
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2')
    .replace(/([\u4e00-\u9fa5])\s+([，。？（）])/g, '$1$2')
    .replace(/([，。？（）])\s+([\u4e00-\u9fa5A-Za-z0-9])/g, '$1$2')
    .replace(/，{2,}/g, '，')
    .replace(/^[，]+/, '')
    .trim();

  return out;
}

function stripLeadingGreeting(sentence: string): { greetingZh: string; rest: string } {
  const m = sentence.match(
    /^\s*(?:(hi|hello|hey|dear\s+(?:team|sir|madam|all|sales|supplier|friend|customer))[,\s!]*)/i,
  );
  if (!m) return { greetingZh: '', rest: sentence.trim() };
  const raw = m[1].toLowerCase();
  const greetingZh = /dear\s+team|dear\s+all/.test(raw)
    ? '你们好，'
    : /dear/.test(raw)
      ? '您好，'
      : '你好，';
  return { greetingZh, rest: sentence.slice(m[0].length).trim() };
}

function translateSingleRfqSentence(sentence: string, isQuestion: boolean): string {
  const { greetingZh, rest } = stripLeadingGreeting(sentence);
  if (!rest) return greetingZh;

  let body = '';

  // Match high-frequency RFQ sentence frames
  let m: RegExpMatchArray | null;

  if ((m = rest.match(/^repeat\s+order\s+(?:for\s+)?(.+)$/i))) {
    body = `老单复购 ${translateSpecFragment(m[1])}`;
  } else if (
    (m = rest.match(
      /^originally\s+planned\s+(.+?),?\s*actually\s+(?:please\s+)?change(?:\s+it)?\s+to\s+(.+)$/i,
    ))
  ) {
    body = `本来计划 ${translateSpecFragment(m[1])}，其实请改成 ${translateSpecFragment(m[2])}`;
  } else if ((m = rest.match(/^(?:actually\s+)?(?:please\s+)?change(?:\s+it)?\s+to\s+(.+?)(?:\s+instead)?$/i))) {
    const inner = m[1].trim();
    const qtyOnly = /^(\d{1,3}(?:,\d{3})+|\d+)$/.test(inner);
    body = qtyOnly ? `其实请改为 ${inner} 个` : `其实请改为 ${translateSpecFragment(inner)}`;
  } else if ((m = rest.match(/^could\s+you\s+also\s+(?:price|quote)\s+(.+)$/i))) {
    const inner = m[1].trim();
    const qtyOnly = /^(\d{1,3}(?:,\d{3})+|\d+)$/.test(inner);
    body = qtyOnly
      ? `顺便也报一下 ${inner} 个的价格可以吗`
      : `顺便也报一下 ${translateSpecFragment(inner)} 的价格可以吗`;
  } else if ((m = rest.match(/^(?:can|could)\s+you\s+(?:please\s+)?quote\s+(.+)$/i))) {
    body = `能帮我们报一下 ${translateSpecFragment(m[1])} 的价格吗`;
  } else if ((m = rest.match(/^(?:please\s+)?quote\s+(.+?)\s+only$/i))) {
    body = `请只报 ${translateSpecFragment(m[1])} 的价格`;
  } else if ((m = rest.match(/^(?:please\s+)?(?:quote|price)\s+(.+)$/i))) {
    body = `请报 ${translateSpecFragment(m[1])} 的价格`;
  } else if ((m = rest.match(/^(?:we\s+)?need\s+(.+)$/i))) {
    body = `我们需要 ${translateSpecFragment(m[1])}`;
  } else if ((m = rest.match(/^let'?s\s+go\s+with\s+(.+)$/i))) {
    body = `我们确定选用 ${translateSpecFragment(m[1])}`;
  } else if ((m = rest.match(/^(?:make\s+it|go\s+with|use)\s+(.+)$/i))) {
    body = `确定按 ${translateSpecFragment(m[1])}`;
  } else if ((m = rest.match(/^quantity\s*(?:is|:)\s*(.+)$/i))) {
    body = `采购数量为 ${translateSpecFragment(m[1])}`;
  } else if ((m = rest.match(/^tolerance\s*(?:is|:)\s*(.+)$/i))) {
    body = `公差要求为 ${translateSpecFragment(m[1])}`;
  } else if (/^please\s+send\s+(?:your\s+)?best\s+price(?:\s+soon)?$/i.test(rest)) {
    body = '请尽快发来最优报价';
  } else if ((m = rest.match(/^please\s+send\s+(?:your\s+)?best\s+price(?:\s+soon)?[,;\s]+(.+)$/i))) {
    body = `请尽快发来最优报价，${translateSpecFragment(m[1])}`;
  } else {
    body = translateSpecFragment(rest);
  }

  // Handle inline "also price X" if inside a compound sentence like "C260, also price 1,500"
  body = body.replace(/\balso\s+(?:price|quote)\s+(\d{1,3}(?:,\d{3})+|\d+)/gi, '顺便也报一下 $1 个的价格');

  const endPunct = isQuestion ? (body.endsWith('吗') ? '？' : '？') : '。';
  const cleanedBody = body
    .replace(/([\u4e00-\u9fa5])\s+([\u4e00-\u9fa5])/g, '$1$2')
    .replace(/[。？，]+$/, '');
  return `${greetingZh}${cleanedBody}${endPunct}`;
}

function splitSentencesPreservingPunct(text: string): Array<{ raw: string; isQuestion: boolean }> {
  const results: Array<{ raw: string; isQuestion: boolean }> = [];
  const regex = /([^?!\n]+?(?:(?<!\d)\.(?=\s|$|\n|["'])|[?!]+|\n+|$))/g;
  for (const m of text.matchAll(regex)) {
    const chunk = m[1].trim();
    if (!chunk) continue;
    const isQuestion = chunk.endsWith('?');
    const stripped = chunk.replace(/[.?!]+$/, '').trim();
    if (stripped) {
      results.push({ raw: stripped, isQuestion });
    }
  }
  return results;
}

function buildFallbackSummaryFromExtracted(extracted?: ExtractedRoundData): string {
  if (!extracted) return '';
  const bits: string[] = [];
  if (extracted.quantity?.values.length) {
    bits.push(`数量 ${extracted.quantity.values.map((v) => v.toLocaleString('en-US')).join('/')}`);
  }
  if (extracted.material?.grade || extracted.material?.zhFamily) {
    bits.push(`${extracted.material.zhFamily || ''} ${extracted.material.grade || ''}`.trim());
  }
  if (extracted.thickness?.valueDisplay) {
    bits.push(`厚度 ${extracted.thickness.valueDisplay}`);
  }
  if (extracted.surfaceFinish?.valueDisplay) {
    bits.push(`表面 ${extracted.surfaceFinish.valueDisplay}`);
  }
  return bits.length > 0 ? `（识别要点：${bits.join('、')}）` : '';
}

export function translateRfqRoundToChinese(text: string, extracted?: ExtractedRoundData): string {
  const trimmed = text.trim();
  if (!trimmed) return '';

  const sentences = splitSentencesPreservingPunct(trimmed);
  if (sentences.length === 0) return '';

  const translatedSentences = sentences.map((s) => translateSingleRfqSentence(s.raw, s.isQuestion));
  let joined = translatedSentences.join('');

  // Check if significant unknown English prose remained untranslated
  const leftoverWords = joined
    .replace(/\b(RAL|STEP|DXF|DWG|PDF|CAD|PEM|FOB|EXW|CIF|DDP|DAP|FCA|ISO|SPCC|SGCC|SECC|SUS|SS|AL|Gauge|Shenzhen|Ningbo)\b/gi, '')
    .match(/\b[a-zA-Z]{4,}\b/g);

  if (leftoverWords && leftoverWords.length >= 4) {
    const hint = buildFallbackSummaryFromExtracted(extracted);
    if (hint && !joined.includes(hint)) {
      joined = `${joined} ${hint}`;
    }
  }

  return joined;
}

const REPLY_QUESTION_ZH_MAP: Array<[RegExp, string]> = [
  [/which\s+stainless\s+steel\s+grade\s+is\s+required/i, '不锈钢具体需要哪个牌号（例如 304、316L 或 201）？'],
  [/which\s+aluminum\s+alloy\s+and\s+temper/i, '铝合金具体需要哪个牌号及状态（如折弯常用的 5052-H32 或 6061-T6）？'],
  [/confirm\s+the\s+specific\s+steel\s+grade/i, '请问具体用哪一种钢板（如 SPCC 冷轧板、SGCC 镀锌板或 Q235）？'],
  [/which\s+brass\s+alloy/i, '黄铜具体用哪个牌号和软硬状态（如 C260 / H62）？'],
  [/which\s+copper\/brass\s+grade/i, '铜材具体用紫铜（C110/T2）还是黄铜（C260/H62）？'],
  [/confirm\s+the\s+required\s+material\s+and\s+grade/i, '请确认零件用的金属材料和具体牌号（如 304 不锈钢、5052 铝或 SPCC）？'],
  [/unable\s+to\s+locate\s+the\s+previous\s+material/i, '旧单里没查到之前的材料记录，麻烦重新确认一下材质与牌号？'],
  [/could\s+not\s+locate\s+the\s+thickness\s+from\s+your\s+previous\s+order/i, '老订单里没查到上次的板厚记录，麻烦再确认一下板厚（毫米或 Gauge）？'],
  [/what\s+sheet\s+thickness\s+is\s+required/i, '金属板需要做多厚（多少毫米或 Gauge）？'],
  [/should\s+we\s+quote\s+for\s+([\d,]+)\s+pcs\s+only,?\s+or\s+would\s+you\s+like\s+tiered\s+pricing\s+for\s+both\s+([\d,]+)\s+and\s+([\d,]+)\s+pcs/i, '请问是只按 $1 个报价，还是 $2 和 $3 个两个数量都要报？'],
  [/clarify\s+whether\s+you\s+need\s+tiered\s+quotes\s+for\s+(.+?)\s+pcs\s+or\s+only\s+one/i, '请问您是要按 $1 个分档报价，还是只按其中一个数量报？'],
  [/what\s+quantity\s+\(or\s+price-break\s+quantities\)/i, '请问大概打算做多少个（单个数量或几个分档数量）？'],
  [/send\s+the\s+part\s+drawing\s+or\s+3d\s+cad\s+file/i, '请把零件图纸或 3D 文件（STEP、DXF 或带尺寸 PDF）发给我们？'],
  [/share\s+a\s+3d\s+step\s+file\s+or\s+dimensioned\s+2d\s+drawing/i, '能否提供 3D STEP 文件或带完整尺寸的 2D 图纸（DXF/PDF）以便评估展开和折弯？'],
  [/could\s+not\s+verify\s+the\s+latest\s+drawing\s+revision/i, '旧单图纸没核对到最新版次，麻烦把现在的 2D/3D 图再发一下？'],
  [/between\s+(.+?),\s+which\s+finish\s+do\s+you\s+prefer/i, '在这两种表面做法里，您最终选哪一种（还是要两种都报价格对比），以及有指定颜色或 RAL 色号吗？'],
  [/for\s+the\s+powder\s+coating,\s+could\s+you\s+confirm\s+the\s+color/i, '静电喷粉请问需要什么颜色或 RAL 色号，以及哑光还是亮光纹理？'],
  [/since\s+mild\/carbon\s+steel\s+requires\s+rust\s+protection/i, '碳钢容易生锈，表面需要哪种防锈做法（如镀锌、喷粉或仅涂防锈油）？'],
  [/require\s+any\s+specific\s+surface\s+finish/i, '表面需要拉丝、氧化或喷粉等工艺，还是本色去毛刺出货？'],
  [/which\s+specific\s+dimensions\s+or\s+bends\s+require\s+tight\s+tolerance/i, '具体是哪几个尺寸或折弯需要紧公差，允许误差是多少（如 ±0.1 mm）？'],
  [/what\s+is\s+your\s+target\s+delivery\s+date\s+and\s+preferred\s+incoterm/i, '请问期望交期是什么时候，按哪种贸易条款报（如 EXW 或 FOB）？'],
];

function translateReplyLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) return '';

  if (/^dear\s+customer,?$/i.test(trimmed)) return '尊敬的客户：';
  if (/^hi,?$/i.test(trimmed)) return '您好：';
  if (/^best\s+regards,?$/i.test(trimmed)) return '祝好，';
  if (/^sales\s+engineering\s+team$/i.test(trimmed)) return '销售工程团队';
  if (/^sales\s+team$/i.test(trimmed)) return '销售团队';

  // Numbered or bulleted question line
  const qMatch = trimmed.match(/^(\d+\.|-)\s+(.+)$/);
  if (qMatch) {
    const prefix = qMatch[1] === '-' ? '·' : qMatch[1];
    const qBody = qMatch[2];
    for (const [pat, zh] of REPLY_QUESTION_ZH_MAP) {
      const pm = qBody.match(pat);
      if (pm) {
        let out = zh;
        if (pm[1]) out = out.replace('$1', pm[1]);
        if (pm[2]) out = out.replace('$2', pm[2]);
        if (pm[3]) out = out.replace('$3', pm[3]);
        return `${prefix} ${out}`;
      }
    }
    return `${prefix} ${translateRfqRoundToChinese(qBody)}`;
  }

  // Paragraph with multiple sentences
  const sentences = splitSentencesPreservingPunct(trimmed);
  const zhSentences: string[] = [];

  for (const { raw, isQuestion } of sentences) {
    let m: RegExpMatchArray | null;
    if (/^thank\s+you\s+very\s+much\s+for\s+your\s+rfq$/i.test(raw)) {
      zhSentences.push('非常感谢您的询价！');
    } else if (/^thank\s+you\s+for\s+your\s+inquiry$/i.test(raw)) {
      zhSentences.push('感谢您的询价。');
    } else if ((m = raw.match(/^we\s+have\s+noted\s+your\s+request\s+for\s+(.+)$/i))) {
      zhSentences.push(`我们已经记下您需要采购 ${translateSpecFragment(m[1])}。`);
    } else if (
      (m = raw.match(
        /^per\s+our\s+previous\s+order\s+record(?:\s*\(([^)]+)\))?,\s*the\s+(.+?)\s+was\s+(.+?)—please\s+let\s+us\s+know\s+if\s+we\s+should\s+proceed\s+with\s+(.+?)\s+for\s+this\s+quote$/i,
      ))
    ) {
      const orderTag = m[1] ? `（${m[1]}）` : '';
      const fieldZh = m[2]
        .replace(/sheet\s+thickness/i, '板材厚度')
        .replace(/material/i, '材料')
        .replace(/surface\s+finish/i, '表面处理')
        .replace(/drawing/i, '图纸版本');
      const valZh = translateSpecFragment(m[3]);
      zhSentences.push(`核对我们上次订单记录${orderTag}，${fieldZh}为 ${valZh}——请确认本次报价是否沿用该规格。`);
    } else if (
      (m = raw.match(
        /^per\s+our\s+previous\s+order\s+record\s*\(([^)]+)\),\s*please\s+confirm\s+if\s+all\s+specifications\s+remain\s+unchanged\s+for\s+this\s+quote$/i,
      ))
    ) {
      const labeled = m[1]
        .replace(/\bmaterial\b/gi, '材料')
        .replace(/\bsheet\s+thickness\b/gi, '板厚')
        .replace(/\bsurface\s+finish\b/gi, '表面')
        .replace(/\bdrawing\b/gi, '图纸');
      const detailZh = translateSpecFragment(labeled);
      zhSentences.push(`核对我们上次订单记录（${detailZh}），请确认本次报价是否全部沿用原规格不变。`);
    } else if (/^once\s+you\s+confirm,\s+we\s+will\s+send\s+over\s+our\s+formal\s+quotation\s+promptly$/i.test(raw)) {
      zhSentences.push('收到您的确认后，我们会立即发出正式报价。');
    } else if (
      (m = raw.match(
        /^we\s+are\s+checking\s+our\s+previous\s+order\s+records\s+on\s+our\s+side\s+to\s+confirm\s+the\s+(.+)$/i,
      ))
    ) {
      const targetZh = m[1]
        .replace(/sheet\s+thickness/gi, '板厚')
        .replace(/material\s+grade/gi, '材料牌号')
        .replace(/drawing\s+revision/gi, '图纸版本')
        .replace(/surface\s+finish/gi, '表面做法');
      zhSentences.push(`我们正在内部翻查您上次订单的${targetZh}记录（不用麻烦您重发）。`);
    } else if (/^we\s+will\s+review\s+the\s+design\s+and\s+send\s+over\s+our\s+formal\s+quotation\s+as\s+soon\s+as\s+your\s+drawing\s+arrives$/i.test(raw)) {
      zhSentences.push('等您的图纸发来后，我们会第一时间评估并发送正式报价。');
    } else if (/^our\s+engineering\s+team\s+is\s+reviewing\s+your\s+attached\s+drawing/i.test(raw)) {
      zhSentences.push('工程团队正在查看您附件里的图纸，很快会把报价发给您。');
    } else if (/^we\s+will\s+prepare\s+our\s+quotation\s+based\s+on\s+these\s+verified\s+details/i.test(raw)) {
      zhSentences.push('我们会按这些确认好的信息核算报价并尽快发给您。');
    } else if (/^we\s+have\s+received\s+your\s+inquiry/i.test(raw)) {
      zhSentences.push('我们已收到您的询价，将尽快跟进报价。');
    } else if (/^(?:before\s+we\s+finalize|to\s+prepare)\s+an\s+accurate\s+quot(?:e|ation),?\s+could\s+you\s+(?:kindly|please)\s+(?:clarify|confirm)\s+(?:one\s+(?:quick\s+)?point|the\s+following)/i.test(raw)) {
      zhSentences.push('为了给您算准价格，麻烦帮忙确认以下问题：');
    } else if (/^once\s+we\s+have\s+this\s+information\s+and\s+your\s+drawing/i.test(raw)) {
      zhSentences.push('收到以上确认信息和您的图纸后，我们会立即为您正式报价。');
    } else if (/^once\s+confirmed,\s+we\s+will\s+get\s+back\s+to\s+you/i.test(raw)) {
      zhSentences.push('收到确认后，我们会立即发送正式报价。');
    } else if (/^looking\s+forward\s+to\s+your\s+drawing$/i.test(raw)) {
      zhSentences.push('期待您的图纸。');
    } else if (/^please\s+feel\s+free\s+to\s+send\s+the\s+drawing/i.test(raw)) {
      zhSentences.push('图纸准备好后随时发给我们就行。');
    } else if (/^please\s+let\s+us\s+know\s+if\s+there\s+are\s+any\s+additional\s+requirements$/i.test(raw)) {
      zhSentences.push('如有其他补充要求，请随时告诉我们。');
    } else {
      zhSentences.push(translateSingleRfqSentence(raw, isQuestion));
    }
  }

  return zhSentences.join('');
}

export function translateReplyToChinese(replyText: string): string {
  const trimmed = replyText.trim();
  if (!trimmed) return '';

  return trimmed
    .split('\n')
    .map((line) => translateReplyLine(line))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
