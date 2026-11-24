import { useState } from 'react';
import { Check, CheckCircle2, ChevronDown, ChevronUp, ListChecks } from 'lucide-react';
import type { ClarificationQuestion, SkippedReason } from '../types/rfq';

interface ClarificationPanelProps {
  questions: ClarificationQuestion[];
  skippedQuestions: SkippedReason[];
  selectedQuestionIds: Set<string>;
  hoveredQuestionIdx?: number | null;
  onHoverQuestionIdx?: (idx: number | null) => void;
  onToggleQuestion: (questionId: string) => void;
}

function getPriorityStyle(priority: ClarificationQuestion['priority']): string {
  switch (priority) {
    case 'P0':
      return 'tone-ask';
    case 'P1':
      return 'tone-history';
    case 'P2':
      return 'tone-pending';
  }
}

export function ClarificationPanel({
  questions,
  skippedQuestions,
  selectedQuestionIds,
  hoveredQuestionIdx = null,
  onHoverQuestionIdx,
  onToggleQuestion,
}: ClarificationPanelProps) {
  const [showSkipped, setShowSkipped] = useState(false);
  const selectedCount = questions.filter((q) => selectedQuestionIds.has(q.id)).length;

  return (
    <section aria-labelledby="question-heading" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="question-heading" className="flex items-center gap-2 text-[14.5px] font-extrabold text-ink">
          <ListChecks aria-hidden="true" className="size-4.5 shrink-0 text-brand" />
          勾选要问客户的问题
        </h3>
        <span className="spec-label rounded-md bg-mica px-2 py-1 text-[10.5px] text-ink-2 ring-1 ring-black/6">
          建议问 <b className="font-mono-code font-bold text-ink tabular">{questions.length}</b> / 3 个
        </span>
      </div>

      {questions.length === 0 ? (
        <div className="reveal mt-3 flex items-start gap-2.5 rounded-[14px] border border-clear-line bg-clear-bg/75 p-4 text-[13px] leading-relaxed text-ink">
          <CheckCircle2 aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-clear-dot" />
          <div>
            <div className="font-bold text-clear-ink">该问的都清楚了！这一封不用再发问题去催客户</div>
            <p className="mt-1 text-ink-2">
              右侧英文回信已自动切换为“已收到并确认信息”的礼貌回复，核对中文意思后直接复制就能发。
            </p>
          </div>
        </div>
      ) : (
        <>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            <b className="font-semibold text-ink">一封信最多只问 3 件事</b>，勾选写入右侧回信，取消即删。
            <span className="ml-1.5 inline-block whitespace-nowrap font-mono-code font-bold text-brand tabular">
              已选 {selectedCount}
            </span>
          </p>
          <div className="mt-3 grid gap-2.5">
            {questions.map((q, idx) => {
              const checked = selectedQuestionIds.has(q.id);
              const isHovered = hoveredQuestionIdx === idx;
              return (
                <label
                  key={q.id}
                  onMouseEnter={() => onHoverQuestionIdx?.(idx)}
                  onMouseLeave={() => onHoverQuestionIdx?.(null)}
                  className={`group relative block min-w-0 cursor-pointer overflow-hidden rounded-[14px] p-3.5 transition-[background-color,box-shadow] duration-150 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-brand ${
                    checked
                      ? isHovered
                        ? 'bg-brand-soft/75 ring-2 ring-brand/60'
                        : 'bg-brand-soft/45 ring-1.5 ring-brand/45'
                      : 'bg-mica/80 ring-1 ring-black/7 hover:bg-white hover:ring-black/14'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full transition-colors ${
                      checked ? 'bg-brand' : 'bg-transparent'
                    }`}
                  />
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleQuestion(q.id)}
                        className="peer sr-only"
                      />
                      <span
                        className="tactile-box"
                        data-checked={checked ? 'true' : 'false'}
                        aria-hidden="true"
                      >
                        <Check className="size-3 stroke-[3]" />
                      </span>
                      <span
                        className={`inline-flex h-5.5 shrink-0 items-center whitespace-nowrap rounded-md px-2 font-mono-code text-[11px] font-bold ${
                          checked
                            ? 'bg-brand text-white'
                            : 'bg-white text-titan ring-1 ring-black/8'
                        }`}
                      >
                        第 {idx + 1} 问
                      </span>
                    </div>
                    <span className={`chip h-5.5 px-2 text-[10.5px] ${getPriorityStyle(q.priority)}`}>
                      <i className="chip-dot" aria-hidden="true" />
                      {q.priorityLabel}
                    </span>
                  </div>

                  <div className="mt-2 text-[13.5px] leading-snug font-bold text-ink">{q.zhQuestion}</div>
                  <p className="mt-1 text-[12px] leading-relaxed text-muted">为什么一定要问：{q.zhReason}</p>

                  <div className="mt-2 rounded-lg bg-white/90 px-2.5 py-2 text-[12px] leading-relaxed text-ink-2 ring-1 ring-black/6">
                    <span className="mr-1.5 inline-flex rounded border border-brand-line bg-brand-soft px-1.5 py-px font-mono-code text-[9.5px] font-bold tracking-wider text-brand-deep">
                      EN
                    </span>
                    <span lang="en" className="[overflow-wrap:anywhere]">
                      {q.enQuestion}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </>
      )}

      {skippedQuestions.length > 0 && (
        <div className="mt-3 border-t border-dashed border-line pt-2">
          <button
            type="button"
            onClick={() => setShowSkipped((prev) => !prev)}
            aria-expanded={showSkipped}
            className="flex min-h-9 w-full items-center justify-between gap-2 rounded-lg px-1 text-left text-[12px] leading-snug font-semibold text-muted hover:text-ink pointer-coarse:min-h-11"
          >
            <span>为什么没问其他事？（已自动避开 {skippedQuestions.length} 个不该重复问的问题）</span>
            {showSkipped ? <ChevronUp className="size-4 shrink-0" /> : <ChevronDown className="size-4 shrink-0" />}
          </button>
          {showSkipped && (
            <ul className="reveal well-soft mt-1.5 grid gap-2 p-3 text-[12px] leading-relaxed text-ink-2">
              {skippedQuestions.map((sk, i) => (
                <li key={`${sk.fieldKey}-${i}`} className="flex gap-2">
                  <span aria-hidden="true" className="mt-[7px] size-1.5 shrink-0 rounded-full bg-faint" />
                  <span>
                    <strong className="text-ink">{sk.fieldTitle}：</strong>
                    {sk.reason}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
