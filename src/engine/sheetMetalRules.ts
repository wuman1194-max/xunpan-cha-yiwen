import type {
  ClarificationQuestion,
  FieldKey,
  HistoryResolution,
  MergedField,
  PriorityLevel,
  ReadinessSummary,
  SkippedReason,
} from '../types/rfq';
import type { MergedState } from './merger';

const PRIORITY_RANK: Record<PriorityLevel, number> = { P0: 0, P1: 1, P2: 2 };

const GAUGE_MM_REF: Record<number, { steel: string; ss: string; alu: string }> = {
  10: { steel: '3.42', ss: '3.57', alu: '2.59' },
  11: { steel: '3.04', ss: '3.18', alu: '2.30' },
  12: { steel: '2.66', ss: '2.78', alu: '2.05' },
  14: { steel: '1.90', ss: '1.98', alu: '1.63' },
  16: { steel: '1.52', ss: '1.59', alu: '1.29' },
  18: { steel: '1.21', ss: '1.27', alu: '1.02' },
  20: { steel: '0.91', ss: '0.95', alu: '0.81' },
};

function buildGaugeNote(gaugeNumber: number, materialFamily?: string): string {
  const ref = GAUGE_MM_REF[gaugeNumber];
  if (!ref) {
    return `这是英美常用的板厚写法（${gaugeNumber} Gauge），报价前由工厂按材质查表换算成毫米即可。`;
  }
  if (materialFamily === 'stainless steel') {
    return `已写明 ${gaugeNumber} Gauge（英美板厚标准，对应不锈钢大约 ${ref.ss} mm 这么厚），工厂可直接按此换算报价。`;
  }
  if (materialFamily === 'aluminum') {
    return `已写明 ${gaugeNumber} Gauge（英美板厚标准，对应铝合金大约 ${ref.alu} mm 这么厚），注意不同金属换算厚度不一样。`;
  }
  if (materialFamily === 'carbon steel' || materialFamily === 'steel') {
    return `已写明 ${gaugeNumber} Gauge（英美板厚标准，对应普通碳钢大约 ${ref.steel} mm 这么厚），工厂可直接报价。`;
  }
  return `已写明 ${gaugeNumber} Gauge（碳钢约 ${ref.steel} mm / 不锈钢约 ${ref.ss} mm / 铝约 ${ref.alu} mm），等确定哪种金属就能定下准确毫米数。`;
}

function buildResolvedHistoryNote(res: HistoryResolution): string {
  if (res.source === 'imported_order' && res.orderNo) {
    return `已核对工厂旧单（${res.orderNo}）：上次规格为 ${res.value}；已自动带入且将在回信中请客户复核沿用。`;
  }
  return `业务员已翻查旧单并填入：${res.value}；已自动带入且将在回信中请客户复核沿用。`;
}

export interface RulesEvaluationOutput {
  fields: MergedField[];
  questions: ClarificationQuestion[];
  skippedQuestions: SkippedReason[];
  historyCheckItems: MergedField[];
  resolvedHistoryItems: MergedField[];
  readinessSummary: ReadinessSummary;
}

export function evaluateSheetMetalRules(
  merged: MergedState,
  askCustomerForHistoryFields: Partial<Record<FieldKey, boolean>> = {},
  resolvedHistoryValues: Partial<Record<FieldKey, HistoryResolution>> = {},
): RulesEvaluationOutput {
  const s = merged.internalState;
  const f = { ...merged.fields };
  const candidateQuestions: ClarificationQuestion[] = [];
  const skippedQuestions: SkippedReason[] = [];
  const historyCheckItems: MergedField[] = [];
  const resolvedHistoryItems: MergedField[] = [];

  // 1. Material & Grade engineering note & question logic
  if (s.materialHistory && !s.materialGrade && !s.materialFamily) {
    const matResolved = resolvedHistoryValues.material;
    if (matResolved?.value.trim()) {
      f.material = {
        ...f.material,
        status: 'confirmed',
        displayValue: matResolved.value.trim(),
        resolvedFromHistory: matResolved,
        engineeringNote: buildResolvedHistoryNote(matResolved),
      };
      resolvedHistoryItems.push(f.material);
      skippedQuestions.push({
        fieldKey: 'material',
        fieldTitle: f.material.title,
        reason: `已查旧单带入材料规格（${matResolved.value.trim()}），回信已附带请客户确认沿用。`,
        status: 'confirmed',
      });
    } else {
      f.material = {
        ...f.material,
        engineeringNote: '老外说用“上次同款材料”，先翻自己电脑里的老订单记录；实在找不到再回头问客户。',
      };
      historyCheckItems.push(f.material);
      if (askCustomerForHistoryFields.material) {
        candidateQuestions.push({
          id: 'q-material-history',
          fieldKey: 'material',
          priority: 'P0',
          priorityLabel: '必问 · 没查到旧单',
          zhQuestion: '请客户再确认一遍用哪种金属和具体型号（比如 304、5052 或冷轧板）',
          zhReason: '因为你勾选了“查不到旧单”，必须让客户重新告诉你是哪种金属才能算材料成本。',
          enQuestion:
            'We are unable to locate the previous material specification on file—could you confirm the exact material and grade?',
          defaultSelected: true,
        });
      } else {
        skippedQuestions.push({
          fieldKey: 'material',
          fieldTitle: f.material.title,
          reason: '客户写了参考老订单，先由业务员自己翻旧单，暂不发邮件打扰客户。',
          status: 'check_history',
        });
      }
    }
  } else if (s.materialGrade) {
    const gradeNote = /5052/i.test(s.materialGrade)
      ? '5052-H32 是铝材里最好折弯的一种，不容易折裂，做外壳很稳妥，工厂可直接按此算料价。'
      : /6061/i.test(s.materialGrade)
        ? '注意：6061-T6 铝合金偏硬、弯急了容易开裂，转给工厂报价时要提醒师傅看折弯拐角。'
        : /304|316/i.test(s.materialGrade)
          ? `已经写明了 ${s.materialGrade} 型号，可以直接按对应的不锈钢价格算成本。`
          : /^(C110|C260|C360|H62|T2)/i.test(s.materialGrade)
            ? `已经写明了铜材型号 ${s.materialGrade}，可以直接核算材料费和折弯工艺。`
            : `已经写明了具体型号 ${s.materialGrade}，材料这一项已经够用了。`;
    f.material = { ...f.material, engineeringNote: gradeNote };
    skippedQuestions.push({
      fieldKey: 'material',
      fieldTitle: f.material.title,
      reason: `老外已经明确写了用 ${s.materialGrade}，不用再多问一句。`,
      status: 'confirmed',
    });
  } else if (s.materialFamily === 'stainless steel') {
    f.material = {
      ...f.material,
      engineeringNote: '只说了“不锈钢”但没写是 304、316L 还是 201——这几种不锈钢材料差价很大，不问清楚没法报价。',
    };
    candidateQuestions.push({
      id: 'q-material-ss-grade',
      fieldKey: 'material',
      priority: 'P0',
      priorityLabel: '必问 · 不问算不出价',
      zhQuestion: '不锈钢具体用哪个型号？（比如常见的 304、防锈更好的 316L，还是便宜点的 201）',
      zhReason: '同样叫“不锈钢”，304 和 316L 价格差一大截，防锈能力也不一样，必须让客户定下来。',
      enQuestion: 'Which stainless steel grade is required (for example, 304, 316L, or 201)?',
      defaultSelected: true,
    });
  } else if (s.materialFamily === 'aluminum') {
    f.material = {
      ...f.material,
      engineeringNote: '只说了“铝”但没写牌号：折弯常用的 5052-H32 不易裂，而 6061-T6 硬铝折弯容易开裂，且价格不同，必须确认。',
    };
    candidateQuestions.push({
      id: 'q-material-al-grade',
      fieldKey: 'material',
      priority: 'P0',
      priorityLabel: '必问 · 影响折弯和价格',
      zhQuestion: '铝合金具体要用哪种牌号？（比如适合折弯的 5052-H32，还是硬铝 6061-T6）',
      zhReason: '5052-H32 折弯不容易裂，6061-T6 弯急了易断，选错牌号会整批报废，料价也不同。',
      enQuestion: 'Which aluminum alloy and temper do you need (e.g., 5052-H32 for bending, or 6061-T6)?',
      defaultSelected: true,
    });
  } else if (s.materialFamily === 'carbon steel' || s.materialFamily === 'steel') {
    f.material = {
      ...f.material,
      engineeringNote: '只说了“钢/碳钢”还不够，要分清是普通冷轧板(SPCC)、镀锌板(SGCC)还是热轧钢(Q235)，价格和防锈做法都不一样。',
    };
    candidateQuestions.push({
      id: 'q-material-steel-grade',
      fieldKey: 'material',
      priority: 'P0',
      priorityLabel: '必问 · 不问算不出价',
      zhQuestion: '具体用哪一种钢板？（比如普通冷轧板 SPCC、自带防锈层的镀锌板 SGCC，还是 Q235）',
      zhReason: '不同钢板进货价不同，而且决定后面要不要额外花钱做防锈。',
      enQuestion: 'Could you confirm the specific steel grade (e.g., SPCC cold-rolled, SGCC galvanized, or Q235)?',
      defaultSelected: true,
    });
  } else if (s.materialFamily === 'copper/brass') {
    const isBrass = s.materialZhFamily === '黄铜';
    f.material = {
      ...f.material,
      engineeringNote: isBrass
        ? '只说了“黄铜”但没写具体牌号（如 C260 / H62）和软硬程度，铜材很贵，折弯硬了容易裂，需要问清。'
        : '只说了“铜”但没写是紫铜(C110/T2)还是黄铜(C260/H62)，铜价很高，必须确认具体牌号。',
    };
    candidateQuestions.push({
      id: 'q-material-copper-grade',
      fieldKey: 'material',
      priority: 'P0',
      priorityLabel: '必问 · 铜材单价高',
      zhQuestion: isBrass
        ? '黄铜具体用哪个牌号、软态还是半硬？（如 C260 / H62）'
        : '具体要用紫铜（如 C110/T2）还是黄铜（如 C260/H62）？',
      zhReason: '铜材按重量算钱非常贵，且软硬状态不同会直接影响弹片折弯开不开裂。',
      enQuestion: isBrass
        ? 'Which brass alloy and temper is required (e.g., C260 / H62 soft or half-hard)?'
        : 'Which copper/brass grade and temper do you require (e.g., C110/T2 copper or C260/H62 brass)?',
      defaultSelected: true,
    });
  } else {
    f.material = {
      ...f.material,
      engineeringNote: '整封邮件没写用什么金属（是不锈钢、铝还是铁板？），工厂完全没法算料钱。',
    };
    candidateQuestions.push({
      id: 'q-material-missing',
      fieldKey: 'material',
      priority: 'P0',
      priorityLabel: '必问 · 没写用啥材料',
      zhQuestion: '请问这个零件用什么金属材料和具体型号？（比如 304 不锈钢、5052 铝板或 SPCC 铁板）',
      zhReason: '不知道用什么金属，就完全没法算材料费和折弯工艺。',
      enQuestion: 'Could you please confirm the required material and grade (e.g., 304 stainless, 5052 aluminum, or SPCC)?',
      defaultSelected: true,
    });
  }

  // 2. Thickness logic
  if (s.thicknessDisplay) {
    f.thickness = {
      ...f.thickness,
      engineeringNote: s.thicknessGaugeNumber
        ? buildGaugeNote(s.thicknessGaugeNumber, s.materialFamily)
        : `厚度已经说清（${s.thicknessDisplay}），工厂能据此算材料重量、切割速度和需要多大压力的折弯机。`,
    };
    skippedQuestions.push({
      fieldKey: 'thickness',
      fieldTitle: f.thickness.title,
      reason: `客户已经写了板厚（${s.thicknessDisplay}），不用重复问。`,
      status: 'confirmed',
    });
  } else if (s.thicknessHistory) {
    const thickResolved = resolvedHistoryValues.thickness;
    if (thickResolved?.value.trim()) {
      f.thickness = {
        ...f.thickness,
        status: 'confirmed',
        displayValue: thickResolved.value.trim(),
        resolvedFromHistory: thickResolved,
        engineeringNote: buildResolvedHistoryNote(thickResolved),
      };
      resolvedHistoryItems.push(f.thickness);
      skippedQuestions.push({
        fieldKey: 'thickness',
        fieldTitle: f.thickness.title,
        reason: `已从旧单查出板厚（${thickResolved.value.trim()}），回信已附带请客户确认是否沿用。`,
        status: 'confirmed',
      });
    } else {
      f.thickness = {
        ...f.thickness,
        engineeringNote: '老外写了“厚度和上次一样”——别再回信问客户“上次是多厚”，业务员先翻老订单查清楚就行。',
      };
      historyCheckItems.push(f.thickness);
      if (askCustomerForHistoryFields.thickness) {
        candidateQuestions.push({
          id: 'q-thickness-history-fallback',
          fieldKey: 'thickness',
          priority: 'P0',
          priorityLabel: '必问 · 没查到旧单',
          zhQuestion: '老订单里没查到上次的厚度，请客户再确认一遍要几毫米厚',
          zhReason: '因为你勾选了“查不到旧单”，板厚不知道的话算不出重量和机器工时，只能礼貌请客户再说一次。',
          enQuestion:
            'We could not locate the thickness from your previous order record—could you confirm the sheet thickness in mm or gauge?',
          defaultSelected: true,
        });
      } else {
        skippedQuestions.push({
          fieldKey: 'thickness',
          fieldTitle: f.thickness.title,
          reason: '客户写了“和上次一样”，已经放进“先翻旧单”提醒区，不让客户重复回答。',
          status: 'check_history',
        });
      }
    }
  } else {
    f.thickness = {
      ...f.thickness,
      engineeringNote: '既没写几毫米厚，也没提参考旧单；不知道厚度就算不出铁板多重、激光切多久、用哪种模具折弯。',
    };
    candidateQuestions.push({
      id: 'q-thickness-missing',
      fieldKey: 'thickness',
      priority: 'P0',
      priorityLabel: '必问 · 不问算不出价',
      zhQuestion: '请问金属板需要做多厚？（比如 1.5 mm 或几号 Gauge）',
      zhReason: '板越厚材料越重、机器切得越慢，直接决定单件价格。',
      enQuestion: 'What sheet thickness is required (in mm or gauge)?',
      defaultSelected: true,
    });
  }

  // 3. Quantity logic
  if (s.quantityMode === 'tiered') {
    f.quantity = {
      ...f.quantity,
      engineeringNote: '老外是在问“买不同数量分别多少钱”（分档报价），数量越多机器调试费摊下来越便宜，两档要分开报价。',
    };
    skippedQuestions.push({
      fieldKey: 'quantity',
      fieldTitle: f.quantity.title,
      reason: `老外明确说了要分开报 ${s.quantityValues.map((v) => v.toLocaleString('en-US')).join(' 和 ')} 个的价格，很清楚了，不用再问。`,
      status: 'confirmed',
    });
  } else if (s.quantityMode === 'single') {
    f.quantity = {
      ...f.quantity,
      engineeringNote: `采购数量已经锁定为 ${s.quantityValues[0].toLocaleString('en-US')} 个，可直接按这批数量摊算开机调机费。`,
    };
    skippedQuestions.push({
      fieldKey: 'quantity',
      fieldTitle: f.quantity.title,
      reason: `老外已经明确说了要 ${s.quantityValues[0].toLocaleString('en-US')} 个，不用重复问。`,
      status: 'confirmed',
    });
  } else if (s.quantityMode === 'revised') {
    const firstQ = s.quantityValues[0].toLocaleString('en-US');
    const lastQ = s.quantityValues[s.quantityValues.length - 1].toLocaleString('en-US');
    f.quantity = {
      ...f.quantity,
      engineeringNote: `邮件里先写了 ${firstQ} 又说改成 ${lastQ}——要问清是“只要 ${lastQ} 个的价格”，还是两个数量都要报。`,
    };
    candidateQuestions.push({
      id: 'q-qty-revision',
      fieldKey: 'quantity',
      priority: 'P0',
      priorityLabel: '必问 · 防报错数量',
      zhQuestion: `请问这次是只按改后的 ${lastQ} 个报价，还是原来的 ${firstQ} 和 ${lastQ} 个都要报？`,
      zhReason: '小批量和大批量单价差很多，别把客户改单当成分档报价，或者反过来报错了。',
      enQuestion: `Should we quote for ${lastQ} pcs only, or would you like tiered pricing for both ${firstQ} and ${lastQ} pcs?`,
      defaultSelected: true,
    });
  } else if (s.quantityMode === 'ambiguous') {
    const listStr = s.quantityValues.map((v) => v.toLocaleString('en-US')).join(' / ');
    f.quantity = {
      ...f.quantity,
      engineeringNote: `邮件里出现了多个数字（${listStr}），没说清是分档对比还是改了主意，最好确认一下。`,
    };
    candidateQuestions.push({
      id: 'q-qty-ambiguous',
      fieldKey: 'quantity',
      priority: 'P0',
      priorityLabel: '必问 · 数量有歧义',
      zhQuestion: `邮件里提到了 ${listStr} 几个数量，请问是要分开报价，还是按最终一个数量报？`,
      zhReason: '数量不同，平摊到每个零件上的调机费和外发加工起订费差很大。',
      enQuestion: `Could you clarify whether you need tiered quotes for ${listStr} pcs or only one final quantity?`,
      defaultSelected: true,
    });
  } else {
    f.quantity = {
      ...f.quantity,
      engineeringNote: '整封邮件没写买多少个；做 10 个和做 1,000 个的机器调机摊销费用差很多，算不出单价。',
    };
    candidateQuestions.push({
      id: 'q-qty-missing',
      fieldKey: 'quantity',
      priority: 'P0',
      priorityLabel: '必问 · 没写买多少',
      zhQuestion: '请问这批大概打算做多少个？（可以报单个数量，也可以给几个数量档位）',
      zhReason: '工厂开机调试和表面处理都有起步费，不知道数量没法算单个多少钱。',
      enQuestion: 'What quantity (or price-break quantities) would you like us to quote?',
      defaultSelected: true,
    });
  }

  // 4. Drawing logic
  if (s.drawingState === 'attached') {
    f.drawing = {
      ...f.drawing,
      engineeringNote: `图纸已经附在邮件里了（${s.drawingFormat || '设计图'}），可以直接发给工厂师傅看尺寸和折弯几道。`,
    };
    skippedQuestions.push({
      fieldKey: 'drawing',
      fieldTitle: f.drawing.title,
      reason: '客户已经在附件里发了图纸，不需要再要。',
      status: 'confirmed',
    });
  } else if (s.drawingState === 'pending_customer') {
    f.drawing = {
      ...f.drawing,
      engineeringNote: '老外说了“Drawing to follow（图纸随后发来）”——先用已有信息建档，等他把图发来再出正式报价，别催。',
    };
    skippedQuestions.push({
      fieldKey: 'drawing',
      fieldTitle: f.drawing.title,
      reason: '客户主动说明了图纸随后就发（Drawing to follow），这一轮别急着再催图。',
      status: 'pending_customer',
    });
  } else if (s.drawingState === 'check_history') {
    const drwResolved = resolvedHistoryValues.drawing;
    if (drwResolved?.value.trim()) {
      f.drawing = {
        ...f.drawing,
        status: 'confirmed',
        displayValue: drwResolved.value.trim(),
        resolvedFromHistory: drwResolved,
        engineeringNote: buildResolvedHistoryNote(drwResolved),
      };
      resolvedHistoryItems.push(f.drawing);
      skippedQuestions.push({
        fieldKey: 'drawing',
        fieldTitle: f.drawing.title,
        reason: `已核对旧单图纸版本（${drwResolved.value.trim()}），回信已附带请客户确认是否有改版。`,
        status: 'confirmed',
      });
    } else {
      f.drawing = {
        ...f.drawing,
        engineeringNote: '老外说用“上次同款图纸”，业务员和工程先翻一下老订单里的图号和版本。',
      };
      historyCheckItems.push(f.drawing);
      if (askCustomerForHistoryFields.drawing) {
        candidateQuestions.push({
          id: 'q-drawing-history',
          fieldKey: 'drawing',
          priority: 'P0',
          priorityLabel: '必问 · 没查到旧图',
          zhQuestion: '旧单里没找着最新版的图纸，麻烦客户把现在的 2D/3D 图再发一下',
          zhReason: '老图纸如果改过孔位没同步，整批做出来会全部对不上孔。',
          enQuestion:
            'We could not verify the latest drawing revision from the prior order—could you share the current 2D/3D CAD file?',
          defaultSelected: true,
        });
      } else {
        skippedQuestions.push({
          fieldKey: 'drawing',
          fieldTitle: f.drawing.title,
          reason: '客户写了沿用老图纸，先由内部翻老订单确认，暂不重问客户。',
          status: 'check_history',
        });
      }
    }
  } else if (s.drawingState === 'sketch_only') {
    f.drawing = {
      ...f.drawing,
      engineeringNote: '客户目前只有手绘草图、没有带完整尺寸的正式图纸，工厂没法准确算开料大小和折弯几道。',
    };
    candidateQuestions.push({
      id: 'q-drawing-sketch',
      fieldKey: 'drawing',
      priority: 'P0',
      priorityLabel: '必问 · 缺正式图纸',
      zhQuestion: '能不能发一下带完整尺寸的正式图纸或 3D 文件（如 STEP / DXF / PDF）？',
      zhReason: '只看草图量不出精确尺寸和折弯位置，工厂无法给出准确报价。',
      enQuestion:
        'Could you share a 3D STEP file or dimensioned 2D drawing (DXF/PDF) so we can evaluate bend counts and flat pattern?',
      defaultSelected: true,
    });
  } else {
    f.drawing = {
      ...f.drawing,
      engineeringNote: '完全没提图纸——不知道长宽尺寸、要折几道弯、打几个孔，工厂师傅看了也会打回来。',
    };
    candidateQuestions.push({
      id: 'q-drawing-missing',
      fieldKey: 'drawing',
      priority: 'P0',
      priorityLabel: '必问 · 没图没法算',
      zhQuestion: '请把零件图纸或 3D 模型发给我们（推荐 STEP、DXF 或带尺寸的 PDF）',
      zhReason: '没有图纸就不知道尺寸大小、要折几道弯和开什么孔，算不出加工费。',
      enQuestion: 'Could you please send the part drawing or 3D CAD file (STEP, DXF, or dimensioned PDF)?',
      defaultSelected: true,
    });
  }

  // 5. Surface Finish logic
  const isPreGalvanizedSubstrate = Boolean(s.materialGrade && /^(SGCC|SECC|DX51D)$/i.test(s.materialGrade));

  if (s.surfaceHistory) {
    const sfResolved = resolvedHistoryValues.surfaceFinish;
    if (sfResolved?.value.trim()) {
      f.surfaceFinish = {
        ...f.surfaceFinish,
        status: 'confirmed',
        displayValue: sfResolved.value.trim(),
        resolvedFromHistory: sfResolved,
        engineeringNote: buildResolvedHistoryNote(sfResolved),
      };
      resolvedHistoryItems.push(f.surfaceFinish);
      skippedQuestions.push({
        fieldKey: 'surfaceFinish',
        fieldTitle: f.surfaceFinish.title,
        reason: `已核对旧单表面处理（${sfResolved.value.trim()}），回信已附带请客户复核。`,
        status: 'confirmed',
      });
    } else {
      f.surfaceFinish = {
        ...f.surfaceFinish,
        engineeringNote: '老外说表面做法和上次一样，先翻旧单记录核对颜色和工艺。',
      };
      historyCheckItems.push(f.surfaceFinish);
      if (askCustomerForHistoryFields.surfaceFinish) {
        candidateQuestions.push({
          id: 'q-finish-history',
          fieldKey: 'surfaceFinish',
          priority: 'P1',
          priorityLabel: '建议问 · 没查到旧单',
          zhQuestion: '老订单里没查到上次的表面做法和颜色，请客户再确认一遍',
          zhReason: '表面加工和颜色收费差距大，查不到旧单就要问清楚。',
          enQuestion: 'Could you reconfirm the surface finish specification and color requirement?',
          defaultSelected: true,
        });
      } else {
        skippedQuestions.push({
          fieldKey: 'surfaceFinish',
          fieldTitle: f.surfaceFinish.title,
          reason: '客户写了表面处理沿用旧单，已放进“先翻旧单”提醒区。',
          status: 'check_history',
        });
      }
    }
  } else if (s.surfaceChoiceAmbiguous) {
    const rawEnChoice = f.surfaceFinish.evidence[f.surfaceFinish.evidence.length - 1]?.quote?.trim();
    const safeEnChoice =
      rawEnChoice && !/[\u4e00-\u9fa5]/.test(rawEnChoice) ? rawEnChoice : 'the two finish options';
    f.surfaceFinish = {
      ...f.surfaceFinish,
      engineeringNote: '客户同时写了两种表面做法还没选定——两种工艺外发价格不一样，要问清是选一种还是都要报价对比。',
    };
    candidateQuestions.push({
      id: 'q-finish-choice',
      fieldKey: 'surfaceFinish',
      priority: 'P1',
      priorityLabel: '建议问 · 两种做法选一',
      zhQuestion: '表面做法写了两个选项，请问已定好做哪一种（还是要我们两种都报价对比），有指定颜色/色号吗？',
      zhReason: '两种表面工艺价格和质感不同，定下来才能把外发加工费算进报价里。',
      enQuestion: `Between ${safeEnChoice}, which finish do you prefer (or would you like us to quote both), and do you have a specific color/RAL code?`,
      defaultSelected: true,
    });
  } else if (s.surfaceMissingColor) {
    f.surfaceFinish = {
      ...f.surfaceFinish,
      engineeringNote: '客户写了要静电喷粉（烤漆），但没说喷什么颜色/色号和要不要哑光，调色起订费不一样。',
    };
    candidateQuestions.push({
      id: 'q-finish-color',
      fieldKey: 'surfaceFinish',
      priority: 'P1',
      priorityLabel: '建议问 · 喷粉缺颜色',
      zhQuestion: '喷粉请问要什么颜色或 RAL 色号，表面喜欢哑光还是亮光？',
      zhReason: '冷门颜色粉料可能需要额外起步费，先问清楚避免以后加价。',
      enQuestion: 'For the powder coating, could you confirm the color or RAL code and gloss/texture preference?',
      defaultSelected: true,
    });
  } else if (s.surfaceDisplay) {
    f.surfaceFinish = {
      ...f.surfaceFinish,
      engineeringNote: `表面做法已经说清（${s.surfaceDisplay}），工厂做的时候会注意贴膜防刮花和安排外发工序。`,
    };
    skippedQuestions.push({
      fieldKey: 'surfaceFinish',
      fieldTitle: f.surfaceFinish.title,
      reason: `表面做法已经说清（${s.surfaceDisplay}），不用重复问。`,
      status: 'confirmed',
    });
  } else if (isPreGalvanizedSubstrate) {
    f.surfaceFinish = {
      ...f.surfaceFinish,
      status: 'optional_missing',
      priority: 'P2',
      displayValue: `未额外指定（${s.materialGrade} 本身带镀锌防锈层）`,
      engineeringNote: `所选的 ${s.materialGrade} 钢板本身就是预镀锌防锈板，不额外喷漆也能防锈，所以不用特意追问客户要不要防锈。`,
    };
    skippedQuestions.push({
      fieldKey: 'surfaceFinish',
      fieldTitle: f.surfaceFinish.title,
      reason: `客户选的 ${s.materialGrade} 钢板自带镀锌防锈层，这次先不占用追问名额。`,
      status: 'optional_missing',
    });
  } else if (s.materialFamily === 'carbon steel' || s.materialFamily === 'steel') {
    f.surfaceFinish = {
      ...f.surfaceFinish,
      status: 'needs_clarification',
      priority: 'P1',
      displayValue: '没写（普通铁板不做处理会生锈）',
      engineeringNote: '普通碳钢/冷轧铁板光溜溜出货很快会生锈，一定要问清是要镀锌、喷粉防锈，还是只涂防锈油。',
    };
    candidateQuestions.push({
      id: 'q-finish-carbon-rust',
      fieldKey: 'surfaceFinish',
      priority: 'P1',
      priorityLabel: '建议问 · 铁板防锈',
      zhQuestion: '碳钢容易生锈，表面打算怎么做防锈处理？（比如镀锌、喷粉，还是仅涂防锈油）',
      zhReason: '普通铁板不防锈还没送到客户手里就会生锈，而且表面加工占小件成本很大一块。',
      enQuestion:
        'Since mild/carbon steel requires rust protection, which surface finish do you need (e.g., zinc plating, powder coating, or raw with anti-rust oil)?',
      defaultSelected: true,
    });
  } else {
    f.surfaceFinish = {
      ...f.surfaceFinish,
      engineeringNote: '没写表面要求；不锈钢/铝/铜本身不易生锈，如果默认去毛刺原色出货，可等核心信息齐了再顺便确认。',
    };
    candidateQuestions.push({
      id: 'q-finish-optional',
      fieldKey: 'surfaceFinish',
      priority: 'P2',
      priorityLabel: '顺便问 · 可选',
      zhQuestion: '表面需要拉丝、阳极氧化或喷粉吗，还是保持金属本色去毛刺就行？',
      zhReason: '是否需要额外外观加工会影响部分单价。',
      enQuestion:
        'Do you require any specific surface finish (e.g., brushed, anodized, powder-coated), or raw/deburred finish?',
      defaultSelected: false,
    });
  }

  // 6. Tolerance & Secondary Ops logic
  if (s.vagueTightTolerance && !s.numericTolerance) {
    f.toleranceAndFeatures = {
      ...f.toleranceAndFeatures,
      engineeringNote:
        '老外只说了“要很精确（紧公差）”，但没说允许误差多少毫米——标准不同价格和报废率差好几倍，必须问清具体数字。',
    };
    candidateQuestions.push({
      id: 'q-tolerance-vague',
      fieldKey: 'toleranceAndFeatures',
      priority: 'P1',
      priorityLabel: '建议问 · 精度影响价格',
      zhQuestion: '提到的“紧公差”具体指哪几个尺寸，允许误差范围是多少？（例如 ±0.1 mm）',
      zhReason: '没写具体误差范围，工厂不知道该按普通折弯还是精密加工算钱，最容易引发扯皮。',
      enQuestion:
        'Which specific dimensions or bends require tight tolerance, and what numeric tolerance (e.g., ±0.1 mm or ISO 2768-m) is needed?',
      defaultSelected: true,
    });
  } else if (s.numericTolerance) {
    f.toleranceAndFeatures = {
      ...f.toleranceAndFeatures,
      engineeringNote: `误差精度要求已经写明（${s.numericTolerance}）${s.secondaryOps.length ? `，并包含特殊加工（${s.secondaryOps.join('、')}）` : ''}，工厂可以直接评估。`,
    };
    skippedQuestions.push({
      fieldKey: 'toleranceAndFeatures',
      fieldTitle: f.toleranceAndFeatures.title,
      reason: `误差精度已经给了具体数字（${s.numericTolerance}），不用重复问。`,
      status: 'confirmed',
    });
  } else {
    f.toleranceAndFeatures = {
      ...f.toleranceAndFeatures,
      engineeringNote:
        s.secondaryOps.length > 0
          ? `检测到特殊加工（${s.secondaryOps.join('、')}），没特别写误差时按行业常规折弯标准评估即可。`
          : '邮件里没提特殊精度要求，报价单上注明“按常规折弯标准”就行，先不用拿这个问题去烦客户。',
    };
    skippedQuestions.push({
      fieldKey: 'toleranceAndFeatures',
      fieldTitle: f.toleranceAndFeatures.title,
      reason: '没提特殊精度要求，先按行业普通标准算，不占用宝贵的追问名额。',
      status: 'optional_missing',
    });
  }

  // 7. Part Type note
  f.partType = {
    ...f.partType,
    engineeringNote: s.partTypeZh
      ? `明确是单一零件（${s.partTypeZh}），非常适合用本工具快速完成报价前信息核对。`
      : '没写出零件叫什么名字，有图纸就能看出来，不用专门追问。',
  };

  // 8. Delivery terms note
  if (s.incoterm || s.leadTime) {
    f.deliveryTerms = {
      ...f.deliveryTerms,
      engineeringNote: `客户写了交货要求（${[s.incoterm, s.leadTime].filter(Boolean).join(' / ')}），算总价时记得把运费和交期考虑进去。`,
    };
    skippedQuestions.push({
      fieldKey: 'deliveryTerms',
      fieldTitle: f.deliveryTerms.title,
      reason: '已经给了贸易条款或交货期，不用再重复确认。',
      status: 'confirmed',
    });
  } else if (s.isUrgent) {
    f.deliveryTerms = {
      ...f.deliveryTerms,
      engineeringNote: '客户催得急（写了 ASAP/Urgent），但没说到底几天内要货、送到哪儿。',
    };
    candidateQuestions.push({
      id: 'q-delivery-urgent',
      fieldKey: 'deliveryTerms',
      priority: 'P2',
      priorityLabel: '顺便问 · 急单排期',
      zhQuestion: '请问最晚希望哪天收到货，按出厂价（EXW）还是离岸价（FOB）报？',
      zhReason: '加急可能需要加收插单和外发加急费。',
      enQuestion: 'What is your target delivery date and preferred Incoterm (e.g., EXW or FOB)?',
      defaultSelected: false,
    });
  } else {
    f.deliveryTerms = {
      ...f.deliveryTerms,
      engineeringNote: '没提几号交货和运费方式，先把材料、厚度、数量、图纸问清最重要，这项先不管。',
    };
  }

  const sortedQuestions = [...candidateQuestions].sort(
    (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority],
  );
  const cappedQuestions = sortedQuestions.slice(0, 3);
  const truncatedQuestions = sortedQuestions.slice(3);

  for (const dropped of truncatedQuestions) {
    skippedQuestions.push({
      fieldKey: dropped.fieldKey,
      fieldTitle: f[dropped.fieldKey].title,
      reason: `一封邮件最多只问 3 个问题：先把更卡脖子的项目问清，“${dropped.zhQuestion}”这次先省掉。`,
      status: f[dropped.fieldKey].status,
    });
  }

  const orderedKeys: FieldKey[] = [
    'material',
    'thickness',
    'quantity',
    'drawing',
    'surfaceFinish',
    'toleranceAndFeatures',
    'partType',
    'deliveryTerms',
  ];
  const fields = orderedKeys.map((k) => f[k]);

  const allBlockerQuestions = sortedQuestions.filter((q) => q.priority === 'P0' || q.priority === 'P1');
  const totalBlockerCount = allBlockerQuestions.length;
  const blockerQuestions = cappedQuestions.filter((q) => q.priority === 'P0' || q.priority === 'P1');
  const blockerCount = blockerQuestions.length;
  const internalCheckCount = historyCheckItems.filter((h) => !askCustomerForHistoryFields[h.key]).length;

  let readinessSummary: ReadinessSummary;
  if (blockerCount === 0 && s.drawingState === 'pending_customer') {
    readinessSummary = {
      level: 'waiting_drawing',
      headline: '关键信息全清了！就等客户把图纸发过来就能正式报价',
      detail: '材料型号、板厚、数量和表面做法都齐了，客户说过会发图纸，别发邮件去催，回一封确认信就好。',
      blockerCount: 0,
      internalCheckCount,
    };
  } else if (blockerCount === 0) {
    readinessSummary = {
      level: 'ready',
      headline:
        internalCheckCount > 0
          ? '不用去问客户了！你先自己翻一下老订单就能去报价'
          : resolvedHistoryItems.length > 0
            ? '已核对旧单并带入规格，发回信请客户复核沿用即可报价！'
            : '所有关键信息都齐了，可以直接发给工厂算价！',
      detail:
        internalCheckCount > 0
          ? `下面黄色框列出了客户说“和上次一样”的项目（${historyCheckItems.map((h) => h.title).join('、')}），先翻电脑旧单再报价。`
          : resolvedHistoryItems.length > 0
            ? '已在右侧回信里附上核查到的旧单记录，等客户回一声确认即可下单生产。'
            : '材料型号、板厚、数量、图纸和表面要求都已经明确，不需要发回信追问。',
      blockerCount: 0,
      internalCheckCount,
    };
  } else {
    const truncatedBlockerCount = Math.max(0, totalBlockerCount - cappedQuestions.length);
    readinessSummary = {
      level: 'needs_info',
      headline:
        truncatedBlockerCount > 0
          ? `先别急着找工厂算价！共缺 ${totalBlockerCount} 项关键信息，已浓缩出最先必问的 ${cappedQuestions.length} 个问题`
          : `先别急着找工厂算价！还差 ${totalBlockerCount} 项关键信息，需要回信问一下客户`,
      detail:
        truncatedBlockerCount > 0
          ? `按“不问就完全算不出价”排序，其余 ${truncatedBlockerCount} 项等客户回复后再跟进，避免一封信问太多吓跑客户。`
          : internalCheckCount > 0
            ? `能查旧单的（${historyCheckItems.map((h) => h.title).join('、')}）已经帮你划出来了不用问客户，只需要问下面浓缩出的 ${cappedQuestions.length} 个问题。`
            : resolvedHistoryItems.length > 0
              ? `旧单项目已帮你填好并写进回信，另外还差 ${cappedQuestions.length} 个问题需要客户补全。`
              : `已经按“不问就完全算不出价”的轻重缓急，帮你挑出了最值得问的 ${cappedQuestions.length} 个问题。`,
      blockerCount: totalBlockerCount,
      internalCheckCount,
    };
  }

  return {
    fields,
    questions: cappedQuestions,
    skippedQuestions,
    historyCheckItems,
    resolvedHistoryItems,
    readinessSummary,
  };
}
