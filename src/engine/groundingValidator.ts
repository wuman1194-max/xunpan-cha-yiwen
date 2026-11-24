import type { EmailRound, EvidenceSpan, ExtractedRoundData, FieldKey } from '../types/rfq';

function findExactSpanInRound(
  round: EmailRound,
  quote: string,
  fieldKey: FieldKey,
): EvidenceSpan | null {
  const trimmed = quote.trim();
  if (!trimmed) return null;

  const exactIdx = round.text.indexOf(trimmed);
  if (exactIdx !== -1) {
    return {
      roundId: round.id,
      roundNumber: round.roundNumber,
      quote: round.text.slice(exactIdx, exactIdx + trimmed.length),
      start: exactIdx,
      end: exactIdx + trimmed.length,
      fieldKey,
    };
  }

  const lowerIdx = round.text.toLowerCase().indexOf(trimmed.toLowerCase());
  if (lowerIdx !== -1) {
    return {
      roundId: round.id,
      roundNumber: round.roundNumber,
      quote: round.text.slice(lowerIdx, lowerIdx + trimmed.length),
      start: lowerIdx,
      end: lowerIdx + trimmed.length,
      fieldKey,
    };
  }

  return null;
}

function validateQuotes(
  round: EmailRound,
  fieldKey: FieldKey,
  rawQuotes: unknown,
): { spans: EvidenceSpan[]; rejectedCount: number } {
  if (!Array.isArray(rawQuotes)) return { spans: [], rejectedCount: 0 };
  const spans: EvidenceSpan[] = [];
  let rejectedCount = 0;

  for (const item of rawQuotes) {
    const q = typeof item === 'string' ? item : typeof item === 'object' && item && 'quote' in item ? String((item as { quote: unknown }).quote) : '';
    if (!q.trim()) continue;
    const found = findExactSpanInRound(round, q, fieldKey);
    if (found) {
      spans.push(found);
    } else {
      rejectedCount += 1;
    }
  }
  return { spans, rejectedCount };
}

export interface GroundingValidationOutcome {
  rounds: ExtractedRoundData[];
  ungroundedBlockedCount: number;
}

/**
 * Validates LLM extraction JSON strictly against verbatim round text.
 * Any value lacking a verbatim evidence quote inside the corresponding round is stripped
 * so an LLM cannot hallucinate default specs (e.g., 304, 5052, 1.5 mm).
 */
export function validateAndGroundLlmOutput(
  rounds: EmailRound[],
  rawLlmPayload: unknown,
): GroundingValidationOutcome {
  const payloadObj = (rawLlmPayload && typeof rawLlmPayload === 'object' ? rawLlmPayload : {}) as Record<string, unknown>;
  const rawRounds = Array.isArray(payloadObj.rounds) ? payloadObj.rounds : [];

  let ungroundedBlockedCount = 0;
  const validatedRounds: ExtractedRoundData[] = [];

  for (const round of rounds) {
    const rawRound = (rawRounds.find(
      (r) => r && typeof r === 'object' && Number((r as Record<string, unknown>).roundNumber) === round.roundNumber,
    ) || {}) as Record<string, unknown>;

    const extracted: ExtractedRoundData = {
      roundId: round.id,
      roundNumber: round.roundNumber,
      zhTranslation: rawRound.zhTranslation ? String(rawRound.zhTranslation).trim() : undefined,
      scopeWarnings: Array.isArray(rawRound.scopeWarnings)
        ? rawRound.scopeWarnings.map((s) => String(s)).filter(Boolean)
        : [],
    };

    // PartType
    if (rawRound.partType && typeof rawRound.partType === 'object') {
      const pt = rawRound.partType as Record<string, unknown>;
      const { spans, rejectedCount } = validateQuotes(round, 'partType', pt.quotes);
      ungroundedBlockedCount += rejectedCount;
      if (spans.length > 0 && pt.value) {
        extracted.partType = {
          value: String(pt.value),
          zhLabel: String(pt.zhLabel || pt.value),
          evidence: spans,
        };
      } else if (pt.value) {
        ungroundedBlockedCount += 1;
      }
    }

    // Material
    if (rawRound.material && typeof rawRound.material === 'object') {
      const mat = rawRound.material as Record<string, unknown>;
      const { spans, rejectedCount } = validateQuotes(round, 'material', mat.quotes);
      ungroundedBlockedCount += rejectedCount;

      const joinedQuotes = spans.map((s) => s.quote).join(' ').toLowerCase();
      let grade = mat.grade ? String(mat.grade).trim() : undefined;
      if (grade && !joinedQuotes.includes(grade.toLowerCase().replace(/^sus|^ss|^al/, ''))) {
        // LLM invented a grade not present in its quoted text
        ungroundedBlockedCount += 1;
        grade = undefined;
      }

      if (spans.length > 0 && (mat.family || grade || mat.isHistoryRef)) {
        extracted.material = {
          family: mat.family ? String(mat.family) : undefined,
          zhFamily: mat.zhFamily ? String(mat.zhFamily) : undefined,
          grade,
          isHistoryRef: Boolean(mat.isHistoryRef),
          evidence: spans,
        };
      } else if (mat.family || grade) {
        ungroundedBlockedCount += 1;
      }
    }

    // Thickness
    if (rawRound.thickness && typeof rawRound.thickness === 'object') {
      const thk = rawRound.thickness as Record<string, unknown>;
      const { spans, rejectedCount } = validateQuotes(round, 'thickness', thk.quotes);
      ungroundedBlockedCount += rejectedCount;

      const joinedQuotes = spans.map((s) => s.quote).join(' ').toLowerCase();
      let valueDisplay = thk.valueDisplay ? String(thk.valueDisplay).trim() : undefined;
      if (valueDisplay) {
        const numMatch = valueDisplay.match(/\d+(?:\.\d+)?/);
        if (!numMatch || !joinedQuotes.includes(numMatch[0])) {
          ungroundedBlockedCount += 1;
          valueDisplay = undefined;
        }
      }

      if (spans.length > 0 && (valueDisplay || thk.isHistoryRef)) {
        extracted.thickness = {
          valueDisplay,
          isHistoryRef: valueDisplay ? false : Boolean(thk.isHistoryRef),
          evidence: spans,
        };
      } else if (valueDisplay || thk.isHistoryRef) {
        ungroundedBlockedCount += 1;
      }
    }

    // Quantity
    if (rawRound.quantity && typeof rawRound.quantity === 'object') {
      const qty = rawRound.quantity as Record<string, unknown>;
      const { spans, rejectedCount } = validateQuotes(round, 'quantity', qty.quotes);
      ungroundedBlockedCount += rejectedCount;
      const values = Array.isArray(qty.values)
        ? qty.values.map((v) => Number(v)).filter((n) => Number.isFinite(n) && n > 0)
        : [];
      const mode = String(qty.mode || 'single') as NonNullable<ExtractedRoundData['quantity']>['mode'];

      if (spans.length > 0 && (values.length > 0 || mode === 'confirm_previous')) {
        extracted.quantity = {
          values,
          mode,
          isOnly: Boolean(qty.isOnly),
          evidence: spans,
        };
      } else if (values.length > 0) {
        ungroundedBlockedCount += 1;
      }
    }

    // Drawing
    if (rawRound.drawing && typeof rawRound.drawing === 'object') {
      const drw = rawRound.drawing as Record<string, unknown>;
      const { spans, rejectedCount } = validateQuotes(round, 'drawing', drw.quotes);
      ungroundedBlockedCount += rejectedCount;
      const state = String(drw.state || 'missing') as NonNullable<ExtractedRoundData['drawing']>['state'];
      if (state !== 'missing' && spans.length === 0) {
        ungroundedBlockedCount += 1;
      } else if (spans.length > 0) {
        extracted.drawing = {
          state,
          formatDetail: drw.formatDetail ? String(drw.formatDetail) : undefined,
          evidence: spans,
        };
      }
    }

    // Surface finish
    if (rawRound.surfaceFinish && typeof rawRound.surfaceFinish === 'object') {
      const sf = rawRound.surfaceFinish as Record<string, unknown>;
      const { spans, rejectedCount } = validateQuotes(round, 'surfaceFinish', sf.quotes);
      ungroundedBlockedCount += rejectedCount;
      if (spans.length > 0) {
        extracted.surfaceFinish = {
          valueDisplay: sf.valueDisplay ? String(sf.valueDisplay) : undefined,
          zhLabel: sf.zhLabel ? String(sf.zhLabel) : undefined,
          isChoiceAmbiguous: Boolean(sf.isChoiceAmbiguous),
          choiceOptions: Array.isArray(sf.choiceOptions) ? sf.choiceOptions.map(String) : undefined,
          missingColorDetail: Boolean(sf.missingColorDetail),
          isExplicitRaw: Boolean(sf.isExplicitRaw),
          isHistoryRef: Boolean(sf.isHistoryRef),
          evidence: spans,
        };
      } else if (sf.valueDisplay) {
        ungroundedBlockedCount += 1;
      }
    }

    // Tolerance & features
    if (rawRound.toleranceAndFeatures && typeof rawRound.toleranceAndFeatures === 'object') {
      const tf = rawRound.toleranceAndFeatures as Record<string, unknown>;
      const { spans, rejectedCount } = validateQuotes(round, 'toleranceAndFeatures', tf.quotes);
      ungroundedBlockedCount += rejectedCount;
      if (spans.length > 0) {
        extracted.toleranceAndFeatures = {
          numericTolerance: tf.numericTolerance ? String(tf.numericTolerance) : undefined,
          vagueTightTolerance: Boolean(tf.vagueTightTolerance),
          secondaryOps: Array.isArray(tf.secondaryOps) ? tf.secondaryOps.map(String) : [],
          evidence: spans,
        };
      }
    }

    // Delivery terms
    if (rawRound.deliveryTerms && typeof rawRound.deliveryTerms === 'object') {
      const dt = rawRound.deliveryTerms as Record<string, unknown>;
      const { spans, rejectedCount } = validateQuotes(round, 'deliveryTerms', dt.quotes);
      ungroundedBlockedCount += rejectedCount;
      if (spans.length > 0) {
        extracted.deliveryTerms = {
          incoterm: dt.incoterm ? String(dt.incoterm) : undefined,
          leadTime: dt.leadTime ? String(dt.leadTime) : undefined,
          isUrgent: Boolean(dt.isUrgent),
          evidence: spans,
        };
      }
    }

    validatedRounds.push(extracted);
  }

  return { rounds: validatedRounds, ungroundedBlockedCount };
}
