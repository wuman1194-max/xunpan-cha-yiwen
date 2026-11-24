import { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Crosshair,
  FolderOpen,
  FolderSearch,
  HelpCircle,
  Info,
  PenLine,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { extractFieldValueFromOrder } from '../engine/historyOrderStore';
import { formatChineseEngineeringBrief, getStatusLabel } from '../engine/pipeline';
import type {
  AnalysisResult,
  EvidenceSpan,
  FactoryHistoryOrder,
  FieldKey,
  FieldStatus,
  HistoryResolution,
  MatchedHistoryOrder,
  MergedField,
} from '../types/rfq';

export const PLAIN_FIELD_LABELS: Record<FieldKey, { label: string; sub: string; manualPlaceholder?: string }> = {
  material: { label: '用什么材料？', sub: '金属种类与型号', manualPlaceholder: '如 304 stainless steel' },
  thickness: { label: '金属板多厚？', sub: '板材厚度', manualPlaceholder: '如 1.5 mm' },
  quantity: { label: '要买多少个？', sub: '采购数量' },
  drawing: { label: '发设计图了吗？', sub: '图纸 / 3D 文件', manualPlaceholder: '如 BRK-304-RevB.step' },
  surfaceFinish: { label: '表面怎么做？', sub: '拉丝 / 喷粉 / 防锈', manualPlaceholder: '如 brushed 拉丝' },
  toleranceAndFeatures: { label: '精度与特殊加工', sub: '公差 / 螺母 / 焊接' },
  partType: { label: '做什么零件？', sub: '零件名称' },
  deliveryTerms: { label: '交货时间与方式', sub: '交期 / 运费条款' },
};

const CORE_FIELD_KEYS = new Set<FieldKey>(['material', 'thickness', 'quantity', 'drawing', 'surfaceFinish']);

type Tone = 'clear' | 'ask' | 'history' | 'optional' | 'pending';
export type StatusFilter = 'all' | Tone;

const TONE_META: Record<Tone, { icon: typeof CheckCircle2; bar: string; dot: string; stroke: string; legend: string }> = {
  clear: { icon: CheckCircle2, bar: 'bg-clear-dot', dot: 'bg-clear-dot', stroke: '#059669', legend: '已说清' },
  ask: { icon: AlertTriangle, bar: 'bg-ask-dot', dot: 'bg-ask-dot', stroke: '#e11d48', legend: '必追问' },
  history: { icon: FolderSearch, bar: 'bg-history-dot', dot: 'bg-history-dot', stroke: '#d97706', legend: '查旧单' },
  optional: { icon: HelpCircle, bar: 'bg-optional-dot', dot: 'bg-optional-dot', stroke: '#0284c7', legend: '次要可选' },
  pending: { icon: Clock, bar: 'bg-pending-dot', dot: 'bg-pending-dot', stroke: '#64748b', legend: '等客户发' },
};

function toneOf(status: FieldStatus): Tone {
  switch (status) {
    case 'needs_clarification':
    case 'needs_disambiguation':
    case 'partial_detail':
      return 'ask';
    case 'confirmed':
      return 'clear';
    case 'check_history':
      return 'history';
    case 'pending_customer':
      return 'pending';
    case 'optional_missing':
    default:
      return 'optional';
  }
}

const READINESS_STYLES = {
  needs_info: {
    icon: AlertTriangle,
    shell: 'border-ask-line/90 bg-[linear-gradient(140deg,#fff1f4_0%,#ffffff_58%)]',
    ink: 'text-ask-ink',
    ring: 'var(--color-ask-dot)',
    tag: '暂不能报价',
  },
  waiting_drawing: {
    icon: Clock,
    shell: 'border-optional-line/90 bg-[linear-gradient(140deg,#f0f9ff_0%,#ffffff_58%)]',
    ink: 'text-optional-ink',
    ring: 'var(--color-optional-dot)',
    tag: '静待图纸即可报价',
  },
  ready: {
    icon: CheckCircle2,
    shell: 'border-clear-line/90 bg-[linear-gradient(140deg,#ecfdf5_0%,#ffffff_58%)]',
    ink: 'text-clear-ink',
    ring: 'var(--color-clear-dot)',
    tag: '可以直接报价',
  },
};

function formatResolutionSource(res: HistoryResolution): string {
  return res.source === 'imported_order' && res.orderNo
    ? `来自旧单 ${res.orderNo}`
    : '业务员手动查单填入';
}

async function safeCopyBriefText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(el);
    return ok;
  } catch {
    return false;
  }
}

const DIAL_TICKS = Array.from({ length: 24 }, (_, i) => i * 15);

/** 66px 精工多段表盘进度环 */
function ProgressRing({
  value,
  total,
  segments,
}: {
  value: number;
  total: number;
  segments: Array<{ key: string; count: number; color: string }>;
}) {
  const r = 23;
  const c = 2 * Math.PI * r;
  const nonEmpty = segments.filter((s) => s.count > 0);
  const gap = nonEmpty.length > 1 ? 2.6 : 0;

  let acc = 0;
  const arcs = nonEmpty.map((seg) => {
    const startRatio = total > 0 ? acc / total : 0;
    acc += seg.count;
    const rawLen = total > 0 ? (seg.count / total) * c : 0;
    const arcLen = Math.max(2, rawLen - gap);
    return {
      key: seg.key,
      color: seg.color,
      arcLen,
      rotateDeg: -90 + startRatio * 360,
    };
  });

  return (
    <div className="relative grid size-[66px] shrink-0 place-items-center" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="absolute inset-0">
        {DIAL_TICKS.map((deg) => (
          <line
            key={deg}
            x1="32"
            y1="2.5"
            x2="32"
            y2={deg % 90 === 0 ? '6' : '4.5'}
            stroke="currentColor"
            strokeWidth={deg % 90 === 0 ? '1.2' : '0.85'}
            className="text-line-strong"
            transform={`rotate(${deg} 32 32)`}
          />
        ))}
        <circle cx="32" cy="32" r={r} fill="none" stroke="#e6eaf2" strokeWidth="5.2" />
        {arcs.map((arc) => (
          <circle
            key={arc.key}
            cx="32"
            cy="32"
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth="5.2"
            strokeLinecap="round"
            strokeDasharray={`${arc.arcLen} ${c}`}
            transform={`rotate(${arc.rotateDeg} 32 32)`}
            className="transition-all duration-500 ease-out"
          />
        ))}
      </svg>
      <div className="text-center leading-none">
        <div className="font-mono-code text-[15px] font-bold text-ink tabular">
          {value}
          <span className="text-[10.5px] font-medium text-faint">/{total}</span>
        </div>
        <div className="mt-0.5 text-[9px] font-bold text-muted">已说清</div>
      </div>
    </div>
  );
}

/** 常驻右剧场顶部的「报价裁决仪表盘 Verdict Hero」 */
export function VerdictHero({
  result,
  statusFilter = 'all',
  onChangeStatusFilter,
}: {
  result: AnalysisResult;
  statusFilter?: StatusFilter;
  onChangeStatusFilter?: (next: StatusFilter) => void;
}) {
  const [copiedBrief, setCopiedBrief] = useState(false);

  const handleCopyBrief = async () => {
    const ok = await safeCopyBriefText(formatChineseEngineeringBrief(result));
    if (ok) {
      setCopiedBrief(true);
      setTimeout(() => setCopiedBrief(false), 1800);
    }
  };

  const readiness = READINESS_STYLES[result.readinessSummary.level];
  const ReadinessIcon = readiness.icon;

  const toneCounts: Record<Tone, number> = { clear: 0, ask: 0, history: 0, optional: 0, pending: 0 };
  for (const f of result.fields) toneCounts[toneOf(f.status)] += 1;

  const ringSegments: Array<{ key: Tone; count: number; color: string }> = [
    { key: 'clear', count: toneCounts.clear, color: TONE_META.clear.stroke },
    { key: 'history', count: toneCounts.history, color: TONE_META.history.stroke },
    { key: 'pending', count: toneCounts.pending, color: TONE_META.pending.stroke },
    { key: 'optional', count: toneCounts.optional, color: TONE_META.optional.stroke },
    { key: 'ask', count: toneCounts.ask, color: TONE_META.ask.stroke },
  ];

  const handleFilterToggle = (target: StatusFilter) => {
    if (!onChangeStatusFilter) return;
    onChangeStatusFilter(statusFilter === target ? 'all' : target);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className={`relative overflow-hidden rounded-[16px] border p-4 sm:p-5 ${readiness.shell}`}>
        <div className="flex items-start gap-4">
          <ProgressRing
            value={toneCounts.clear}
            total={result.fields.length}
            segments={ringSegments}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span
                className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-white/85 px-2.5 py-0.5 font-mono-code text-[11px] font-bold tracking-wide ring-1 ring-black/6 ${readiness.ink}`}
              >
                <ReadinessIcon className="size-3.5 shrink-0" />
                报价结论 · {readiness.tag}
              </span>
              <span className="chip tone-clear">
                <ShieldCheck className="size-3 shrink-0" />
                {result.audit.ungroundedBlockedCount > 0
                  ? `已拦截 ${result.audit.ungroundedBlockedCount} 项无原文猜测`
                  : `绝不瞎编 · 已对照 ${result.audit.totalGroundedSpans} 处原话`}
              </span>
            </div>

            <h2 className="mt-2 font-display text-[length:var(--fs-verdict)] leading-[1.32] font-extrabold tracking-tight text-ink">
              {result.readinessSummary.headline}
            </h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-2">
              {result.readinessSummary.detail}
            </p>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center justify-between gap-2 border-t border-black/6 pt-3">
          <div role="group" aria-label="按核对状态筛选参数卡片" className="flex flex-wrap items-center gap-1.5">
            {onChangeStatusFilter && (
              <button
                type="button"
                aria-pressed={statusFilter === 'all'}
                onClick={() => onChangeStatusFilter('all')}
                className="status-filter-btn"
              >
                <span>全部</span>
                <b className="font-mono-code font-bold text-ink tabular">{result.fields.length}</b>
              </button>
            )}
            {(['ask', 'history', 'clear', 'pending', 'optional'] as const)
              .filter((t) => toneCounts[t] > 0 || t === 'ask' || t === 'clear')
              .map((t) =>
                onChangeStatusFilter ? (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={statusFilter === t}
                    onClick={() => handleFilterToggle(t)}
                    className="status-filter-btn"
                    title={`只看「${TONE_META[t].legend}」项目`}
                  >
                    <i className={`size-2 rounded-full ${TONE_META[t].dot}`} aria-hidden="true" />
                    <span>{TONE_META[t].legend}</span>
                    <b className="font-mono-code text-[12.5px] font-bold text-ink tabular">{toneCounts[t]}</b>
                  </button>
                ) : (
                  <span key={t} className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap px-1.5 text-[12px] text-ink-2">
                    <i className={`size-2 rounded-full ${TONE_META[t].dot}`} aria-hidden="true" />
                    <span>{TONE_META[t].legend}</span>
                    <b className="font-mono-code text-[13px] font-bold text-ink tabular">{toneCounts[t]}</b>
                  </span>
                ),
              )}
          </div>

          <button
            type="button"
            onClick={handleCopyBrief}
            className="ui-button lift min-h-8.5 px-3 text-[12px] pointer-coarse:min-h-11"
          >
            {copiedBrief ? <Check className="size-3.5 text-clear-ink" /> : <Copy className="size-3.5" />}
            {copiedBrief ? '已复制中文清单' : '复制中文清单（发给报价员）'}
          </button>
        </div>
      </div>

      {result.audit.fallbackReason && (
        <div className="flex items-start gap-2 rounded-xl border border-history-line bg-history-bg px-3.5 py-2.5 text-[12.5px] leading-snug text-history-ink">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>{result.audit.fallbackReason}</span>
        </div>
      )}

      {result.scopeWarnings.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-history-line bg-history-bg px-3.5 py-2.5 text-[12.5px] leading-snug text-history-ink">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-history-dot" />
          <div className="flex flex-col gap-0.5">
            {result.scopeWarnings.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface RequirementCardPanelProps {
  result: AnalysisResult;
  activeSpan: EvidenceSpan | null;
  cursorFieldKey?: FieldKey | null;
  statusFilter?: StatusFilter;
  onResetStatusFilter?: () => void;
  replyText?: string;
  roundCount: number;
  factoryOrderCount: number;
  matchedOrders: MatchedHistoryOrder[];
  askCustomerForHistoryFields: Partial<Record<FieldKey, boolean>>;
  onToggleHistoryFallback: (fieldKey: FieldKey) => void;
  onConfirmHistoryOrder: (order: FactoryHistoryOrder, fieldsToResolve: FieldKey[]) => void;
  onManualResolveHistoryField: (fieldKey: FieldKey, value: string) => void;
  onClearResolvedHistoryField: (fieldKey: FieldKey) => void;
  onOpenFactoryOrders: () => void;
  onLoadDemoOrders: () => void;
  onSelectSpan: (span: EvidenceSpan) => void;
  onAdvanceToReply?: () => void;
}

export function RequirementCardPanel({
  result,
  activeSpan,
  cursorFieldKey = null,
  statusFilter = 'all',
  onResetStatusFilter,
  replyText = '',
  roundCount,
  factoryOrderCount,
  matchedOrders,
  askCustomerForHistoryFields,
  onToggleHistoryFallback,
  onConfirmHistoryOrder,
  onManualResolveHistoryField,
  onClearResolvedHistoryField,
  onOpenFactoryOrders,
  onLoadDemoOrders,
  onSelectSpan,
  onAdvanceToReply,
}: RequirementCardPanelProps) {
  const [showOptionalFields, setShowOptionalFields] = useState(false);
  const [showAltMatches, setShowAltMatches] = useState(false);
  const [copiedReplyInline, setCopiedReplyInline] = useState(false);
  const [manualDrafts, setManualDrafts] = useState<Partial<Record<FieldKey, string>>>({});

  const primaryFields = result.fields.filter(
    (field) => CORE_FIELD_KEYS.has(field.key) || field.status !== 'optional_missing',
  );
  const secondaryOptionalFields = result.fields.filter(
    (field) => !CORE_FIELD_KEYS.has(field.key) && field.status === 'optional_missing',
  );

  const visibleFields =
    statusFilter !== 'all'
      ? result.fields.filter((f) => toneOf(f.status) === statusFilter)
      : showOptionalFields
        ? [...primaryFields, ...secondaryOptionalFields]
        : primaryFields;

  const replyWordCount = replyText.trim() ? replyText.trim().split(/\s+/).length : 0;

  const handleCopyReplyInline = async () => {
    if (!replyText) return;
    const ok = await safeCopyBriefText(replyText);
    if (ok) {
      setCopiedReplyInline(true);
      setTimeout(() => setCopiedReplyInline(false), 1800);
    }
  };

  const topMatch = matchedOrders[0];
  const unresolvedKeys = result.historyCheckItems.map((h) => h.key);
  const topMatchApplicableKeys = topMatch
    ? unresolvedKeys.filter((k) => Boolean(extractFieldValueFromOrder(topMatch.order, k)))
    : [];

  return (
    <section aria-label="报价核对与工厂旧单匹配" className="@container flex min-w-0 flex-col gap-3.5">
      {/* 已核对旧单确认条 */}
      {result.resolvedHistoryItems.length > 0 && (
        <div className="reveal rounded-[14px] border border-clear-line bg-clear-bg/75 p-3.5 [overflow-wrap:anywhere]">
          <span className="inline-flex items-start gap-2 text-[13px] leading-snug font-bold text-clear-ink">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
            已核对工厂旧单并填入以下规格（回信已自动附上请客户复核沿用）：
          </span>
          <div className="mt-2 flex flex-col gap-1.5">
            {result.resolvedHistoryItems.map((item) => (
              <div
                key={item.key}
                className="flex min-w-0 flex-wrap items-center justify-between gap-2 rounded-xl bg-white/95 px-3 py-2 text-[12.5px] ring-1 ring-clear-line/70"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="font-bold text-ink">{PLAIN_FIELD_LABELS[item.key].label}</span>
                  <span className="rounded-md bg-clear-bg px-2 py-0.5 font-mono-code text-[12px] font-bold text-clear-ink ring-1 ring-clear-line">
                    {item.displayValue}
                  </span>
                  {item.resolvedFromHistory && (
                    <span className="text-[11.5px] text-muted">
                      （{formatResolutionSource(item.resolvedFromHistory)}）
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => onClearResolvedHistoryField(item.key)}
                  className="inline-flex min-h-7 items-center gap-1 rounded-lg px-2 text-[11.5px] font-semibold text-muted hover:bg-mica-2 hover:text-ink pointer-coarse:min-h-11"
                >
                  <RotateCcw className="h-3 w-3" />
                  撤回重选
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 智能建议卡形态：工厂旧单核对（方案 A + 方案 B） */}
      {result.historyCheckItems.length > 0 && (
        <div className="relative overflow-hidden rounded-[16px] border border-history-line bg-[linear-gradient(150deg,#fffbeb_0%,#fffdf5_65%)] p-4 [overflow-wrap:anywhere]">
          <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[3px] bg-history-dot" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-history-dot/12 text-history-ink">
                <FolderSearch className="size-4" />
              </span>
              <h3 className="text-[14.5px] font-extrabold text-ink">工厂旧单智能核对</h3>
              <span className="chip tone-history">
                <i className="chip-dot" aria-hidden="true" />
                先查老单 · 别直接打扰客户
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {factoryOrderCount === 0 && (
                <button
                  type="button"
                  onClick={onLoadDemoOrders}
                  className="lift inline-flex min-h-8.5 items-center gap-1.5 rounded-lg bg-[linear-gradient(180deg,#d97706,#b45309)] px-3 text-[12px] font-semibold text-white shadow-sm pointer-coarse:min-h-11"
                >
                  <Zap className="size-3.5" />
                  载入 3 条演示旧单试试
                </button>
              )}
              <button
                type="button"
                onClick={onOpenFactoryOrders}
                className="lift inline-flex min-h-8.5 items-center gap-1.5 rounded-lg border border-history-line bg-white px-2.5 text-[12px] font-semibold text-ink hover:bg-mica pointer-coarse:min-h-11"
              >
                <FolderOpen className="size-3.5 text-history-dot" />
                {factoryOrderCount > 0 ? `管理旧单库 (${factoryOrderCount}条)` : '导入工厂旧单 (Excel/CSV)'}
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2.5">
            {/* 方案 A：AI 智能匹配建议卡 */}
            {topMatch && topMatchApplicableKeys.length > 0 && (
              <div className="reveal rounded-xl border border-clear-line bg-white p-3.5 shadow-[0_2px_10px_-6px_rgb(5_150_105/28%)]">
                <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
                  <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md bg-clear-bg px-2 py-0.5 font-mono-code text-[10.5px] font-bold text-clear-ink ring-1 ring-clear-line">
                    <Sparkles className="size-3 text-clear-dot" />
                    方案 A · 智能匹配旧单
                  </span>
                  <span className="font-bold text-ink">{topMatch.order.partName}</span>
                  <span className="rounded-md bg-mica px-2 py-0.5 font-mono-code text-[11px] font-bold text-ink ring-1 ring-line">
                    {topMatch.order.orderNo}
                  </span>
                  {topMatch.order.orderDate && (
                    <span className="font-mono-code text-[11px] text-muted">{topMatch.order.orderDate}</span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5 text-[11.5px] text-ink-2">
                  {topMatch.order.materialSpec && (
                    <span className="rounded-md bg-mica px-2 py-0.5 font-medium">{topMatch.order.materialSpec}</span>
                  )}
                  {topMatch.order.thickness && (
                    <span className="rounded-md bg-brand-soft px-2 py-0.5 font-mono-code font-bold text-brand-deep">
                      {topMatch.order.thickness}
                    </span>
                  )}
                  {topMatch.order.surfaceFinish && (
                    <span className="rounded-md bg-mica px-2 py-0.5 font-medium">{topMatch.order.surfaceFinish}</span>
                  )}
                  {topMatch.matchedReasons.map((reason, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md bg-clear-bg px-2 py-0.5 font-semibold text-clear-ink"
                    >
                      <Check className="size-3" /> {reason}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onConfirmHistoryOrder(topMatch.order, topMatchApplicableKeys)}
                    className="lift inline-flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#065f46] bg-[linear-gradient(180deg,#0d9c6f,#066a4e)] px-3.5 py-1.5 text-center text-[13px] font-bold text-white shadow-[0_6px_16px_-8px_rgb(6_106_78/65%)] pointer-coarse:min-h-11"
                  >
                    <Check className="size-4 shrink-0" />
                    {topMatchApplicableKeys.length === 1
                      ? `确认就是这单，带入${PLAIN_FIELD_LABELS[topMatchApplicableKeys[0]].label.replace('？', '')} ${extractFieldValueFromOrder(topMatch.order, topMatchApplicableKeys[0])}`
                      : `确认这单，一键带入全部 ${topMatchApplicableKeys.length} 项规格`}
                  </button>
                </div>

                {matchedOrders.length > 1 && (
                  <div className="mt-2">
                    <button
                      type="button"
                      aria-expanded={showAltMatches}
                      onClick={() => setShowAltMatches((prev) => !prev)}
                      className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-clear-ink hover:underline"
                    >
                      {showAltMatches ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                      {showAltMatches
                        ? '收起其他备选旧单'
                        : `查看另外 ${matchedOrders.length - 1} 条备选旧单`}
                    </button>
                    {showAltMatches && (
                      <div className="reveal mt-2 grid gap-1.5">
                        {matchedOrders.slice(1).map((alt) => {
                          const altKeys = unresolvedKeys.filter((k) =>
                            Boolean(extractFieldValueFromOrder(alt.order, k)),
                          );
                          if (altKeys.length === 0) return null;
                          return (
                            <div
                              key={alt.order.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-mica px-2.5 py-2 text-[12px]"
                            >
                              <div className="min-w-0">
                                <span className="font-mono-code font-bold text-ink">{alt.order.orderNo}</span>
                                <span className="ml-2 font-medium text-ink-2">{alt.order.partName}</span>
                                {alt.order.thickness && (
                                  <span className="ml-1.5 rounded bg-white px-1.5 py-0.5 font-mono-code text-[11px] font-semibold text-ink ring-1 ring-line">
                                    {alt.order.thickness}
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  onConfirmHistoryOrder(alt.order, altKeys);
                                  setShowAltMatches(false);
                                }}
                                className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-md border border-clear-line bg-clear-bg px-2.5 text-[11.5px] font-semibold text-clear-ink hover:bg-clear-line/40 pointer-coarse:min-h-11"
                              >
                                改用这单
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* 方案 B：手填查到的规格 / 翻不到旧单改问客户 */}
            <div className="flex flex-col gap-2 rounded-xl bg-white/90 p-3 ring-1 ring-history-line/65">
              <div className="flex items-center justify-between gap-2 text-[12px] font-bold text-ink">
                <span className="flex items-center gap-1.5">
                  <span className="grid size-4.5 place-items-center rounded bg-mica-2 font-mono-code text-[10px] font-bold text-ink-2">
                    B
                  </span>
                  方案 B · 手填查到的旧单规格（或勾选改问客户）
                </span>
              </div>
              {result.historyCheckItems.map((item: MergedField) => {
                const checked = Boolean(askCustomerForHistoryFields[item.key]);
                const draftVal = manualDrafts[item.key] ?? '';
                const placeholder = PLAIN_FIELD_LABELS[item.key].manualPlaceholder || '输入查到的值';
                return (
                  <div
                    key={item.key}
                    className={`flex flex-col gap-2 rounded-xl p-2.5 text-[12.5px] transition-colors ${
                      checked ? 'bg-ask-bg/55 ring-1 ring-ask-line' : 'bg-mica/85'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold text-ink">{PLAIN_FIELD_LABELS[item.key].label}</span>
                        <span className="ml-1.5 text-ink-2">{item.displayValue}</span>
                      </div>
                      <label
                        className={`inline-flex min-h-7.5 cursor-pointer items-center gap-2 rounded-lg border px-2.5 text-[12px] font-semibold select-none pointer-coarse:min-h-11 ${
                          checked
                            ? 'border-ask-line bg-white text-ask-ink'
                            : 'border-history-line bg-history-bg text-history-ink hover:bg-[#fef3c7]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => onToggleHistoryFallback(item.key)}
                          className="peer sr-only"
                        />
                        <span
                          className="tactile-box"
                          data-checked={checked ? 'true' : 'false'}
                          data-variant="danger"
                          aria-hidden="true"
                        >
                          <Check className="size-3 stroke-[3]" />
                        </span>
                        翻不到旧单？改问客户
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="relative min-w-0 flex-1">
                        <PenLine
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint"
                        />
                        <input
                          type="text"
                          value={draftVal}
                          onChange={(e) =>
                            setManualDrafts((prev) => ({
                              ...prev,
                              [item.key]: e.target.value,
                            }))
                          }
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && draftVal.trim()) {
                              e.preventDefault();
                              onManualResolveHistoryField(item.key, draftVal.trim());
                              setManualDrafts((prev) => ({ ...prev, [item.key]: '' }));
                            }
                          }}
                          aria-label={`手填旧单规格：${PLAIN_FIELD_LABELS[item.key].label}`}
                          placeholder={placeholder}
                          className="field-input min-h-9 py-1.5 pl-8 text-[12.5px] pointer-coarse:min-h-11 pointer-coarse:text-base"
                        />
                      </span>
                      <button
                        type="button"
                        disabled={!draftVal.trim()}
                        onClick={() => {
                          if (!draftVal.trim()) return;
                          onManualResolveHistoryField(item.key, draftVal.trim());
                          setManualDrafts((prev) => ({ ...prev, [item.key]: '' }));
                        }}
                        className="min-h-9 shrink-0 rounded-lg bg-obsidian px-3.5 text-[12px] font-semibold text-white hover:bg-obsidian-hover disabled:cursor-not-allowed disabled:bg-mica-2 disabled:text-faint pointer-coarse:min-h-11"
                      >
                        确认填入
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {statusFilter !== 'all' && (
        <div className="reveal flex flex-wrap items-center justify-between gap-2 rounded-xl bg-brand-soft/60 px-3.5 py-2 text-[12px] text-brand-deep ring-1 ring-brand-line/80">
          <span>
            正在筛选：<strong>{TONE_META[statusFilter].legend}</strong>（共 {visibleFields.length} 项）
          </span>
          {onResetStatusFilter && (
            <button
              type="button"
              onClick={onResetStatusFilter}
              className="rounded-md bg-white px-2.5 py-1 text-[11.5px] font-semibold text-brand-deep ring-1 ring-brand-line hover:bg-brand-tint"
            >
              显示全部 8 项
            </button>
          )}
        </div>
      )}

      {/* 8 项钣金参数核对卡片（去框降噪，宽屏 2 列舒展呈现，支持光标双向感应） */}
      <div className="grid min-w-0 grid-cols-1 gap-3 @min-[520px]:grid-cols-2">
        {visibleFields.map((field) => {
          const isFieldActive =
            activeSpan &&
            field.evidence.some(
              (e) => e.roundId === activeSpan.roundId && e.start === activeSpan.start && e.end === activeSpan.end,
            );
          const isCursorLinked = cursorFieldKey === field.key;
          const friendlyMeta = PLAIN_FIELD_LABELS[field.key];
          const tone = toneOf(field.status);
          const StatusIcon = TONE_META[tone].icon;
          const latestEvidence = field.evidence[field.evidence.length - 1];

          return (
            <div
              key={field.key}
              className={`group/card relative flex min-w-0 flex-col justify-between overflow-hidden rounded-[14px] py-3.5 pr-3.5 pl-4.5 transition-[border-color,box-shadow,background-color] duration-150 [overflow-wrap:anywhere] ${
                isFieldActive
                  ? 'bg-brand-soft/45 ring-2 ring-brand/45'
                  : isCursorLinked
                    ? 'card-cursor-linked'
                    : 'bg-mica/75 ring-1 ring-black/6 hover:bg-white hover:ring-black/14'
              }`}
            >
              <span
                aria-hidden="true"
                className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${TONE_META[tone].bar}`}
              />
              <div>
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`chip h-5.5 px-2 text-[10.5px] tone-${tone}`}>
                      <StatusIcon className="size-3 shrink-0" />
                      {getStatusLabel(field)}
                    </span>
                    {isCursorLinked && !isFieldActive && (
                      <span className="chip tone-brand h-5.5 px-1.5 text-[10px]">光标所在原话</span>
                    )}
                  </div>
                  {latestEvidence && (
                    <button
                      type="button"
                      onClick={() => onSelectSpan(latestEvidence)}
                      aria-pressed={Boolean(isFieldActive)}
                      aria-label={`点我看原话：${latestEvidence.quote}`}
                      title={`点一下在左侧邮件里标出英文原话：${latestEvidence.quote}`}
                      className={`inline-flex min-h-6 shrink-0 items-center gap-1 whitespace-nowrap rounded-md px-2 text-[11px] font-semibold transition-colors pointer-coarse:min-h-10 ${
                        isFieldActive
                          ? 'bg-brand text-white'
                          : 'bg-white text-ink-2 ring-1 ring-black/8 hover:bg-brand-soft hover:text-brand-deep hover:ring-brand-line'
                      }`}
                    >
                      <Crosshair className="size-3 shrink-0" />
                      看原话
                    </button>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <h3 className="text-[13.5px] font-bold text-ink">{friendlyMeta.label}</h3>
                  <span className="text-[11.5px] text-muted">{friendlyMeta.sub}</span>
                  {field.updatedInRound && (
                    <span className="shrink-0 whitespace-nowrap rounded-md bg-clear-bg px-1.5 py-0.5 text-[10.5px] font-bold text-clear-ink">
                      第 {field.updatedInRound} 封更新
                    </span>
                  )}
                  {field.resolvedFromHistory && (
                    <span className="min-w-0 max-w-full rounded-md bg-clear-bg px-1.5 py-0.5 text-[10.5px] font-bold text-clear-ink">
                      {field.resolvedFromHistory.orderNo
                        ? `旧单 ${field.resolvedFromHistory.orderNo}`
                        : '查旧单补填'}
                    </span>
                  )}
                </div>

                {/* 主提取值（投影大字层级） */}
                <div className="mt-1.5">
                  {field.evidence.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => onSelectSpan(field.evidence[field.evidence.length - 1])}
                      title="点一下在左侧邮件里标出英文原话"
                      className="inline-block max-w-full rounded text-left text-[length:var(--fs-value)] leading-snug font-bold text-ink underline-offset-3 transition-colors hover:text-brand hover:underline"
                    >
                      <span className="tabular-nums">{field.displayValue.replace(/ 件/g, '\u00A0件')}</span>
                    </button>
                  ) : (
                    <div className="text-[length:var(--fs-value)] leading-snug font-bold text-ink">
                      {field.displayValue.replace(/ 件/g, '\u00A0件')}
                    </div>
                  )}

                  {field.previousSummary && (
                    <div className="mt-0.5 text-[11.5px] text-muted line-through">
                      之前：{field.previousSummary}
                    </div>
                  )}
                </div>

                {/* 英文原话胶囊 */}
                {field.evidence.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {field.evidence.map((ev, idx) => {
                      const isSpanSelected =
                        activeSpan &&
                        activeSpan.roundId === ev.roundId &&
                        activeSpan.start === ev.start &&
                        activeSpan.end === ev.end;
                      const roundTag = roundCount > 1 ? `第${ev.roundNumber}封：` : '原话：';
                      return (
                        <button
                          key={`${ev.roundId}-${ev.start}-${idx}`}
                          type="button"
                          onClick={() => onSelectSpan(ev)}
                          aria-pressed={Boolean(isSpanSelected)}
                          title={ev.quote}
                          className={`inline-flex min-h-6 min-w-0 max-w-full items-center gap-1 rounded-md px-2 py-0.5 text-[11px] transition-colors pointer-coarse:min-h-10 ${
                            isSpanSelected
                              ? 'bg-brand text-white'
                              : 'bg-white text-ink-2 ring-1 ring-black/7 hover:bg-brand-soft hover:text-brand-deep hover:ring-brand-line'
                          }`}
                        >
                          <span className="shrink-0 whitespace-nowrap font-semibold">{roundTag}</span>
                          <span className="min-w-0 max-w-[180px] truncate font-mono-code">"{ev.quote}"</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <p className="mt-2.5 flex items-start gap-1.5 border-t border-black/5 pt-2 text-[12px] leading-relaxed text-muted">
                <Info aria-hidden="true" className="mt-[3px] size-3.5 shrink-0 text-faint" />
                <span>{field.engineeringNote}</span>
              </p>
            </div>
          );
        })}
      </div>

      {/* 渐进折叠次要细节 */}
      {statusFilter === 'all' && secondaryOptionalFields.length > 0 && (
        <button
          type="button"
          onClick={() => setShowOptionalFields((prev) => !prev)}
          aria-expanded={showOptionalFields}
          className="inline-flex min-h-9.5 w-full items-center gap-2 rounded-xl bg-optional-bg/75 px-3.5 py-2 text-left text-[12.5px] leading-snug font-semibold text-optional-ink ring-1 ring-optional-line/70 hover:bg-optional-bg pointer-coarse:min-h-11"
        >
          {showOptionalFields ? (
            <ChevronUp className="size-4 shrink-0" />
          ) : (
            <ChevronDown className="size-4 shrink-0" />
          )}
          <span className="min-w-0">
            {showOptionalFields
              ? '收起不影响初报的细节项'
              : `查看另外 ${secondaryOptionalFields.length} 项本次不影响初报的细节（${secondaryOptionalFields
                  .map((f) => PLAIN_FIELD_LABELS[f.key].label.replace('？', ''))
                  .join('、')}）`}
          </span>
        </button>
      )}

      {/* 底部实时回信摘要坞（即使在焦点页签 A 也能直接看到回信准备状态并一键复制或跳转） */}
      {onAdvanceToReply && (
        <div className="reply-dock">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-[12.5px] font-bold text-ink">
              <span className="inline-flex items-center gap-1.5">
                <i className="live-dot bg-brand" aria-hidden="true" />
                英文回信草稿已同步就绪
              </span>
              {replyWordCount > 0 && (
                <span className="rounded bg-white px-1.5 py-0.5 font-mono-code text-[10.5px] font-semibold text-brand-deep ring-1 ring-brand-line tabular">
                  {replyWordCount} words
                </span>
              )}
              <span className="text-[11.5px] font-medium text-muted">
                {result.questions.length > 0
                  ? `已写入 ${result.questions.length} 个追问 · 绝不乱填未知参数`
                  : '无阻塞追问 · 已写好确认收单信'}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {replyText && (
              <button
                type="button"
                onClick={handleCopyReplyInline}
                className="ui-button lift min-h-9 px-3 text-[12px] pointer-coarse:min-h-11"
              >
                {copiedReplyInline ? <Check className="size-3.5 text-clear-ink" /> : <Copy className="size-3.5" />}
                {copiedReplyInline ? '已复制回信 ✓' : '直接复制英文回信'}
              </button>
            )}
            <button
              type="button"
              onClick={onAdvanceToReply}
              className="ui-button-cobalt lift min-h-9 shrink-0 px-3.5 text-[12.5px]"
            >
              <span>{result.questions.length > 0 ? '去核对追问与中文对照' : '查看回信正文与中文对照'}</span>
              <ArrowRight className="size-3.5 shrink-0" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
