import type { ClarificationQuestion, FieldKey, HistoryResolution, MergedField, ReplyTone } from '../types/rfq';
import type { MergedState } from './merger';

function formatEnglishQuantityList(values: number[]): string {
  const formatted = values.map((v) => v.toLocaleString('en-US'));
  if (formatted.length === 1) return `${formatted[0]} pcs`;
  if (formatted.length === 2) return `both ${formatted[0]} and ${formatted[1]} pcs`;
  const last = formatted[formatted.length - 1];
  return `${formatted.slice(0, -1).join(', ')}, and ${last} pcs`;
}

function buildConfirmedSummaryClause(merged: MergedState): string {
  const s = merged.internalState;
  const parts: string[] = [];

  if (s.quantityValues.length >= 2 && s.quantityMode === 'tiered') {
    parts.push(formatEnglishQuantityList(s.quantityValues));
  } else if (s.quantityValues.length === 1 && s.quantityMode === 'single') {
    parts.push(formatEnglishQuantityList(s.quantityValues));
  }

  const matBits: string[] = [];
  if (s.surfaceDisplay && !s.surfaceChoiceAmbiguous && !s.surfaceMissingColor) {
    const sfEn =
      merged.fields.surfaceFinish.evidence[0]?.quote ||
      (/brushed/i.test(s.surfaceDisplay) ? 'brushed' : s.surfaceDisplay);
    matBits.push(sfEn);
  }
  if (s.materialGrade && s.materialFamily) {
    matBits.push(`${s.materialGrade} ${s.materialFamily}`);
  } else if (s.materialGrade) {
    matBits.push(s.materialGrade);
  } else if (s.materialFamily) {
    matBits.push(s.materialFamily);
  }

  if (s.thicknessDisplay) {
    matBits.push(`(${s.thicknessDisplay})`);
  }

  const partLabel = s.partTypeEn || 'sheet metal parts';
  if (matBits.length > 0) {
    const phrase = `${matBits.join(' ')} ${partLabel}`;
    parts.push(parts.length > 0 ? `of ${phrase}` : phrase);
  } else if (s.partTypeEn) {
    parts.push(parts.length > 0 ? `of ${partLabel}` : partLabel);
  }

  return parts.join(' ').trim();
}

const HISTORY_FIELD_EN_NAME: Record<FieldKey, string> = {
  material: 'material',
  thickness: 'sheet thickness',
  surfaceFinish: 'surface finish',
  drawing: 'drawing',
  quantity: 'quantity',
  partType: 'part type',
  toleranceAndFeatures: 'tolerance',
  deliveryTerms: 'delivery terms',
};

function sanitizeHistoryValueForEnglish(rawValue: string): string {
  // If user/demo row has "拉丝 (brushed)", extract English part inside parens when present alongside Chinese
  const parenEnglish = rawValue.match(/[\u4e00-\u9fa5]+\s*\(([A-Za-z0-9\s.,_-]+)\)/);
  if (parenEnglish && parenEnglish[1]) {
    return parenEnglish[1].trim();
  }
  return rawValue.trim();
}

function buildResolvedHistorySentence(
  merged: MergedState,
  resolvedHistoryValues: Partial<Record<FieldKey, HistoryResolution>>,
): string | null {
  const s = merged.internalState;
  const candidateKeys: FieldKey[] = [];
  if (s.materialHistory && !s.materialGrade && !s.materialFamily && resolvedHistoryValues.material?.value.trim()) {
    candidateKeys.push('material');
  }
  if (s.thicknessHistory && !s.thicknessDisplay && resolvedHistoryValues.thickness?.value.trim()) {
    candidateKeys.push('thickness');
  }
  if (s.surfaceHistory && !s.surfaceDisplay && resolvedHistoryValues.surfaceFinish?.value.trim()) {
    candidateKeys.push('surfaceFinish');
  }
  if (s.drawingState === 'check_history' && resolvedHistoryValues.drawing?.value.trim()) {
    candidateKeys.push('drawing');
  }

  if (candidateKeys.length === 0) return null;

  const firstRes = resolvedHistoryValues[candidateKeys[0]]!;
  const orderRef = firstRes.orderNo ? ` (${firstRes.orderNo})` : '';

  if (candidateKeys.length === 1) {
    const key = candidateKeys[0];
    const val = sanitizeHistoryValueForEnglish(firstRes.value);
    const label = HISTORY_FIELD_EN_NAME[key];
    return `Per our previous order record${orderRef}, the ${label} was ${val}—please let us know if we should proceed with ${val} for this quote.`;
  }

  const summaryBits = candidateKeys.map((k) => {
    const r = resolvedHistoryValues[k]!;
    return `${HISTORY_FIELD_EN_NAME[k]} ${sanitizeHistoryValueForEnglish(r.value)}`;
  });
  const prefix = firstRes.orderNo ? ` (${firstRes.orderNo}: ` : ' (';
  return `Per our previous order record${prefix}${summaryBits.join(', ')}), please confirm if all specifications remain unchanged for this quote.`;
}

export function generateEnglishReply(
  merged: MergedState,
  selectedQuestions: ClarificationQuestion[],
  historyCheckItems: MergedField[],
  askCustomerForHistoryFields: Record<string, boolean>,
  tone: ReplyTone = 'concise',
  resolvedHistoryValues: Partial<Record<FieldKey, HistoryResolution>> = {},
): string {
  const s = merged.internalState;
  const greeting =
    tone === 'polite'
      ? 'Dear Customer,\n\nThank you very much for your RFQ.'
      : 'Hi,\n\nThank you for your inquiry.';
  const verifiedClause = buildConfirmedSummaryClause(merged);

  const ackLines: string[] = [];
  if (verifiedClause) {
    ackLines.push(`We have noted your request for ${verifiedClause}.`);
  }

  const resolvedHistorySentence = buildResolvedHistorySentence(merged, resolvedHistoryValues);
  if (resolvedHistorySentence) {
    ackLines.push(resolvedHistorySentence);
  }

  const activeInternalChecks = historyCheckItems.filter((item) => !askCustomerForHistoryFields[item.key]);
  if (activeInternalChecks.length > 0) {
    const checkTargets = activeInternalChecks
      .map((item) => {
        if (item.key === 'thickness') return 'sheet thickness';
        if (item.key === 'material') return 'material grade';
        if (item.key === 'drawing') return 'drawing revision';
        return 'surface finish';
      })
      .join(', ');
    ackLines.push(`We are checking our previous order records on our side to confirm the ${checkTargets}.`);
  }

  if (s.drawingState === 'pending_customer' && selectedQuestions.length === 0) {
    ackLines.push('We will review the design and send over our formal quotation as soon as your drawing arrives.');
    const closing =
      tone === 'polite'
        ? '\nPlease feel free to send the drawing whenever it is ready.\n\nBest regards,\nSales Engineering Team'
        : '\nLooking forward to your drawing.\n\nBest regards,\nSales Team';
    return `${greeting} ${ackLines.join(' ')}${closing}`;
  }

  if (selectedQuestions.length === 0) {
    if (s.drawingState === 'attached') {
      ackLines.push('Our engineering team is reviewing your attached drawing and will prepare the quotation shortly.');
    } else if (resolvedHistorySentence) {
      ackLines.push('Once you confirm, we will send over our formal quotation promptly.');
    } else if (ackLines.length === 0) {
      ackLines.push('We have received your inquiry and will follow up with our quotation shortly.');
    } else {
      ackLines.push('We will prepare our quotation based on these verified details and get back to you shortly.');
    }
    const closing =
      tone === 'polite'
        ? '\nPlease let us know if there are any additional requirements.\n\nBest regards,\nSales Engineering Team'
        : '\nBest regards,\nSales Team';
    return `${greeting} ${ackLines.join(' ')}${closing}`;
  }

  const introToQuestions =
    selectedQuestions.length === 1
      ? tone === 'polite'
        ? 'Before we finalize an accurate quotation, could you kindly clarify one point:'
        : 'To prepare an accurate quote, could you please confirm one quick point?'
      : tone === 'polite'
        ? 'Before we finalize an accurate quotation, could you kindly clarify the following points:'
        : 'To prepare an accurate quote, could you please confirm the following details?';

  const questionBlock =
    selectedQuestions.length === 1
      ? `- ${selectedQuestions[0].enQuestion}`
      : selectedQuestions.map((q, idx) => `${idx + 1}. ${q.enQuestion}`).join('\n');

  const postNote =
    s.drawingState === 'pending_customer'
      ? '\nOnce we have this information and your drawing, we will send our formal quotation promptly.'
      : '\nOnce confirmed, we will get back to you with our formal quotation promptly.';

  const signOff = tone === 'polite' ? '\n\nBest regards,\nSales Engineering Team' : '\n\nBest regards,\nSales Team';

  const ackSection = ackLines.length > 0 ? ` ${ackLines.join(' ')}` : '';
  return `${greeting}${ackSection}\n\n${introToQuestions}\n${questionBlock}${postNote}${signOff}`;
}
