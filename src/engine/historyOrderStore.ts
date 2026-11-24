import { readSheet } from 'read-excel-file/browser';
import { FACTORY_ORDER_CSV_TEMPLATE } from '../data/demoFactoryOrders';
import type { FactoryHistoryOrder, FieldKey, MatchedHistoryOrder } from '../types/rfq';
import type { MergedState } from './merger';

export function parseCsvText(text: string): string[][] {
  const cleaned = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let inQuotes = false;

  for (let i = 0; i < cleaned.length; i += 1) {
    const ch = cleaned[i];
    if (inQuotes) {
      if (ch === '"') {
        if (cleaned[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',' || ch === '\t') {
      row.push(cell.trim());
      cell = '';
    } else if (ch === '\r') {
      if (cleaned[i + 1] === '\n') i += 1;
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else if (ch === '\n') {
      row.push(cell.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += ch;
    }
  }

  row.push(cell.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

export function decodeCsvBuffer(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    try {
      return new TextDecoder('gbk').decode(buffer);
    } catch {
      return new TextDecoder('utf-8').decode(buffer);
    }
  }
}

type ColumnRole =
  | 'orderNo'
  | 'customerName'
  | 'orderDate'
  | 'partName'
  | 'materialSpec'
  | 'thickness'
  | 'surfaceFinish'
  | 'drawingRef'
  | 'notes';

const HEADER_MATCHERS: Array<{ role: ColumnRole; patterns: RegExp[] }> = [
  { role: 'orderNo', patterns: [/单号|订单号|po\b|order\s*no|order\s*#|ref/i] },
  { role: 'customerName', patterns: [/客户|customer|client|company/i] },
  { role: 'orderDate', patterns: [/日期|时间|date/i] },
  { role: 'partName', patterns: [/零件|品名|产品|名称|part/i] },
  { role: 'materialSpec', patterns: [/材料|材质|牌号|material|grade|alloy/i] },
  { role: 'thickness', patterns: [/板厚|厚度|规格|thickness|gauge/i] },
  { role: 'surfaceFinish', patterns: [/表面|工艺|处理|颜色|finish|coating/i] },
  { role: 'drawingRef', patterns: [/图纸|图号|文件|drawing|cad|step|dxf/i] },
  { role: 'notes', patterns: [/备注|说明|note|remark/i] },
];

function detectHeaderMap(headerRow: string[]): Partial<Record<ColumnRole, number>> {
  const map: Partial<Record<ColumnRole, number>> = {};
  headerRow.forEach((rawCell, idx) => {
    const label = rawCell.trim();
    if (!label) return;
    for (const matcher of HEADER_MATCHERS) {
      if (map[matcher.role] !== undefined) continue;
      if (matcher.patterns.some((p) => p.test(label))) {
        map[matcher.role] = idx;
        break;
      }
    }
  });
  return map;
}

function cellToString(val: unknown): string {
  if (val === null || val === undefined) return '';
  if (val instanceof Date) {
    return val.toISOString().slice(0, 10);
  }
  return String(val).trim();
}

export function rowsToFactoryOrders(rawRows: unknown[][]): {
  orders: FactoryHistoryOrder[];
  warnings: string[];
} {
  const warnings: string[] = [];
  const cleanedRows = rawRows
    .map((r) => r.map(cellToString))
    .filter((r) => r.some((c) => c.length > 0));

  if (cleanedRows.length < 2) {
    return {
      orders: [],
      warnings: ['表格至少需要 1 行表头和 1 行数据记录。'],
    };
  }

  const headerMap = detectHeaderMap(cleanedRows[0]);
  const hasAnyRecognizedHeader =
    headerMap.orderNo !== undefined ||
    headerMap.partName !== undefined ||
    headerMap.materialSpec !== undefined ||
    headerMap.thickness !== undefined;

  if (!hasAnyRecognizedHeader) {
    warnings.push('未识别出标准表头，已按默认列顺序（单号、客户、日期、零件、材料、板厚、表面、图纸、备注）读取。');
    headerMap.orderNo = 0;
    headerMap.customerName = 1;
    headerMap.orderDate = 2;
    headerMap.partName = 3;
    headerMap.materialSpec = 4;
    headerMap.thickness = 5;
    headerMap.surfaceFinish = 6;
    headerMap.drawingRef = 7;
    headerMap.notes = 8;
  }

  const orders: FactoryHistoryOrder[] = [];
  for (let i = 1; i < cleanedRows.length; i += 1) {
    const row = cleanedRows[i];
    const pick = (role: ColumnRole): string => {
      const idx = headerMap[role];
      return idx !== undefined && idx < row.length ? row[idx] : '';
    };

    const orderNo = pick('orderNo') || `OLD-${String(i).padStart(3, '0')}`;
    const partName = pick('partName');
    const materialSpec = pick('materialSpec');
    const thickness = pick('thickness');
    const surfaceFinish = pick('surfaceFinish');

    if (!partName && !materialSpec && !thickness && !surfaceFinish) {
      continue;
    }

    orders.push({
      id: `imported-${Date.now()}-${i}`,
      orderNo,
      customerName: pick('customerName') || undefined,
      orderDate: pick('orderDate') || undefined,
      partName: partName || '未命名零件',
      materialSpec,
      thickness,
      surfaceFinish,
      drawingRef: pick('drawingRef') || undefined,
      notes: pick('notes') || undefined,
    });
  }

  if (orders.length === 0) {
    warnings.push('未在表格中找到包含零件/材料/厚度信息的有效旧单行。');
  }

  return { orders, warnings };
}

export async function parseFactoryOrderFile(file: File): Promise<{
  orders: FactoryHistoryOrder[];
  warnings: string[];
}> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt')) {
    const buffer = await file.arrayBuffer();
    const text = decodeCsvBuffer(buffer);
    const rows = parseCsvText(text);
    return rowsToFactoryOrders(rows);
  }

  if (name.endsWith('.xlsx')) {
    const rows = await readSheet(file);
    return rowsToFactoryOrders(rows as unknown[][]);
  }

  if (name.endsWith('.xls')) {
    throw new Error('暂不支持旧版 .xls 二进制格式，请在 Excel/WPS 中“另存为 .xlsx 或 .csv”后再导入。');
  }

  throw new Error('仅支持 .xlsx 或 .csv 格式的工厂旧单表格。');
}

export function downloadFactoryOrderCsvTemplate(): void {
  const blob = new Blob([FACTORY_ORDER_CSV_TEMPLATE], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = '工厂旧单导入模板.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function normalizeSearchBlob(order: FactoryHistoryOrder): string {
  return [
    order.orderNo,
    order.customerName,
    order.partName,
    order.materialSpec,
    order.thickness,
    order.surfaceFinish,
    order.drawingRef,
    order.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function matchHistoryOrders(
  orders: FactoryHistoryOrder[],
  mergedState: MergedState,
  rawEmailText = '',
): MatchedHistoryOrder[] {
  if (orders.length === 0) return [];
  const s = mergedState.internalState;
  const emailLower = rawEmailText.toLowerCase();

  const matches: MatchedHistoryOrder[] = [];

  for (const order of orders) {
    const blob = normalizeSearchBlob(order);
    let score = 0;
    const matchedReasons: string[] = [];

    // 1. Explicit PO/Order number mention
    if (order.orderNo && emailLower.includes(order.orderNo.toLowerCase())) {
      score += 10;
      matchedReasons.push(`单号命中 ${order.orderNo}`);
    }

    // 2. Part type match
    const partWords: string[] = [];
    if (s.partTypeEn) {
      const singular = s.partTypeEn.toLowerCase().replace(/s$/, '');
      partWords.push(s.partTypeEn.toLowerCase(), singular);
    }
    if (s.partTypeZh) {
      partWords.push(s.partTypeZh.toLowerCase());
      if (s.partTypeZh.includes('支架')) partWords.push('支架');
      if (s.partTypeZh.includes('外壳')) partWords.push('外壳');
      if (s.partTypeZh.includes('安装板')) partWords.push('安装板');
    }
    if (partWords.some((w) => w && blob.includes(w))) {
      score += 4;
      matchedReasons.push(`零件类型一致（${s.partTypeZh || s.partTypeEn}）`);
    }

    // 3. Material family match
    if (s.materialFamily) {
      const famChecks: string[] = [s.materialFamily.toLowerCase()];
      if (s.materialZhFamily) famChecks.push(s.materialZhFamily.toLowerCase());
      if (s.materialFamily === 'stainless steel') famChecks.push('不锈钢', '304', '316');
      if (s.materialFamily === 'aluminum') famChecks.push('铝', '5052', '6061');
      if (s.materialFamily === 'carbon steel') famChecks.push('碳钢', '冷轧', 'spcc', 'sgcc', 'q235');
      if (famChecks.some((w) => blob.includes(w))) {
        score += 3;
        matchedReasons.push(`金属大类一致（${s.materialZhFamily || s.materialFamily}）`);
      }
    }

    // 4. Surface finish match
    if (s.surfaceDisplay) {
      const sfTokens = [s.surfaceDisplay.toLowerCase()];
      if (s.surfaceDisplay.includes('拉丝')) sfTokens.push('brushed', '拉丝');
      if (s.surfaceDisplay.includes('喷粉')) sfTokens.push('powder', '喷粉');
      if (s.surfaceDisplay.includes('氧化')) sfTokens.push('anodiz', '氧化');
      if (s.surfaceDisplay.includes('镀锌')) sfTokens.push('zinc', '镀锌');
      if (sfTokens.some((w) => blob.includes(w))) {
        score += 2;
        matchedReasons.push(`表面工艺一致（${s.surfaceDisplay}）`);
      }
    }

    if (score > 0 || (orders.length <= 5 && matchedReasons.length === 0)) {
      matches.push({
        order,
        score,
        matchedReasons: matchedReasons.length > 0 ? matchedReasons : ['库内历史订单（可按需核对）'],
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score);
}

export function extractFieldValueFromOrder(order: FactoryHistoryOrder, fieldKey: FieldKey): string | undefined {
  switch (fieldKey) {
    case 'material':
      return order.materialSpec?.trim() || undefined;
    case 'thickness':
      return order.thickness?.trim() || undefined;
    case 'surfaceFinish':
      return order.surfaceFinish?.trim() || undefined;
    case 'drawing':
      return order.drawingRef?.trim() || undefined;
    default:
      return undefined;
  }
}
