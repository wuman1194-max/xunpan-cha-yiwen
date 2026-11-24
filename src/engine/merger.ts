import type { EvidenceSpan, ExtractedRoundData, FieldKey, FieldStatus, MergedField } from '../types/rfq';

export interface MergedState {
  fields: Record<FieldKey, MergedField>;
  scopeWarnings: string[];
  internalState: {
    materialFamily?: string;
    materialZhFamily?: string;
    materialGrade?: string;
    materialHistory?: boolean;
    thicknessDisplay?: string;
    thicknessGaugeNumber?: number;
    thicknessHistory?: boolean;
    quantityValues: number[];
    quantityMode: 'missing' | 'single' | 'tiered' | 'revised' | 'ambiguous';
    drawingState: 'missing' | 'attached' | 'sketch_only' | 'pending_customer' | 'check_history';
    drawingFormat?: string;
    surfaceDisplay?: string;
    surfaceChoiceAmbiguous?: boolean;
    surfaceMissingColor?: boolean;
    surfaceHistory?: boolean;
    surfaceExplicitRaw?: boolean;
    numericTolerance?: string;
    vagueTightTolerance?: boolean;
    secondaryOps: string[];
    incoterm?: string;
    leadTime?: string;
    isUrgent?: boolean;
    partTypeZh?: string;
    partTypeEn?: string;
  };
}

function dedupeSpans(spans: EvidenceSpan[]): EvidenceSpan[] {
  const seen = new Set<string>();
  const out: EvidenceSpan[] = [];
  for (const s of spans) {
    const key = `${s.roundId}:${s.start}:${s.end}:${s.fieldKey}`;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(s);
    }
  }
  return out;
}

function formatQtyList(values: number[]): string {
  return values.map((v) => v.toLocaleString('en-US')).join(' / ');
}

export function mergeExtractedRounds(rounds: ExtractedRoundData[]): MergedState {
  const scopeWarnings: string[] = [];

  let partTypeZh: string | undefined;
  let partTypeEn: string | undefined;
  let partEvidence: EvidenceSpan[] = [];
  let partUpdatedRound: number | undefined;

  let matFamily: string | undefined;
  let matZhFamily: string | undefined;
  let matGrade: string | undefined;
  let matHistory = false;
  let matEvidence: EvidenceSpan[] = [];
  let matUpdatedRound: number | undefined;
  let matPrevSummary: string | undefined;

  let thickDisplay: string | undefined;
  let thickGaugeNum: number | undefined;
  let thickHistory = false;
  let thickEvidence: EvidenceSpan[] = [];
  let thickUpdatedRound: number | undefined;
  let thickPrevSummary: string | undefined;

  let qtyValues: number[] = [];
  let qtyMode: 'missing' | 'single' | 'tiered' | 'revised' | 'ambiguous' = 'missing';
  let qtyEvidence: EvidenceSpan[] = [];
  let qtyUpdatedRound: number | undefined;
  let qtyPrevSummary: string | undefined;

  let drwState: 'missing' | 'attached' | 'sketch_only' | 'pending_customer' | 'check_history' = 'missing';
  let drwFormat: string | undefined;
  let drwEvidence: EvidenceSpan[] = [];
  let drwUpdatedRound: number | undefined;
  let drwPrevSummary: string | undefined;

  let sfDisplay: string | undefined;
  let sfChoiceAmbiguous = false;
  let sfMissingColor = false;
  let sfHistory = false;
  let sfExplicitRaw = false;
  let sfEvidence: EvidenceSpan[] = [];
  let sfUpdatedRound: number | undefined;
  let sfPrevSummary: string | undefined;

  let numericTol: string | undefined;
  let vagueTightTol = false;
  const secondaryOps: string[] = [];
  let tolEvidence: EvidenceSpan[] = [];
  let tolUpdatedRound: number | undefined;

  let incoterm: string | undefined;
  let leadTime: string | undefined;
  let isUrgent = false;
  let delEvidence: EvidenceSpan[] = [];
  let delUpdatedRound: number | undefined;

  for (const r of rounds) {
    for (const w of r.scopeWarnings) {
      if (!scopeWarnings.includes(w)) scopeWarnings.push(w);
    }

    if (r.partType) {
      partTypeZh = r.partType.zhLabel;
      partTypeEn = r.partType.value;
      partEvidence = dedupeSpans([...partEvidence, ...r.partType.evidence]);
      if (r.roundNumber > 1) partUpdatedRound = r.roundNumber;
    }

    if (r.material) {
      const prevDesc = matGrade
        ? `${matZhFamily || matFamily || ''} ${matGrade}`.trim()
        : matZhFamily
          ? `${matZhFamily}（牌号未指定）`
          : undefined;
      if (r.material.family) matFamily = r.material.family;
      if (r.material.zhFamily) matZhFamily = r.material.zhFamily;
      if (r.material.grade) {
        if (r.roundNumber > 1 && prevDesc && matGrade !== r.material.grade) {
          matPrevSummary = prevDesc;
          matUpdatedRound = r.roundNumber;
        }
        matGrade = r.material.grade;
        matHistory = false;
      } else if (r.material.isHistoryRef && !matFamily && !matGrade) {
        matHistory = true;
      }
      matEvidence = dedupeSpans([...matEvidence, ...r.material.evidence]);
    }

    if (r.thickness) {
      const prevThick = thickDisplay || (thickHistory ? '引用上次订单（需核对）' : undefined);
      if (r.thickness.valueDisplay) {
        if (r.roundNumber > 1 && prevThick && prevThick !== r.thickness.valueDisplay) {
          thickPrevSummary = prevThick;
          thickUpdatedRound = r.roundNumber;
        }
        thickDisplay = r.thickness.valueDisplay;
        thickGaugeNum = r.thickness.gaugeNumber;
        thickHistory = false;
      } else if (r.thickness.isHistoryRef && !thickDisplay) {
        thickHistory = true;
      }
      thickEvidence = dedupeSpans([...thickEvidence, ...r.thickness.evidence]);
    }

    if (r.quantity) {
      if (r.quantity.mode === 'confirm_previous') {
        qtyEvidence = dedupeSpans([...qtyEvidence, ...r.quantity.evidence]);
        if (r.roundNumber > 1 && qtyValues.length > 0) {
          qtyUpdatedRound = r.roundNumber;
        }
      } else if (r.quantity.isAdditive && qtyValues.length > 0 && r.quantity.values.length > 0) {
        qtyPrevSummary = `${formatQtyList(qtyValues)} 件 (${qtyMode === 'single' ? '单档' : '分档'})`;
        const combined = Array.from(new Set([...qtyValues, ...r.quantity.values])).sort((a, b) => a - b);
        qtyValues = combined;
        qtyMode = combined.length >= 2 ? 'tiered' : 'single';
        qtyUpdatedRound = r.roundNumber;
        qtyEvidence = dedupeSpans([...qtyEvidence, ...r.quantity.evidence]);
      } else if (r.quantity.values.length > 0) {
        const prevQtyStr = qtyValues.length > 0 ? `${formatQtyList(qtyValues)} 件 (${qtyMode})` : undefined;
        if (r.roundNumber > 1 && prevQtyStr) {
          qtyPrevSummary = prevQtyStr;
          qtyUpdatedRound = r.roundNumber;
        }
        qtyValues = r.quantity.values;
        qtyMode = r.quantity.mode;
        qtyEvidence = dedupeSpans([...qtyEvidence, ...r.quantity.evidence]);
      }
    }

    if (r.drawing) {
      const prevDrw =
        drwState === 'missing'
          ? '未提及图纸'
          : drwState === 'sketch_only'
            ? '仅粗略草图'
            : drwState === 'pending_customer'
              ? '客户待发'
              : drwFormat || '已附图纸';

      if (r.roundNumber > 1 && drwState !== r.drawing.state) {
        drwPrevSummary = prevDrw;
        drwUpdatedRound = r.roundNumber;
      }
      drwState = r.drawing.state;
      if (r.drawing.formatDetail) drwFormat = r.drawing.formatDetail;
      drwEvidence = dedupeSpans([...drwEvidence, ...r.drawing.evidence]);
    }

    if (r.surfaceFinish) {
      const prevSf = sfDisplay;
      if (r.surfaceFinish.isChoiceAmbiguous) {
        sfDisplay = r.surfaceFinish.valueDisplay;
        sfChoiceAmbiguous = true;
        sfMissingColor = false;
        sfHistory = false;
        sfExplicitRaw = false;
      } else if (r.surfaceFinish.isHistoryRef) {
        sfHistory = true;
        sfChoiceAmbiguous = false;
      } else if (r.surfaceFinish.valueDisplay) {
        if (r.roundNumber > 1 && prevSf && prevSf !== r.surfaceFinish.valueDisplay) {
          sfPrevSummary = prevSf;
          sfUpdatedRound = r.roundNumber;
        }
        sfDisplay = r.surfaceFinish.valueDisplay;
        sfChoiceAmbiguous = false;
        sfMissingColor = Boolean(r.surfaceFinish.missingColorDetail);
        sfHistory = false;
        sfExplicitRaw = Boolean(r.surfaceFinish.isExplicitRaw);
      }
      sfEvidence = dedupeSpans([...sfEvidence, ...r.surfaceFinish.evidence]);
    }

    if (r.toleranceAndFeatures) {
      if (r.toleranceAndFeatures.numericTolerance) {
        numericTol = r.toleranceAndFeatures.numericTolerance;
        vagueTightTol = false;
        if (r.roundNumber > 1) tolUpdatedRound = r.roundNumber;
      } else if (r.toleranceAndFeatures.vagueTightTolerance && !numericTol) {
        vagueTightTol = true;
      }
      for (const op of r.toleranceAndFeatures.secondaryOps) {
        if (!secondaryOps.includes(op)) secondaryOps.push(op);
      }
      tolEvidence = dedupeSpans([...tolEvidence, ...r.toleranceAndFeatures.evidence]);
    }

    if (r.deliveryTerms) {
      if (r.deliveryTerms.incoterm) incoterm = r.deliveryTerms.incoterm;
      if (r.deliveryTerms.leadTime) leadTime = r.deliveryTerms.leadTime;
      if (r.deliveryTerms.isUrgent) isUrgent = true;
      delEvidence = dedupeSpans([...delEvidence, ...r.deliveryTerms.evidence]);
      if (r.roundNumber > 1) delUpdatedRound = r.roundNumber;
    }

    // Apply general history reference ("same as last time", "repeat order") ONLY to still-missing fields
    if (r.generalHistoryRef) {
      const gh = r.generalHistoryRef;
      if (!matFamily && !matGrade && !matHistory) {
        matHistory = true;
        matEvidence = dedupeSpans([...matEvidence, { ...gh, fieldKey: 'material' }]);
      }
      if (!thickDisplay && !thickHistory) {
        thickHistory = true;
        thickEvidence = dedupeSpans([...thickEvidence, { ...gh, fieldKey: 'thickness' }]);
      }
      if (!sfDisplay && !sfChoiceAmbiguous && !sfHistory) {
        sfHistory = true;
        sfEvidence = dedupeSpans([...sfEvidence, { ...gh, fieldKey: 'surfaceFinish' }]);
      }
      if (drwState === 'missing') {
        drwState = 'check_history';
        drwEvidence = dedupeSpans([...drwEvidence, { ...gh, fieldKey: 'drawing' }]);
      }
    }
  }

  const makePlaceholder = (
    key: FieldKey,
    title: string,
    englishTitle: string,
    status: FieldStatus,
    displayValue: string,
    evidence: EvidenceSpan[],
    priority: 'P0' | 'P1' | 'P2',
    options?: {
      subValue?: string;
      engineeringNote?: string;
      updatedInRound?: number;
      previousSummary?: string;
    },
  ): MergedField => ({
    key,
    title,
    englishTitle,
    status,
    displayValue,
    subValue: options?.subValue,
    engineeringNote: options?.engineeringNote || '',
    evidence,
    updatedInRound: options?.updatedInRound,
    previousSummary: options?.previousSummary,
    priority,
  });

  const tierLabel = qtyValues.length === 2 ? '两档分档询价' : `${qtyValues.length} 档分档询价`;

  const fields: Record<FieldKey, MergedField> = {
    partType: makePlaceholder(
      'partType',
      '零件类型',
      'Part Type',
      partTypeZh ? 'confirmed' : 'optional_missing',
      partTypeZh ? `${partTypeZh}（${partTypeEn}）` : '未写明零件名称',
      partEvidence,
      'P2',
      { updatedInRound: partUpdatedRound },
    ),
    material: makePlaceholder(
      'material',
      '材料与牌号',
      'Material & Grade',
      matGrade
        ? 'confirmed'
        : matHistory
          ? 'check_history'
          : matFamily
            ? 'partial_detail'
            : 'needs_clarification',
      matGrade
        ? `${matZhFamily || ''} ${matGrade}`.trim()
        : matHistory
          ? '引用上次订单（需内部核对）'
          : matZhFamily
            ? `${matZhFamily} · 牌号未指定`
            : '未指定材料与牌号',
      matEvidence,
      'P0',
      { updatedInRound: matUpdatedRound, previousSummary: matPrevSummary },
    ),
    thickness: makePlaceholder(
      'thickness',
      '板材厚度',
      'Sheet Thickness',
      thickDisplay ? 'confirmed' : thickHistory ? 'check_history' : 'needs_clarification',
      thickDisplay ? thickDisplay : thickHistory ? '引用上次订单，需核对' : '未指定板厚',
      thickEvidence,
      'P0',
      { updatedInRound: thickUpdatedRound, previousSummary: thickPrevSummary },
    ),
    quantity: makePlaceholder(
      'quantity',
      '采购数量与分档',
      'Quantity & Tiers',
      qtyMode === 'single' || qtyMode === 'tiered'
        ? 'confirmed'
        : qtyMode === 'revised' || qtyMode === 'ambiguous'
          ? 'needs_disambiguation'
          : 'needs_clarification',
      qtyMode === 'tiered'
        ? `${tierLabel}：${formatQtyList(qtyValues)} 件`
        : qtyMode === 'single'
          ? `单档数量：${formatQtyList(qtyValues)} 件`
          : qtyMode === 'revised'
            ? `疑似改单（${qtyValues[0].toLocaleString('en-US')} → ${qtyValues[qtyValues.length - 1].toLocaleString('en-US')} 件），需确认`
            : qtyMode === 'ambiguous'
              ? `存在多个数量（${formatQtyList(qtyValues)}），用途待确认`
              : '未写明采购数量',
      qtyEvidence,
      'P0',
      { updatedInRound: qtyUpdatedRound, previousSummary: qtyPrevSummary },
    ),
    drawing: makePlaceholder(
      'drawing',
      '工程图纸 / 3D',
      'Drawing / CAD',
      drwState === 'attached'
        ? 'confirmed'
        : drwState === 'pending_customer'
          ? 'pending_customer'
          : drwState === 'check_history'
            ? 'check_history'
            : 'needs_clarification',
      drwState === 'attached'
        ? `已附图纸（${drwFormat || 'CAD/PDF'}）`
        : drwState === 'pending_customer'
          ? '客户待发（Drawing to follow）'
          : drwState === 'sketch_only'
            ? '仅提及草图（缺正式尺寸图）'
            : drwState === 'check_history'
              ? '引用上次图纸，需核对'
              : '未提及图纸/3D 模型',
      drwEvidence,
      'P0',
      { updatedInRound: drwUpdatedRound, previousSummary: drwPrevSummary },
    ),
    surfaceFinish: makePlaceholder(
      'surfaceFinish',
      '表面处理',
      'Surface Finish',
      sfChoiceAmbiguous
        ? 'needs_disambiguation'
        : sfMissingColor
          ? 'partial_detail'
          : sfHistory
            ? 'check_history'
            : sfDisplay
              ? 'confirmed'
              : 'optional_missing',
      sfDisplay ? sfDisplay : sfHistory ? '引用上次工艺，需核对' : '未指定表面处理',
      sfEvidence,
      'P1',
      { updatedInRound: sfUpdatedRound, previousSummary: sfPrevSummary },
    ),
    toleranceAndFeatures: makePlaceholder(
      'toleranceAndFeatures',
      '公差与二次加工',
      'Tolerance & Ops',
      vagueTightTol && !numericTol
        ? 'needs_clarification'
        : numericTol || secondaryOps.length > 0
          ? 'confirmed'
          : 'optional_missing',
      numericTol
        ? `公差 ${numericTol}${secondaryOps.length ? ` · ${secondaryOps.join('、')}` : ''}`
        : vagueTightTol
          ? '提及“紧公差”但未附具体数值'
          : secondaryOps.length > 0
            ? secondaryOps.join('、')
            : '未特别说明（默认常规折弯公差）',
      tolEvidence,
      'P1',
      { updatedInRound: tolUpdatedRound },
    ),
    deliveryTerms: makePlaceholder(
      'deliveryTerms',
      '交期与贸易条款',
      'Terms & Lead Time',
      incoterm || leadTime ? 'confirmed' : isUrgent ? 'partial_detail' : 'optional_missing',
      [incoterm, leadTime, isUrgent && !leadTime ? '要求加急（无具体天数）' : undefined]
        .filter(Boolean)
        .join(' · ') || '未提及贸易条款与目标交期',
      delEvidence,
      'P2',
      { updatedInRound: delUpdatedRound },
    ),
  };

  return {
    fields,
    scopeWarnings,
    internalState: {
      materialFamily: matFamily,
      materialZhFamily: matZhFamily,
      materialGrade: matGrade,
      materialHistory: matHistory,
      thicknessDisplay: thickDisplay,
      thicknessGaugeNumber: thickGaugeNum,
      thicknessHistory: thickHistory,
      quantityValues: qtyValues,
      quantityMode: qtyMode,
      drawingState: drwState,
      drawingFormat: drwFormat,
      surfaceDisplay: sfDisplay,
      surfaceChoiceAmbiguous: sfChoiceAmbiguous,
      surfaceMissingColor: sfMissingColor,
      surfaceHistory: sfHistory,
      surfaceExplicitRaw: sfExplicitRaw,
      numericTolerance: numericTol,
      vagueTightTolerance: vagueTightTol,
      secondaryOps,
      incoterm,
      leadTime,
      isUrgent,
      partTypeZh,
      partTypeEn,
    },
  };
}
