import {
  Crosshair,
  Languages,
  Mail,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  Wand2,
  X,
  Zap,
} from 'lucide-react';
import type { EmailRound, EvidenceSpan } from '../types/rfq';
import { HighlightableTextarea } from './HighlightableTextarea';

export type JudgeMutationAction =
  | 'add_316l'
  | 'remove_history_thickness'
  | 'switch_to_revision'
  | 'al_add_5052'
  | 'al_pick_powder'
  | 'al_remove_step'
  | 'ms_add_qty'
  | 'ms_add_spcc'
  | 'ms_add_zinc'
  | 'reset_round1';

const PRESET_MUTATIONS: Record<string, ReadonlyArray<{ action: JudgeMutationAction; label: string }>> = {
  'stainless-bracket': [
    { action: 'add_316l', label: '假如客户补了“316L”型号' },
    { action: 'remove_history_thickness', label: '假如删掉“和上次一样”' },
    { action: 'switch_to_revision', label: '假如把 500 改成 2,000' },
    { action: 'reset_round1', label: '恢复原邮件' },
  ],
  'aluminum-enclosure': [
    { action: 'al_add_5052', label: '假如补了“5052-H32”牌号' },
    { action: 'al_pick_powder', label: '假如选定“黑色喷粉”' },
    { action: 'al_remove_step', label: '假如删掉“已附 STEP 图”' },
    { action: 'reset_round1', label: '恢复原邮件' },
  ],
  'mild-steel-plate': [
    { action: 'ms_add_qty', label: '假如补了“1,000 个”数量' },
    { action: 'ms_add_spcc', label: '假如补了“SPCC 2.0 mm”' },
    { action: 'ms_add_zinc', label: '假如补了“镀锌防锈”' },
    { action: 'reset_round1', label: '恢复原邮件' },
  ],
};

interface EmailThreadPanelProps {
  rounds: EmailRound[];
  allEvidenceSpans: EvidenceSpan[];
  activeSpan: EvidenceSpan | null;
  roundTranslations: Record<string, string>;
  hasDemoRound2: boolean;
  activePresetId: string | null;
  isLlmMode: boolean;
  isAnalyzing: boolean;
  onUpdateRoundText: (roundId: string, nextText: string) => void;
  onAddEmptyRound: () => void;
  onFillDemoRound2: () => void;
  onRemoveRound: (roundId: string) => void;
  onClearActiveSpan: () => void;
  onCursorSpanChange?: (span: EvidenceSpan | null) => void;
  onTriggerLlmAnalyze: () => void;
  onApplyJudgeMutation: (action: JudgeMutationAction) => void;
}

export function EmailThreadPanel({
  rounds,
  allEvidenceSpans,
  activeSpan,
  roundTranslations,
  hasDemoRound2,
  activePresetId,
  isLlmMode,
  isAnalyzing,
  onUpdateRoundText,
  onAddEmptyRound,
  onFillDemoRound2,
  onRemoveRound,
  onClearActiveSpan,
  onCursorSpanChange,
  onTriggerLlmAnalyze,
  onApplyJudgeMutation,
}: EmailThreadPanelProps) {
  const activeMutations = activePresetId ? PRESET_MUTATIONS[activePresetId] : undefined;

  return (
    <section
      aria-labelledby="rfq-email-title"
      className="stage-shell flex min-w-0 flex-col gap-4 p-4 sm:p-5"
    >
      <header className="stage-heading">
        <div className="flex min-w-0 items-center gap-3">
          <span className="stage-icon" aria-hidden="true">
            <Mail />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="step-pill shrink-0 whitespace-nowrap">SOURCE · 第一步</span>
              <h2 id="rfq-email-title" className="stage-title">
                客户英文来信
              </h2>
            </div>
            <p className="stage-lede">
              <mark className="rounded-[3px] bg-history-bg px-1 text-ink shadow-[inset_0_-2px_var(--color-history-dot)]">
                黄底原话
              </mark>{' '}
              代表系统锚定的英文依据，改任意词都会实时重算并联动中文。
            </p>
          </div>
        </div>
      </header>

      {isLlmMode && (
        <button
          type="button"
          disabled={isAnalyzing}
          onClick={onTriggerLlmAnalyze}
          className="ui-button-primary lift self-start disabled:opacity-60"
        >
          <RefreshCw className={`size-3.5 ${isAnalyzing ? 'motion-safe:animate-spin' : ''}`} />
          {isAnalyzing ? '分析中...' : '让大模型重读一次'}
        </button>
      )}

      {activeSpan && (
        <div className="reveal flex flex-wrap items-center gap-2 rounded-xl border border-brand-line bg-brand-soft px-3.5 py-2.5 text-[12.5px] text-brand-deep">
          <Crosshair className="size-4 shrink-0 text-brand" />
          <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
            <span className="whitespace-nowrap">定位第 {activeSpan.roundNumber} 封原话：</span>
            <code className="font-mono-code font-bold">"{activeSpan.quote}"</code>
          </span>
          <button
            type="button"
            onClick={onClearActiveSpan}
            className="inline-flex min-h-7 shrink-0 items-center gap-1 rounded-lg border border-brand-line bg-white px-2.5 text-[11.5px] font-semibold text-brand-deep hover:bg-brand-tint pointer-coarse:min-h-11"
          >
            <X className="size-3" />
            取消聚焦
          </button>
        </div>
      )}

      <div className="flex flex-col gap-5">
        {rounds.map((round, roundIdx) => {
          const liveZh = roundTranslations[round.id];
          const isFirst = round.roundNumber === 1;
          return (
            <article key={round.id} className="relative min-w-0">
              {roundIdx > 0 && (
                <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold text-clear-ink">
                  <span className="h-px flex-1 bg-clear-line" />
                  <span className="rounded-full bg-clear-bg px-2.5 py-0.5 ring-1 ring-clear-line">
                    客户补充回复 · 增量合并更新
                  </span>
                  <span className="h-px flex-1 bg-clear-line" />
                </div>
              )}

              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className={`chip shrink-0 whitespace-nowrap ${isFirst ? 'tone-brand' : 'tone-clear'}`}>
                    <i className="chip-dot" aria-hidden="true" />
                    {isFirst ? '第 1 封邮件' : `第 ${round.roundNumber} 封补充`}
                  </span>
                  <span className="text-[12px] font-medium text-muted">{round.label}</span>
                </div>
                {round.roundNumber > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveRound(round.id)}
                    className="inline-flex min-h-8 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold text-muted hover:bg-ask-bg hover:text-ask-ink pointer-coarse:min-h-11"
                  >
                    <Trash2 className="size-3.5" />
                    删掉这封
                  </button>
                )}
              </div>

              {isFirst && activeMutations && (
                <div className="well-soft mb-3 p-3">
                  <p className="mb-2 flex items-center gap-1.5 text-[11.5px] font-bold text-ink">
                    <Wand2 className="size-3.5 text-brand" />
                    路演互动：点一下试试实时改字效果
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {activeMutations.map(({ action, label }) => (
                      <button
                        key={action}
                        type="button"
                        onClick={() => onApplyJudgeMutation(action)}
                        className={`magic-chip lift pointer-coarse:min-h-11 ${
                          action === 'reset_round1' ? 'is-reset' : ''
                        }`}
                      >
                        {action === 'reset_round1' && <RotateCcw className="size-3" />}
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <HighlightableTextarea
                roundId={round.id}
                value={round.text}
                onChange={(next) => onUpdateRoundText(round.id, next)}
                spans={allEvidenceSpans}
                activeSpan={activeSpan}
                onCursorSpanChange={onCursorSpanChange}
                ariaLabel={`第 ${round.roundNumber} 轮英文邮件正文`}
                placeholder={
                  isFirst
                    ? '把客户发来的英文邮件粘到这里（比如：Please quote 500 stainless brackets...）'
                    : '把客户后补的英文回复粘到这里（比如：304 stainless, 1.5 mm. Drawing to follow.）'
                }
              />

              {round.text.trim().length > 0 && (
                <div className="well-soft relative mt-3 overflow-hidden py-3 pr-4 pl-4.5">
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-brand"
                  />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-ink">
                      <Languages className="size-4 shrink-0 text-brand" />
                      实时中文翻译
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono-code text-[10.5px] font-medium text-muted">
                      <i className="live-dot bg-brand" aria-hidden="true" />
                      改英文实时联动
                    </span>
                  </div>
                  <p
                    key={liveZh || 'pending'}
                    className="zh-refresh mt-1.5 -mx-1 rounded px-1 py-0.5 whitespace-pre-line text-[length:var(--fs-zh)] leading-[1.7] text-ink [overflow-wrap:anywhere]"
                  >
                    {liveZh || '正在翻译中...'}
                  </p>
                </div>
              )}
            </article>
          );
        })}
      </div>

      {rounds.length < 3 && (
        <div className="flex flex-col gap-2 border-t border-line/70 pt-3.5">
          {rounds.length === 1 && hasDemoRound2 && (
            <button
              type="button"
              onClick={onFillDemoRound2}
              className="ui-button-primary lift w-full min-h-[42px] text-[13.5px]"
            >
              <Zap className="size-4 shrink-0 text-amber-300" />
              模拟下一步：填入客户的补充回复，看状态闭环
            </button>
          )}
          <button type="button" onClick={onAddEmptyRound} className="ui-button lift w-full">
            <Plus className="size-3.5 shrink-0" />
            {rounds.length === 1 ? '手动粘一封客户的补充回复' : '继续添加第 3 封回复'}
          </button>
        </div>
      )}
    </section>
  );
}
