import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowUpRight, Check, CheckCircle2, Copy, FlaskConical, X } from 'lucide-react';
import { formatBenchmarkMarkdown, runBenchmarkSuite } from '../engine/evaluator';
import type { EmailRound } from '../types/rfq';

interface BenchmarkDrawerProps {
  open: boolean;
  onClose: () => void;
  onLoadCase: (rounds: EmailRound[], title: string) => void;
}

export function BenchmarkDrawer({ open, onClose, onLoadCase }: BenchmarkDrawerProps) {
  const [copiedMd, setCopiedMd] = useState(false);

  const report = useMemo(() => (open ? runBenchmarkSuite() : null), [open]);

  if (!open || !report) return null;

  const handleCopyMarkdown = async () => {
    const md = formatBenchmarkMarkdown(report);
    let ok = false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(md);
        ok = true;
      }
    } catch {
      // fallback below
    }
    if (!ok) {
      try {
        const el = document.createElement('textarea');
        el.value = md;
        el.setAttribute('readonly', '');
        el.style.position = 'fixed';
        el.style.opacity = '0';
        document.body.appendChild(el);
        el.select();
        ok = document.execCommand('copy');
        document.body.removeChild(el);
      } catch {
        ok = false;
      }
    }
    if (ok) {
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 1800);
    }
  };

  const kpis = [
    {
      label: '单件目标案例通过率',
      value: `${report.passedTargetCases} / ${report.targetSinglePartCases}`,
      note: `另有 ${report.knownBoundaryCount} 个已知边界案例`,
      tone: 'text-clear-ink',
      accent: 'bg-clear-dot',
    },
    {
      label: '漏问关键项次数',
      value: String(report.totalMissedQuestions),
      note: '必问 P0/P1 未遗漏',
      tone: 'text-ink',
      accent: 'bg-brand',
    },
    {
      label: '重复追问次数',
      value: String(report.totalRepeatedQuestions),
      note: '已答/查旧单/待发不重复问',
      tone: 'text-ink',
      accent: 'bg-optional-dot',
    },
    {
      label: '擅自补值（幻觉）次数',
      value: String(report.totalHallucinations),
      note: '绝不脑补 304 / 1.5mm',
      tone: 'text-clear-ink',
      accent: 'bg-clear-dot',
    },
  ];

  return (
    <div
      className="overlay flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="benchmark-title" className="drawer-panel reveal max-w-3xl">
        <div className="drawer-head flex-wrap">
          <div className="flex min-w-0 flex-1 basis-56 items-start gap-3">
            <span className="drawer-icon" aria-hidden="true"><FlaskConical className="size-5" /></span>
            <div className="min-w-0">
              <span className="spec-label">BENCHMARK · 10 CASES LIVE</span>
              <h3 id="benchmark-title" className="drawer-title mt-0.5">10 封多样化英文询盘实时评测报告</h3>
              <p className="drawer-sub">
                每次打开均基于当前本地规则引擎实时运行全部 10 个案例，可直接用于计划书量化指标与失败案例记录。
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={handleCopyMarkdown} className="ui-button lift min-h-10 rounded-xl px-3 text-xs pointer-coarse:min-h-11">
              {copiedMd ? (
                <>
                  <Check className="h-3.5 w-3.5 text-clear-ink" />
                  已复制 Markdown 表
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  复制计划书实测表
                </>
              )}
            </button>
            <button type="button" onClick={onClose} aria-label="关闭实测报告" className="icon-close">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* 4 Live KPI Summary Cards */}
        <div className="grid grid-cols-2 gap-2.5 border-b border-line px-4 py-4 sm:grid-cols-4 sm:gap-3 sm:px-6">
          {kpis.map((kpi) => (
            <div key={kpi.label} className="card overflow-hidden p-3">
              <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-[2px] ${kpi.accent}`} />
              <div className="text-[11px] font-semibold text-muted">{kpi.label}</div>
              <div className={`mt-1.5 font-mono-code text-[24px] leading-tight font-bold tabular ${kpi.tone}`}>{kpi.value}</div>
              <div className="mt-1 text-[11px] leading-relaxed text-muted">{kpi.note}</div>
            </div>
          ))}
        </div>

        {/* Per-case List */}
        <div className="min-w-0 p-4 sm:p-6">
          <div className="flex flex-col gap-3">
            {report.results.map((item) => (
              <div
                key={item.caseId}
                className={`card p-4 [overflow-wrap:anywhere] ${
                  item.isKnownBoundaryCase
                    ? 'ring-1 ring-history-line'
                    : item.passed
                      ? ''
                      : 'ring-1 ring-ask-line'
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {item.isKnownBoundaryCase ? (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-history-dot" />
                    ) : item.passed ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-clear-dot" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 shrink-0 text-ask-dot" />
                    )}
                    <span className="text-[14px] font-bold text-ink">{item.title}</span>
                    <span className="chip tone-pending">{item.category}</span>
                    <span
                      className={`chip ${
                        item.isKnownBoundaryCase ? 'tone-history' : item.passed ? 'tone-clear' : 'tone-ask'
                      }`}
                    >
                      <i className="chip-dot" aria-hidden="true" />
                      {item.isKnownBoundaryCase ? '已知边界案例' : item.passed ? '实测通过' : '发现偏差'}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => onLoadCase(item.rounds, item.title)}
                    className="lift inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 self-start whitespace-nowrap rounded-lg border border-line-strong bg-white px-3 text-xs font-semibold text-ink hover:border-brand hover:text-brand-deep pointer-coarse:min-h-11"
                  >
                    载入工作台实测
                    <ArrowUpRight className="h-3 w-3 text-brand" />
                  </button>
                </div>

                <div className="mt-2.5 rounded-lg border-l-2 border-brand bg-mica px-3 py-2 font-mono-code text-[12px] leading-relaxed text-ink-2">
                  {item.rounds.map((r) => `R${r.roundNumber}: ${r.text}`).join('  |  ')}
                </div>

                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                  <span>{item.summaryNote}</span>
                  <span className="text-xs text-muted">
                    本轮追问：{item.actualAskedFields.length > 0 ? item.actualAskedFields.join(', ') : '无'}
                  </span>
                </div>

                {(item.missedQuestions.length > 0 ||
                  item.repeatedQuestions.length > 0 ||
                  item.hallucinations.length > 0 ||
                  (!item.isKnownBoundaryCase && item.statusMismatches.length > 0)) && (
                  <div className="mt-2 rounded-lg border border-ask-line bg-ask-bg px-2.5 py-1.5 text-[11.5px] text-ask-ink">
                    {[
                      item.missedQuestions.length ? `漏问: ${item.missedQuestions.join(', ')}` : '',
                      item.repeatedQuestions.length ? `重复问: ${item.repeatedQuestions.join(', ')}` : '',
                      item.hallucinations.length ? `擅自补值: ${item.hallucinations.join(', ')}` : '',
                      item.statusMismatches.length ? `状态差异: ${item.statusMismatches.join('; ')}` : '',
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
