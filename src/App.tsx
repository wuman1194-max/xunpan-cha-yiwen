import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Columns2,
  FilePlus2,
  LayoutPanelTop,
  Play,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { DEMO_FACTORY_ORDERS } from './data/demoFactoryOrders';
import { PRESET_SAMPLES } from './data/presets';
import { extractFieldValueFromOrder, matchHistoryOrders } from './engine/historyOrderStore';
import { translateReplyToChinese, translateRfqRoundToChinese } from './engine/localTranslator';
import {
  analyzeRounds,
  analyzeRoundsLocally,
  composeReplyFromAnalysis,
  type PipelineOutput,
} from './engine/pipeline';
import type {
  EmailRound,
  EngineConfig,
  EvidenceSpan,
  FactoryHistoryOrder,
  FieldKey,
  HistoryResolution,
  ReplyTone,
} from './types/rfq';
import { Header } from './components/Header';
import { QuickIntroBanner } from './components/QuickIntroBanner';
import { SampleBar } from './components/SampleBar';
import { EmailThreadPanel, type JudgeMutationAction } from './components/EmailThreadPanel';
import {
  PLAIN_FIELD_LABELS,
  RequirementCardPanel,
  type StatusFilter,
  VerdictHero,
} from './components/RequirementCardPanel';
import { ClarificationPanel } from './components/ClarificationPanel';
import { ReplyDraftPanel } from './components/ReplyDraftPanel';
import { RulesDrawer } from './components/RulesDrawer';
import { EngineSettingsModal } from './components/EngineSettingsModal';
import { BenchmarkDrawer } from './components/BenchmarkDrawer';
import { FactoryOrdersDrawer } from './components/FactoryOrdersDrawer';

const SESSION_KEY = 'xunpan_engine_config_v1';
const FACTORY_ORDERS_STORAGE_KEY = 'xunpan_factory_orders_v1';

type RightStageTab = 'check' | 'reply';
type StageViewMode = 'focus' | 'overview';

const TOUR_STEPS = [
  {
    title: '① 识破模糊询盘，绝不替客户瞎猜',
    desc: '系统标出客户只写了 "stainless steel" 但没给牌号，不擅自脑补成 304/316L；左侧同步蓝底聚焦原话出处。',
  },
  {
    title: '② 自动匹配工厂旧单（PO-2025-0812）',
    desc: '客户写“和上次一样”？自动匹配旧单库并带入 1.5 mm 板厚，写进回信请客户复核，既专业又不打扰客户。',
  },
  {
    title: '③ 生成纯英文追问信＋邮件主题行',
    desc: '最多浓缩 ≤ 3 个必问问题，英文回信与 Subject 标题严格按已核实事实生成，底部实时附上中文意思对照。',
  },
  {
    title: '④ 客户第 2 封补充回复，全绿零追问闭环',
    desc: '客户补齐 304 与 1.5 mm 并注明图纸随后发来，追问列表自动清零，报价结论切换为「静待图纸即可报价」。',
  },
] as const;

const EMPTY_STARTERS = [
  {
    label: '试试：缺牌号＋查旧单询盘',
    hint: '500/2,000 分档不锈钢支架',
    text: PRESET_SAMPLES[0].round1Text,
  },
  {
    label: '试试：老客户整单复购',
    hint: 'same as last time 转查旧单',
    text: 'Hi, repeat order for 1,000 brackets, same as last time.',
  },
  {
    label: '试试：16 Gauge 三档阶梯询价',
    hint: '100 / 500 / 2,000 件 304 面板',
    text: 'Please quote 100, 500, and 2,000 pcs of 16 gauge 304 stainless panels, brushed finish, STEP attached.',
  },
] as const;

function buildReplySubjectLine(
  merged: PipelineOutput['mergedState'],
  hasQuestions: boolean,
): string {
  const s = merged.internalState;
  const parts: string[] = [];
  if (s.materialGrade && s.materialFamily) {
    parts.push(`${s.materialGrade} ${s.materialFamily}`);
  } else if (s.materialGrade) {
    parts.push(s.materialGrade);
  } else if (s.materialFamily) {
    parts.push(s.materialFamily);
  }
  if (s.partTypeEn) parts.push(s.partTypeEn);
  const itemSummary = parts.length > 0 ? parts.join(' ') : 'Sheet Metal Part';
  const prefix = hasQuestions ? 'Re: RFQ Clarification' : 'Re: Quotation Inquiry';
  return `${prefix} — ${itemSummary}`;
}

function loadInitialEngineConfig(): EngineConfig {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (raw) {
      return JSON.parse(raw) as EngineConfig;
    }
  } catch {
    // ignore storage errors
  }
  return {
    mode: 'local',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: '',
  };
}

function loadInitialFactoryOrders(): FactoryHistoryOrder[] {
  try {
    const raw = localStorage.getItem(FACTORY_ORDERS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) return parsed as FactoryHistoryOrder[];
    }
  } catch {
    // ignore storage errors
  }
  return [];
}

function makePresetRounds(presetId: string): EmailRound[] {
  const preset = PRESET_SAMPLES.find((p) => p.id === presetId) || PRESET_SAMPLES[0];
  return [
    {
      id: 'round-1',
      roundNumber: 1,
      label: '老外发来的第一封询价邮件',
      text: preset.round1Text,
    },
  ];
}

function reconcileSelectedQuestions(
  nextQuestions: PipelineOutput['result']['questions'],
  prevSelected: Set<string>,
  prevKnownIds: Set<string>,
  resetAll: boolean,
): Set<string> {
  if (resetAll) {
    return new Set(nextQuestions.filter((q) => q.defaultSelected).map((q) => q.id));
  }
  const next = new Set<string>();
  for (const q of nextQuestions) {
    if (prevKnownIds.has(q.id)) {
      if (prevSelected.has(q.id)) next.add(q.id);
    } else if (q.defaultSelected) {
      next.add(q.id);
    }
  }
  return next;
}

function summarizeAnalysisDelta(prev: PipelineOutput, next: PipelineOutput): string | null {
  const prevFields = new Map(prev.result.fields.map((f) => [f.key, f]));
  const changes: string[] = [];

  for (const nf of next.result.fields) {
    const pf = prevFields.get(nf.key);
    if (!pf) continue;
    if (pf.status !== nf.status || pf.displayValue !== nf.displayValue) {
      const title = PLAIN_FIELD_LABELS[nf.key].label.replace('？', '');
      if (nf.status === 'confirmed' && pf.status !== 'confirmed') {
        changes.push(`${title}已确认（${nf.displayValue}）`);
      } else if (nf.status === 'needs_clarification' && pf.status !== 'needs_clarification') {
        changes.push(`${title}转为必问`);
      } else if (nf.status === 'needs_disambiguation' && pf.status !== 'needs_disambiguation') {
        changes.push(`${title}发现歧义需确认`);
      } else if (nf.status === 'pending_customer' && pf.status !== 'pending_customer') {
        changes.push(`${title}标记为客户待发`);
      }
    }
  }

  const prevQ = prev.result.questions.length;
  const nextQ = next.result.questions.length;
  const prevClear = prev.result.fields.filter((f) => f.status === 'confirmed').length;
  const nextClear = next.result.fields.filter((f) => f.status === 'confirmed').length;

  const bits: string[] = [];
  if (changes.length > 0) {
    bits.push(changes.slice(0, 2).join('、'));
  }
  if (prevClear !== nextClear) {
    bits.push(`已说清 ${prevClear}/8 → ${nextClear}/8`);
  }
  if (prevQ !== nextQ) {
    bits.push(nextQ === 0 ? '必问清零 ✓' : `建议追问 ${prevQ} → ${nextQ} 个`);
  }
  if (bits.length === 0) return null;
  return `已实时重算 · ${bits.join(' · ')}`;
}

export function App() {
  const [introOpen, setIntroOpen] = useState(true);
  const [isPitchMode, setIsPitchMode] = useState(false);
  const [activeRightTab, setActiveRightTab] = useState<RightStageTab>('check');
  const [viewMode, setViewMode] = useState<StageViewMode>('focus');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [cursorSpan, setCursorSpan] = useState<EvidenceSpan | null>(null);
  const [hoveredQuestionIdx, setHoveredQuestionIdx] = useState<number | null>(null);
  const [tourStep, setTourStep] = useState<number | null>(null);
  const [liveDelta, setLiveDelta] = useState<{ id: number; text: string } | null>(null);

  const [activePresetId, setActivePresetId] = useState<string | null>(PRESET_SAMPLES[0].id);
  const [rounds, setRounds] = useState<EmailRound[]>(() => makePresetRounds(PRESET_SAMPLES[0].id));
  const [askCustomerForHistoryFields, setAskCustomerForHistoryFields] = useState<
    Partial<Record<FieldKey, boolean>>
  >({});
  const [resolvedHistoryValues, setResolvedHistoryValues] = useState<
    Partial<Record<FieldKey, HistoryResolution>>
  >({});
  const [factoryOrders, setFactoryOrders] = useState<FactoryHistoryOrder[]>(loadInitialFactoryOrders);
  const [engineConfig, setEngineConfig] = useState<EngineConfig>(loadInitialEngineConfig);
  const [tone, setTone] = useState<ReplyTone>('concise');
  const [activeSpan, setActiveSpan] = useState<EvidenceSpan | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [benchmarkOpen, setBenchmarkOpen] = useState(false);
  const [factoryOrdersOpen, setFactoryOrdersOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const deltaTimerRef = useRef<number | null>(null);
  const pendingAnnounceDeltaRef = useRef<string | boolean>(false);

  const flashDelta = useCallback((text: string) => {
    if (deltaTimerRef.current) window.clearTimeout(deltaTimerRef.current);
    setLiveDelta({ id: Date.now(), text });
    deltaTimerRef.current = window.setTimeout(() => {
      setLiveDelta(null);
    }, 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (deltaTimerRef.current) window.clearTimeout(deltaTimerRef.current);
    };
  }, []);

  // Modal/Drawer accessibility focus trap & Escape handler
  useEffect(() => {
    if (!factoryOrdersOpen && !benchmarkOpen && !rulesOpen && !settingsOpen) return;
    const dialog = document.querySelector<HTMLElement>('[role="dialog"][aria-modal="true"]');
    if (!dialog) return;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const priorOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:enabled, a[href], input:enabled, textarea:enabled, select:enabled, summary, [tabindex="0"]',
        ),
      ).filter((element) => element.getClientRects().length && element.tabIndex >= 0);
    controls()[0]?.focus({ preventScroll: true });

    function handleDialogKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setFactoryOrdersOpen(false);
        setBenchmarkOpen(false);
        setRulesOpen(false);
        setSettingsOpen(false);
      }
      if (event.key !== 'Tab') return;
      const elements = controls();
      const first = elements[0];
      const last = elements[elements.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
    document.addEventListener('keydown', handleDialogKey);
    return () => {
      document.removeEventListener('keydown', handleDialogKey);
      document.body.style.overflow = priorOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [factoryOrdersOpen, benchmarkOpen, rulesOpen, settingsOpen]);

  // Roadshow keyboard shortcuts: P toggles Pitch Mode, 1/2 switch right stage focus tabs
  useEffect(() => {
    function handlePitchKeys(event: KeyboardEvent) {
      if (factoryOrdersOpen || benchmarkOpen || rulesOpen || settingsOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }
      if (event.key === 'p' || event.key === 'P') {
        event.preventDefault();
        setIsPitchMode((prev) => {
          const next = !prev;
          flashDelta(next ? '已进入路演纯净大屏态（快捷键 1 / 2 切换舞台焦点）' : '已退出路演模式，恢复新手引导视图');
          return next;
        });
      } else if (event.key === '1') {
        setActiveRightTab('check');
        setViewMode('focus');
      } else if (event.key === '2') {
        setActiveRightTab('reply');
        setViewMode('focus');
      }
    }
    document.addEventListener('keydown', handlePitchKeys);
    return () => document.removeEventListener('keydown', handlePitchKeys);
  }, [factoryOrdersOpen, benchmarkOpen, rulesOpen, settingsOpen, flashDelta]);

  const [pipelineOutput, setPipelineOutput] = useState(() =>
    analyzeRoundsLocally(makePresetRounds(PRESET_SAMPLES[0].id), {}, undefined, {}),
  );

  const [selectedQuestionIds, setSelectedQuestionIds] = useState<Set<string>>(
    () => new Set(pipelineOutput.result.questions.filter((q) => q.defaultSelected).map((q) => q.id)),
  );

  const [replyText, setReplyText] = useState(() =>
    composeReplyFromAnalysis(
      pipelineOutput,
      new Set(pipelineOutput.result.questions.filter((q) => q.defaultSelected).map((q) => q.id)),
      {},
      'concise',
      {},
    ),
  );
  const [isReplyDirty, setIsReplyDirty] = useState(false);

  const pipelineOutputRef = useRef(pipelineOutput);
  pipelineOutputRef.current = pipelineOutput;

  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;

  const toneRef = useRef(tone);
  toneRef.current = tone;

  const isReplyDirtyRef = useRef(isReplyDirty);
  isReplyDirtyRef.current = isReplyDirty;

  const selectedQuestionIdsRef = useRef(selectedQuestionIds);
  selectedQuestionIdsRef.current = selectedQuestionIds;

  const prevKnownQuestionIdsRef = useRef<Set<string>>(
    new Set(pipelineOutput.result.questions.map((q) => q.id)),
  );

  useEffect(() => {
    try {
      localStorage.setItem(FACTORY_ORDERS_STORAGE_KEY, JSON.stringify(factoryOrders));
    } catch {
      // ignore storage errors
    }
  }, [factoryOrders]);

  const applyAnalysisOutput = useCallback(
    (
      nextOut: PipelineOutput,
      historyMap: Partial<Record<FieldKey, boolean>>,
      resolvedMap: Partial<Record<FieldKey, HistoryResolution>>,
      currentTone: ReplyTone,
      forceResetSelections: boolean,
      forceResetReply: boolean,
    ) => {
      const prevOut = pipelineOutputRef.current;
      const announceFlag = pendingAnnounceDeltaRef.current;
      if (announceFlag) {
        pendingAnnounceDeltaRef.current = false;
        if (typeof announceFlag === 'string') {
          flashDelta(announceFlag);
        } else {
          const msg = summarizeAnalysisDelta(prevOut, nextOut);
          if (msg) flashDelta(msg);
        }
      }

      const nextSelected = reconcileSelectedQuestions(
        nextOut.result.questions,
        selectedQuestionIdsRef.current,
        prevKnownQuestionIdsRef.current,
        forceResetSelections,
      );
      prevKnownQuestionIdsRef.current = new Set(nextOut.result.questions.map((q) => q.id));
      selectedQuestionIdsRef.current = nextSelected;

      pipelineOutputRef.current = nextOut;
      setPipelineOutput(nextOut);
      setSelectedQuestionIds(nextSelected);

      if (forceResetReply || !isReplyDirtyRef.current) {
        setReplyText(composeReplyFromAnalysis(nextOut, nextSelected, historyMap, currentTone, resolvedMap));
        if (forceResetReply) setIsReplyDirty(false);
      }
    },
    [flashDelta],
  );

  const runAnalysisSyncOrAsync = useCallback(
    async (
      targetRounds: EmailRound[],
      historyMap: Partial<Record<FieldKey, boolean>>,
      resolvedMap: Partial<Record<FieldKey, HistoryResolution>>,
      cfg: EngineConfig,
      currentTone: ReplyTone,
      forceResetSelections: boolean,
      forceResetReply: boolean,
    ) => {
      if (cfg.mode === 'local') {
        const nextOut = analyzeRoundsLocally(targetRounds, historyMap, undefined, resolvedMap);
        applyAnalysisOutput(nextOut, historyMap, resolvedMap, currentTone, forceResetSelections, forceResetReply);
        return;
      }

      setIsAnalyzing(true);
      try {
        const nextOut = await analyzeRounds(targetRounds, {
          askCustomerForHistoryFields: historyMap,
          resolvedHistoryValues: resolvedMap,
          engineConfig: cfg,
        });
        applyAnalysisOutput(nextOut, historyMap, resolvedMap, currentTone, forceResetSelections, forceResetReply);
      } finally {
        setIsAnalyzing(false);
      }
    },
    [applyAnalysisOutput],
  );

  useEffect(() => {
    if (engineConfig.mode !== 'local') return;
    const timer = window.setTimeout(() => {
      const nextOut = analyzeRoundsLocally(rounds, askCustomerForHistoryFields, undefined, resolvedHistoryValues);
      applyAnalysisOutput(
        nextOut,
        askCustomerForHistoryFields,
        resolvedHistoryValues,
        toneRef.current,
        false,
        false,
      );
    }, 150);
    return () => window.clearTimeout(timer);
  }, [rounds, askCustomerForHistoryFields, resolvedHistoryValues, engineConfig.mode, applyAnalysisOutput]);

  const activePreset = useMemo(
    () => PRESET_SAMPLES.find((p) => p.id === activePresetId) || null,
    [activePresetId],
  );

  const allEvidenceSpans = useMemo(() => {
    const spans: EvidenceSpan[] = [];
    for (const f of pipelineOutput.result.fields) {
      for (const e of f.evidence) spans.push(e);
    }
    return spans;
  }, [pipelineOutput]);

  const roundTranslations = useMemo(() => {
    const map: Record<string, string> = {};
    for (const r of rounds) {
      const extracted = pipelineOutput.result.extractedRounds.find((er) => er.roundId === r.id);
      if (pipelineOutput.result.audit.engineUsed === 'llm' && extracted?.zhTranslation) {
        map[r.id] = extracted.zhTranslation;
      } else {
        map[r.id] = translateRfqRoundToChinese(r.text, extracted);
      }
    }
    return map;
  }, [rounds, pipelineOutput]);

  const replyZhPreview = useMemo(() => translateReplyToChinese(replyText), [replyText]);

  const replySubjectLine = useMemo(
    () => buildReplySubjectLine(pipelineOutput.mergedState, selectedQuestionIds.size > 0),
    [pipelineOutput.mergedState, selectedQuestionIds.size],
  );

  const cursorFieldKey = useMemo<FieldKey | null>(() => {
    if (!cursorSpan) return null;
    for (const field of pipelineOutput.result.fields) {
      if (
        field.evidence.some(
          (e) => e.roundId === cursorSpan.roundId && e.start === cursorSpan.start && e.end === cursorSpan.end,
        )
      ) {
        return field.key;
      }
    }
    return null;
  }, [cursorSpan, pipelineOutput.result.fields]);

  const matchedOrders = useMemo(() => {
    const combinedText = rounds.map((r) => r.text).join('\n');
    return matchHistoryOrders(factoryOrders, pipelineOutput.mergedState, combinedText);
  }, [factoryOrders, pipelineOutput.mergedState, rounds]);

  const handleSelectPreset = (presetId: string) => {
    const nextRounds = makePresetRounds(presetId);
    pendingAnnounceDeltaRef.current = false;
    setLiveDelta(null);
    setTourStep(null);
    setStatusFilter('all');
    setCursorSpan(null);
    setActivePresetId(presetId);
    setRounds(nextRounds);
    setAskCustomerForHistoryFields({});
    setResolvedHistoryValues({});
    setActiveSpan(null);
    setIsReplyDirty(false);
    setActiveRightTab('check');
    void runAnalysisSyncOrAsync(nextRounds, {}, {}, engineConfig, tone, true, true);
  };

  const handleClearToCustom = () => {
    const emptyRounds: EmailRound[] = [
      { id: 'round-1', roundNumber: 1, label: '老外发来的第一封询价邮件', text: '' },
    ];
    pendingAnnounceDeltaRef.current = false;
    setLiveDelta(null);
    setTourStep(null);
    setStatusFilter('all');
    setCursorSpan(null);
    setActivePresetId(null);
    setRounds(emptyRounds);
    setAskCustomerForHistoryFields({});
    setResolvedHistoryValues({});
    setActiveSpan(null);
    setIsReplyDirty(false);
    setActiveRightTab('check');
    void runAnalysisSyncOrAsync(emptyRounds, {}, {}, engineConfig, tone, true, true);
  };

  const handleLoadBenchmarkCase = (caseRounds: EmailRound[], title: string) => {
    const clonedRounds = caseRounds.map((r) => ({ ...r }));
    pendingAnnounceDeltaRef.current = `已载入实测案例：${title}`;
    setTourStep(null);
    setStatusFilter('all');
    setCursorSpan(null);
    setActivePresetId(null);
    setRounds(clonedRounds);
    setAskCustomerForHistoryFields({});
    setResolvedHistoryValues({});
    setActiveSpan(null);
    setIsReplyDirty(false);
    setBenchmarkOpen(false);
    setActiveRightTab('check');
    void runAnalysisSyncOrAsync(clonedRounds, {}, {}, engineConfig, tone, true, true);
  };

  const applyTourStep = (step: number) => {
    const p1 = PRESET_SAMPLES[0];
    const baseRounds = makePresetRounds(p1.id);
    setActivePresetId(p1.id);
    setStatusFilter('all');
    setCursorSpan(null);
    setViewMode('focus');
    setIsReplyDirty(false);
    setTourStep(step);

    if (step === 0) {
      pendingAnnounceDeltaRef.current = false;
      setRounds(baseRounds);
      setAskCustomerForHistoryFields({});
      setResolvedHistoryValues({});
      setActiveRightTab('check');
      const out = analyzeRoundsLocally(baseRounds, {}, undefined, {});
      applyAnalysisOutput(out, {}, {}, tone, true, true);
      const matSpan = out.result.fields.find((f) => f.key === 'material')?.evidence[0] || null;
      setActiveSpan(matSpan);
      flashDelta('导览 1/4 · 识破模糊“stainless steel”，左侧同步蓝底标出原话');
      return;
    }

    if (step === 1) {
      pendingAnnounceDeltaRef.current = false;
      setFactoryOrders((prev) => {
        const existingNos = new Set(prev.map((o) => o.orderNo));
        const fresh = DEMO_FACTORY_ORDERS.filter((d) => !existingNos.has(d.orderNo));
        return fresh.length > 0 ? [...prev, ...fresh] : prev;
      });
      const resolvedMap: Partial<Record<FieldKey, HistoryResolution>> = {
        thickness: {
          value: '1.5 mm',
          source: 'imported_order',
          orderNo: 'PO-2025-0812',
          orderDate: '2025-10-18',
        },
      };
      setRounds(baseRounds);
      setAskCustomerForHistoryFields({});
      setResolvedHistoryValues(resolvedMap);
      setActiveSpan(null);
      setActiveRightTab('check');
      const out = analyzeRoundsLocally(baseRounds, {}, undefined, resolvedMap);
      applyAnalysisOutput(out, {}, resolvedMap, tone, true, true);
      flashDelta('导览 2/4 · 已从 PO-2025-0812 自动带入板厚 1.5 mm');
      return;
    }

    if (step === 2) {
      pendingAnnounceDeltaRef.current = false;
      const resolvedMap: Partial<Record<FieldKey, HistoryResolution>> = {
        thickness: {
          value: '1.5 mm',
          source: 'imported_order',
          orderNo: 'PO-2025-0812',
          orderDate: '2025-10-18',
        },
      };
      setRounds(baseRounds);
      setAskCustomerForHistoryFields({});
      setResolvedHistoryValues(resolvedMap);
      setActiveSpan(null);
      setActiveRightTab('reply');
      const out = analyzeRoundsLocally(baseRounds, {}, undefined, resolvedMap);
      applyAnalysisOutput(out, {}, resolvedMap, tone, true, true);
      flashDelta('导览 3/4 · 纯英文追问信＋Subject 标题与中文对照已就绪');
      return;
    }

    // step === 3
    pendingAnnounceDeltaRef.current = false;
    const twoRounds: EmailRound[] = [
      baseRounds[0],
      {
        id: 'round-2',
        roundNumber: 2,
        label: '客户第 2 封补充回复',
        text: p1.demoRound2Text,
      },
    ];
    setRounds(twoRounds);
    setAskCustomerForHistoryFields({});
    setResolvedHistoryValues({});
    setActiveSpan(null);
    setActiveRightTab('reply');
    const out = analyzeRoundsLocally(twoRounds, {}, undefined, {});
    applyAnalysisOutput(out, {}, {}, tone, true, true);
    flashDelta('导览 4/4 · 客户补齐规格后追问清零 ✓ 可随时退出自由操作');
  };

  const handleUpdateRoundText = (roundId: string, nextText: string) => {
    setActiveSpan(null);
    setRounds((prev) => prev.map((r) => (r.id === roundId ? { ...r, text: nextText } : r)));
  };

  const handleApplyJudgeMutation = (action: JudgeMutationAction) => {
    const presetForReset = PRESET_SAMPLES.find((p) => p.id === activePresetId) || PRESET_SAMPLES[0];
    setActiveSpan(null);
    pendingAnnounceDeltaRef.current = action === 'reset_round1' ? '已恢复原邮件文本并重新核对' : true;
    setRounds((prev) =>
      prev.map((r) => {
        if (r.roundNumber !== 1) return r;
        let nextText = r.text;
        if (action === 'reset_round1') {
          nextText = presetForReset.round1Text;
        } else if (action === 'add_316l') {
          if (!/\b316L\b/i.test(nextText)) {
            nextText = nextText.replace(/\bbrushed stainless steel\b/i, '316L brushed stainless steel');
            if (nextText === r.text) {
              nextText = nextText.replace(/\bstainless steel\b/i, '316L stainless steel');
            }
          }
        } else if (action === 'remove_history_thickness') {
          nextText = nextText.replace(/\s*Same thickness as last time\.?/i, '').replace(/\s{2,}/g, ' ').trim();
        } else if (action === 'switch_to_revision') {
          nextText = nextText.replace(
            /Could you also price 2,000\??/i,
            'Actually please change it to 2,000 instead.',
          );
        } else if (action === 'al_add_5052') {
          if (!/\b5052/i.test(nextText)) {
            nextText = nextText.replace(/\baluminum\b/i, '5052-H32 aluminum');
          }
        } else if (action === 'al_pick_powder') {
          nextText = nextText.replace(/anodized or black powder-coated/i, 'black powder-coated');
        } else if (action === 'al_remove_step') {
          nextText = nextText.replace(/,?\s*STEP file attached/i, '').replace(/\s{2,}/g, ' ').trim();
        } else if (action === 'ms_add_qty') {
          if (!/\b1,000\s*pcs\b/i.test(nextText)) {
            nextText = `${nextText.trim()} Quantity is 1,000 pcs.`;
          }
        } else if (action === 'ms_add_spcc') {
          if (!/\bSPCC\b/i.test(nextText)) {
            nextText = nextText.replace(/\bmild steel\b/i, 'SPCC 2.0 mm cold-rolled steel');
          }
        } else if (action === 'ms_add_zinc') {
          if (!/\bzinc plated\b/i.test(nextText)) {
            nextText = `${nextText.trim()} Finish: zinc plated.`;
          }
        }
        return { ...r, text: nextText };
      }),
    );
  };

  const handleAddEmptyRound = () => {
    setRounds((prev) => {
      if (prev.length >= 3) return prev;
      const nextNum = prev.length + 1;
      return [
        ...prev,
        {
          id: `round-${nextNum}`,
          roundNumber: nextNum,
          label: nextNum === 2 ? '客户第 2 封补充回复' : `客户第 ${nextNum} 封补充回复`,
          text: '',
        },
      ];
    });
  };

  const handleFillDemoRound2 = () => {
    if (!activePreset?.demoRound2Text) return;
    const nextRounds: EmailRound[] = [
      rounds[0],
      {
        id: 'round-2',
        roundNumber: 2,
        label: '客户第 2 封补充回复',
        text: activePreset.demoRound2Text,
      },
    ];
    pendingAnnounceDeltaRef.current = true;
    setRounds(nextRounds);
    setActiveSpan(null);
    setIsReplyDirty(false);
    void runAnalysisSyncOrAsync(
      nextRounds,
      askCustomerForHistoryFields,
      resolvedHistoryValues,
      engineConfig,
      tone,
      false,
      true,
    );
  };

  const handleRemoveRound = (roundId: string) => {
    const nextRounds = rounds
      .filter((r) => r.id !== roundId)
      .map((r, i) => ({
        ...r,
        roundNumber: i + 1,
        id: `round-${i + 1}`,
        label: i === 0 ? '老外发来的第一封询价邮件' : `客户第 ${i + 1} 封补充回复`,
      }));
    pendingAnnounceDeltaRef.current = true;
    setRounds(nextRounds);
    setActiveSpan(null);
    if (engineConfig.mode !== 'local') {
      void runAnalysisSyncOrAsync(
        nextRounds,
        askCustomerForHistoryFields,
        resolvedHistoryValues,
        engineConfig,
        tone,
        false,
        false,
      );
    }
  };

  const handleToggleHistoryFallback = (fieldKey: FieldKey) => {
    const nextVal = !askCustomerForHistoryFields[fieldKey];
    const nextMap = {
      ...askCustomerForHistoryFields,
      [fieldKey]: nextVal,
    };
    const fieldName = PLAIN_FIELD_LABELS[fieldKey].label.replace('？', '');
    pendingAnnounceDeltaRef.current = nextVal
      ? `翻不到旧单：已将「${fieldName}」自动加入追问与英文回信`
      : `已撤回改问客户：「${fieldName}」恢复先查工厂旧单`;
    setAskCustomerForHistoryFields(nextMap);
    setIsReplyDirty(false);
    void runAnalysisSyncOrAsync(rounds, nextMap, resolvedHistoryValues, engineConfig, tone, false, true);
  };

  const handleConfirmHistoryOrder = (order: FactoryHistoryOrder, fieldsToResolve: FieldKey[]) => {
    const nextResolved = { ...resolvedHistoryValues };
    const nextAskMap = { ...askCustomerForHistoryFields };
    const appliedLabels: string[] = [];
    for (const fk of fieldsToResolve) {
      const val = extractFieldValueFromOrder(order, fk);
      if (val) {
        nextResolved[fk] = {
          value: val,
          source: 'imported_order',
          orderNo: order.orderNo,
          orderDate: order.orderDate,
        };
        delete nextAskMap[fk];
        appliedLabels.push(`${PLAIN_FIELD_LABELS[fk].label.replace('？', '')} ${val}`);
      }
    }
    pendingAnnounceDeltaRef.current = `已核对旧单 ${order.orderNo} · 带入 ${appliedLabels.join('、')} 并写入回信复核 ✓`;
    setResolvedHistoryValues(nextResolved);
    setAskCustomerForHistoryFields(nextAskMap);
    setIsReplyDirty(false);
    void runAnalysisSyncOrAsync(rounds, nextAskMap, nextResolved, engineConfig, tone, false, true);
  };

  const handleManualResolveHistoryField = (fieldKey: FieldKey, value: string) => {
    const cleaned = value.trim();
    const nextResolved: Partial<Record<FieldKey, HistoryResolution>> = {
      ...resolvedHistoryValues,
      [fieldKey]: {
        value: cleaned,
        source: 'manual_input',
      },
    };
    const nextAskMap = { ...askCustomerForHistoryFields };
    delete nextAskMap[fieldKey];
    pendingAnnounceDeltaRef.current = `已手填旧单规格（${cleaned}），自动写入回信请客户复核 ✓`;
    setResolvedHistoryValues(nextResolved);
    setAskCustomerForHistoryFields(nextAskMap);
    setIsReplyDirty(false);
    void runAnalysisSyncOrAsync(rounds, nextAskMap, nextResolved, engineConfig, tone, false, true);
  };

  const handleClearResolvedHistoryField = (fieldKey: FieldKey) => {
    const nextResolved = { ...resolvedHistoryValues };
    delete nextResolved[fieldKey];
    pendingAnnounceDeltaRef.current = '已撤回旧单带入，可重新核对或换选其他老订单';
    setResolvedHistoryValues(nextResolved);
    setIsReplyDirty(false);
    void runAnalysisSyncOrAsync(
      rounds,
      askCustomerForHistoryFields,
      nextResolved,
      engineConfig,
      tone,
      false,
      true,
    );
  };

  const handleLoadDemoOrdersInline = () => {
    setFactoryOrders((prev) => {
      const existingNos = new Set(prev.map((o) => o.orderNo));
      const fresh = DEMO_FACTORY_ORDERS.filter((d) => !existingNos.has(d.orderNo));
      return fresh.length > 0 ? [...prev, ...fresh] : prev;
    });
    flashDelta('已载入 3 条演示旧单 · 已自动匹配最接近老订单 PO-2025-0812');
  };

  const handleToggleQuestion = (questionId: string) => {
    const next = new Set(selectedQuestionIds);
    if (next.has(questionId)) next.delete(questionId);
    else next.add(questionId);
    selectedQuestionIdsRef.current = next;
    setSelectedQuestionIds(next);
    if (!isReplyDirty) {
      setReplyText(
        composeReplyFromAnalysis(
          pipelineOutput,
          next,
          askCustomerForHistoryFields,
          tone,
          resolvedHistoryValues,
        ),
      );
    }
  };

  const handleChangeTone = (nextTone: ReplyTone) => {
    toneRef.current = nextTone;
    setTone(nextTone);
    if (!isReplyDirty) {
      setReplyText(
        composeReplyFromAnalysis(
          pipelineOutput,
          selectedQuestionIds,
          askCustomerForHistoryFields,
          nextTone,
          resolvedHistoryValues,
        ),
      );
    }
  };

  const handleResetReplyFromAnalysis = () => {
    setIsReplyDirty(false);
    setReplyText(
      composeReplyFromAnalysis(
        pipelineOutput,
        selectedQuestionIds,
        askCustomerForHistoryFields,
        tone,
        resolvedHistoryValues,
      ),
    );
    flashDelta('已按当前核对清单重新生成英文回信');
  };

  const handleSaveEngineConfig = (nextCfg: EngineConfig) => {
    setEngineConfig(nextCfg);
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextCfg));
    } catch {
      // ignore storage errors
    }
    void runAnalysisSyncOrAsync(
      roundsRef.current,
      askCustomerForHistoryFields,
      resolvedHistoryValues,
      nextCfg,
      tone,
      false,
      false,
    );
  };

  const historyPendingCount = pipelineOutput.result.historyCheckItems.length;
  const questionCount = pipelineOutput.result.questions.length;
  const isAllRoundsEmpty = rounds.every((r) => r.text.trim().length === 0);
  const showCheckPanel = viewMode === 'overview' || activeRightTab === 'check';
  const showReplyPanel = viewMode === 'overview' || activeRightTab === 'reply';

  return (
    <div data-pitch={isPitchMode ? 'true' : 'false'} className="flex min-h-screen flex-col">
      <Header
        engineConfig={engineConfig}
        audit={pipelineOutput.result.audit}
        factoryOrderCount={factoryOrders.length}
        isPitchMode={isPitchMode}
        isTourActive={tourStep !== null}
        onStartTour={() => {
          if (tourStep !== null) {
            setTourStep(null);
          } else {
            applyTourStep(0);
          }
        }}
        onTogglePitchMode={() => {
          setIsPitchMode((prev) => {
            const next = !prev;
            flashDelta(
              next ? '已进入路演纯净大屏态（快捷键 1 / 2 切焦点 · P 退出）' : '已恢复常规新手引导视图',
            );
            return next;
          });
        }}
        onOpenFactoryOrders={() => setFactoryOrdersOpen(true)}
        onOpenBenchmark={() => setBenchmarkOpen(true)}
        onOpenRules={() => setRulesOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {/* 路演高光 1：实时变更动态浮标 */}
      {liveDelta && (
        <div key={liveDelta.id} role="status" aria-live="polite" className="delta-toast-wrap">
          <div className="delta-toast toast-enter">
            <span className="delta-toast-dot" aria-hidden="true" />
            <Sparkles className="size-3.5 shrink-0 text-blue-300" aria-hidden="true" />
            <span>{liveDelta.text}</span>
          </div>
        </div>
      )}

      {/* 手机端吸顶快捷定位条 */}
      <nav aria-label="手机端快速跳转" className="mobile-jump-bar sm:hidden">
        <a href="#step-email">01 看英文来信</a>
        <a
          href="#step-check"
          onClick={() => {
            setActiveRightTab('check');
          }}
        >
          02 核对与旧单
        </a>
        <a
          href="#step-reply"
          onClick={() => {
            setActiveRightTab('reply');
          }}
        >
          03 追问与回信
        </a>
      </nav>

      <QuickIntroBanner
        open={introOpen}
        hiddenInPitch={isPitchMode || tourStep !== null}
        onToggle={() => setIntroOpen((prev) => !prev)}
        onStartTour={() => applyTourStep(0)}
      />

      {tourStep !== null && (
        <section aria-label="4 步互动演示导览" className="page-wrap pt-2.5 pb-1">
          <div className="tour-ribbon reveal flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-white/12 px-2.5 font-mono-code text-[11.5px] font-bold text-blue-200 ring-1 ring-white/15">
                <Play className="size-3" />
                {tourStep + 1} / {TOUR_STEPS.length}
              </span>
              <div className="min-w-0">
                <h2 className="text-[14px] font-bold text-white">{TOUR_STEPS[tourStep].title}</h2>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-slate-300">
                  {TOUR_STEPS[tourStep].desc}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <button
                type="button"
                disabled={tourStep === 0}
                onClick={() => applyTourStep(tourStep - 1)}
                className="inline-flex min-h-8.5 items-center gap-1 rounded-lg bg-white/10 px-2.5 text-[12px] font-semibold text-white hover:bg-white/18 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowLeft className="size-3.5" />
                上一步
              </button>
              {tourStep < TOUR_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => applyTourStep(tourStep + 1)}
                  className="inline-flex min-h-8.5 items-center gap-1 rounded-lg bg-[#2447ff] px-3 text-[12px] font-bold text-white shadow-sm hover:bg-[#3b5cff]"
                >
                  下一步
                  <ArrowRight className="size-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setTourStep(null);
                    flashDelta('四步交互导览完成 · 现在可以自由改字试测或粘贴你的询盘');
                  }}
                  className="inline-flex min-h-8.5 items-center gap-1 rounded-lg bg-emerald-600 px-3 text-[12px] font-bold text-white hover:bg-emerald-500"
                >
                  完成导览
                </button>
              )}
              <button
                type="button"
                onClick={() => setTourStep(null)}
                aria-label="退出导览"
                className="inline-flex size-8.5 items-center justify-center rounded-lg bg-white/8 text-slate-300 hover:bg-white/16 hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
        </section>
      )}

      <SampleBar
        activePresetId={activePresetId}
        isPitchMode={isPitchMode}
        onSelectPreset={handleSelectPreset}
        onClearToCustom={handleClearToCustom}
      />

      {/* 核心双舞台主区（左 42% 真相源来信舞台 ＋ 右 58% 裁决与聚焦剧场） */}
      <main data-view={viewMode} className="page-wrap dual-stage">
        <div id="step-email" tabIndex={-1} className="stage-left stage-left-sticky">
          <EmailThreadPanel
            rounds={rounds}
            allEvidenceSpans={allEvidenceSpans}
            activeSpan={activeSpan}
            roundTranslations={roundTranslations}
            hasDemoRound2={Boolean(activePreset?.demoRound2Text)}
            activePresetId={activePresetId}
            isLlmMode={engineConfig.mode !== 'local'}
            isAnalyzing={isAnalyzing}
            onUpdateRoundText={handleUpdateRoundText}
            onAddEmptyRound={handleAddEmptyRound}
            onFillDemoRound2={handleFillDemoRound2}
            onRemoveRound={handleRemoveRound}
            onClearActiveSpan={() => setActiveSpan(null)}
            onCursorSpanChange={setCursorSpan}
            onTriggerLlmAnalyze={() =>
              void runAnalysisSyncOrAsync(
                rounds,
                askCustomerForHistoryFields,
                resolvedHistoryValues,
                engineConfig,
                tone,
                false,
                false,
              )
            }
            onApplyJudgeMutation={handleApplyJudgeMutation}
          />
        </div>

        <section
          id="step-check"
          tabIndex={-1}
          aria-label="AI 研判核对与回信剧场"
          className="stage-right stage-shell flex flex-col gap-4 p-4 sm:p-5"
        >
          {isAllRoundsEmpty ? (
            <div className="reveal flex flex-col gap-4 py-4">
              <div className="blueprint-card p-5 sm:p-6">
                <span className="chip tone-brand">
                  <Sparkles className="size-3" />
                  自由输入模式 · 准备就绪
                </span>
                <h2 className="mt-2.5 font-display text-[20px] font-extrabold tracking-tight text-ink">
                  把客户的英文问价邮件粘到左边，3 秒帮你拆清一切
                </h2>
                <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
                  系统会在本地完成实时英文→中文翻译，标出 8 项钣金核心规格中「已确认 / 查旧单 / 必追问」，并生成不瞎编任何参数的纯英文回信。
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    { num: '01', title: '中英逐句对照', desc: '不懂英文也能先看懂老外在问什么' },
                    { num: '02', title: '严防盲报瞎猜', desc: '绝不把不锈钢偷偷补成 304' },
                    { num: '03', title: '≤ 3 问英文回信', desc: '礼貌聚焦，直接复制粘回邮箱' },
                  ].map((step) => (
                    <div key={step.num} className="rounded-xl bg-white/95 p-3 ring-1 ring-black/6">
                      <span className="font-mono-code text-[11px] font-bold text-brand">{step.num}</span>
                      <div className="mt-0.5 text-[13px] font-bold text-ink">{step.title}</div>
                      <div className="mt-0.5 text-[11.5px] text-muted">{step.desc}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center gap-1.5 text-[12px] font-bold text-ink-2">
                  <FilePlus2 className="size-3.5 text-brand" />
                  手边暂时没邮件？点下面任意一行真实英文询盘直接试试：
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {EMPTY_STARTERS.map((starter) => (
                    <button
                      key={starter.label}
                      type="button"
                      onClick={() => {
                        const nextRounds: EmailRound[] = [
                          { ...rounds[0], text: starter.text },
                        ];
                        setStatusFilter('all');
                        setRounds(nextRounds);
                        void runAnalysisSyncOrAsync(nextRounds, {}, {}, engineConfig, tone, true, true);
                        flashDelta(`已填入体验询盘：${starter.hint}`);
                      }}
                      className="card lift p-3 text-left hover:border-brand-line hover:bg-brand-soft/35"
                    >
                      <div className="text-[12.5px] font-bold text-ink">{starter.label}</div>
                      <div className="mt-0.5 text-[11.5px] text-muted">{starter.hint}</div>
                      <div className="mt-1.5 line-clamp-2 font-mono-code text-[10.5px] text-faint">
                        {starter.text}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* 常驻顶部：大号多段表盘＋状态筛选报价裁决仪表盘 */}
              <VerdictHero
                result={pipelineOutput.result}
                statusFilter={statusFilter}
                onChangeStatusFilter={(nextFilter) => {
                  setStatusFilter(nextFilter);
                  if (nextFilter !== 'all') setActiveRightTab('check');
                }}
              />

              {/* 焦点切换栏 + 分步聚焦/全览同屏切换 */}
              <div className="stage-tabs-bar">
                {viewMode === 'focus' ? (
                  <div role="tablist" aria-label="右舞台焦点切换" className="stage-tabs">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeRightTab === 'check'}
                      onClick={() => setActiveRightTab('check')}
                      className="stage-tab"
                    >
                      <span className="tab-num">1</span>
                      <span className="hidden sm:inline">报价核对 & 旧单匹配</span>
                      <span className="sm:hidden">核对与旧单</span>
                      {historyPendingCount > 0 ? (
                        <span className="chip tone-history h-5 px-1.5 text-[10px]">查旧单 {historyPendingCount}</span>
                      ) : (
                        <span className="chip tone-clear h-5 px-1.5 text-[10px]">
                          {pipelineOutput.result.fields.filter((f) => f.status === 'confirmed').length}/8 已清
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeRightTab === 'reply'}
                      onClick={() => setActiveRightTab('reply')}
                      className="stage-tab"
                    >
                      <span className="tab-num">2</span>
                      <span className="hidden sm:inline">追问清单 & 英文回信</span>
                      <span className="sm:hidden">追问与回信</span>
                      {questionCount > 0 ? (
                        <span className="chip tone-ask h-5 px-1.5 text-[10px]">{questionCount} 问待发</span>
                      ) : (
                        <span className="chip tone-clear h-5 px-1.5 text-[10px]">可直接发信</span>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
                    <Send className="size-4 text-brand" />
                    <span>全览对照模式：报价核对清单 ＋ 追问与英文回信同屏展示</span>
                  </div>
                )}

                <div role="group" aria-label="视图模式" className="view-switch">
                  <button
                    type="button"
                    aria-pressed={viewMode === 'focus'}
                    onClick={() => setViewMode('focus')}
                    title="路演推荐：聚焦当前步骤，字体舒展无干扰"
                  >
                    <LayoutPanelTop className="size-3.5" />
                    分步聚焦
                  </button>
                  <button
                    type="button"
                    aria-pressed={viewMode === 'overview'}
                    onClick={() => setViewMode('overview')}
                    title="同屏平铺查看核对清单与英文回信"
                  >
                    <Columns2 className="size-3.5" />
                    全览同屏
                  </button>
                </div>
              </div>

              {/* 焦点 A：核对清单与工厂旧单 */}
              {showCheckPanel && (
                <div className="reveal">
                  <RequirementCardPanel
                    result={pipelineOutput.result}
                    activeSpan={activeSpan}
                    cursorFieldKey={cursorFieldKey}
                    statusFilter={statusFilter}
                    onResetStatusFilter={() => setStatusFilter('all')}
                    replyText={replyText}
                    roundCount={rounds.length}
                    factoryOrderCount={factoryOrders.length}
                    matchedOrders={matchedOrders}
                    askCustomerForHistoryFields={askCustomerForHistoryFields}
                    onToggleHistoryFallback={handleToggleHistoryFallback}
                    onConfirmHistoryOrder={handleConfirmHistoryOrder}
                    onManualResolveHistoryField={handleManualResolveHistoryField}
                    onClearResolvedHistoryField={handleClearResolvedHistoryField}
                    onOpenFactoryOrders={() => setFactoryOrdersOpen(true)}
                    onLoadDemoOrders={handleLoadDemoOrdersInline}
                    onSelectSpan={(span) =>
                      setActiveSpan((curr) =>
                        curr &&
                        curr.roundId === span.roundId &&
                        curr.start === span.start &&
                        curr.end === span.end
                          ? null
                          : span,
                      )
                    }
                    onAdvanceToReply={
                      viewMode === 'focus' ? () => setActiveRightTab('reply') : undefined
                    }
                  />
                </div>
              )}

              {/* 全览模式下的优雅分割线 */}
              {viewMode === 'overview' && (
                <div className="my-1 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="spec-label text-brand">STAGE 02 · 追问勾选与英文回信</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}

              {/* 焦点 B：追问清单与信纸级英文回信 */}
              {showReplyPanel && (
                <div id="step-reply" tabIndex={-1} className="reply-theater reveal scroll-mt-20">
                  <div className="reply-columns">
                    <ClarificationPanel
                      questions={pipelineOutput.result.questions}
                      skippedQuestions={pipelineOutput.result.skippedQuestions}
                      selectedQuestionIds={selectedQuestionIds}
                      hoveredQuestionIdx={hoveredQuestionIdx}
                      onHoverQuestionIdx={setHoveredQuestionIdx}
                      onToggleQuestion={handleToggleQuestion}
                    />

                    <ReplyDraftPanel
                      replyText={replyText}
                      replyZhPreview={replyZhPreview}
                      subjectLine={replySubjectLine}
                      highlightedQuestionIdx={hoveredQuestionIdx}
                      isDirty={isReplyDirty}
                      tone={tone}
                      onChangeReplyText={(val) => {
                        setReplyText(val);
                        setIsReplyDirty(true);
                      }}
                      onChangeTone={handleChangeTone}
                      onResetFromAnalysis={handleResetReplyFromAnalysis}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </main>

      {!isPitchMode && (
        <footer className="product-footer">
          <b>询盘差一问</b> · 帮你把老外的英文询价拆清楚、挑出该问的问题并写好回信（看图纸算价格和发邮件照常由你们自己把控）
        </footer>
      )}

      <FactoryOrdersDrawer
        open={factoryOrdersOpen}
        orders={factoryOrders}
        onClose={() => setFactoryOrdersOpen(false)}
        onReplaceOrders={(next) => setFactoryOrders(next)}
        onAppendOrders={(added) => setFactoryOrders((prev) => [...added, ...prev])}
        onDeleteOrder={(id) => setFactoryOrders((prev) => prev.filter((o) => o.id !== id))}
      />
      <BenchmarkDrawer
        open={benchmarkOpen}
        onClose={() => setBenchmarkOpen(false)}
        onLoadCase={(caseRounds, title) => handleLoadBenchmarkCase(caseRounds, title)}
      />
      <RulesDrawer open={rulesOpen} onClose={() => setRulesOpen(false)} />
      <EngineSettingsModal
        open={settingsOpen}
        config={engineConfig}
        onSave={handleSaveEngineConfig}
        onClose={() => setSettingsOpen(false)}
      />
    </div>
  );
}

export default App;
