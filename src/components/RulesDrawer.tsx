import { BookOpen, ShieldCheck, X } from 'lucide-react';
import { SHEET_METAL_RULES_CATALOG } from '../data/rulesCatalog';

interface RulesDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function RulesDrawer({ open, onClose }: RulesDrawerProps) {
  if (!open) return null;

  return (
    <div
      className="overlay flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="rules-title" className="drawer-panel reveal max-w-2xl">
        <div className="drawer-head">
          <div className="flex min-w-0 items-start gap-3">
            <span className="drawer-icon" aria-hidden="true"><BookOpen className="size-5" /></span>
            <div className="min-w-0">
              <span className="spec-label">RULEBOOK · PROTOLABS MATRIX</span>
              <h3 id="rules-title" className="drawer-title mt-0.5">钣金件报价前澄清字段与判断规则表</h3>
              <p className="drawer-sub">
                结合 Protolabs 钣金报价要素与材料成型工艺约束，决定「查旧单 / 问客户 / 暂不问」。
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭规则表" className="icon-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-w-0 p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap gap-1.5">
            <span className="chip tone-ask"><i className="chip-dot" aria-hidden="true" />P0 必须问清才能报价</span>
            <span className="chip tone-history"><i className="chip-dot" aria-hidden="true" />P1 影响报价准确度</span>
            <span className="chip tone-pending"><i className="chip-dot" aria-hidden="true" />P2 可后补</span>
          </div>
          <div className="flex flex-col gap-3">
            {SHEET_METAL_RULES_CATALOG.map((rule) => (
              <div key={rule.key} className="card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-[15px] font-bold text-ink">{rule.title}</span>
                    <span className="font-mono-code text-[11px] text-muted">{rule.englishTitle}</span>
                  </div>
                  <span
                    className={`chip ${
                      rule.defaultPriority === 'P0'
                        ? 'tone-ask'
                        : rule.defaultPriority === 'P1'
                          ? 'tone-history'
                          : 'tone-pending'
                    }`}
                  >
                    <i className="chip-dot" aria-hidden="true" />
                    默认 {rule.defaultPriority}
                  </span>
                </div>

                <dl className="mt-3 grid grid-cols-1 gap-3 text-[12.5px] leading-relaxed text-ink-2">
                  <div>
                    <dt className="font-semibold text-ink">为什么影响报价与成型：</dt>
                    <dd className="mt-0.5 leading-relaxed">{rule.whyItMatters}</dd>
                  </div>
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    <div className="rounded-xl bg-ask-bg/60 p-3 ring-1 ring-ask-line/60">
                      <dt className="flex items-center gap-1.5 font-bold text-ask-ink"><i aria-hidden="true" className="size-1.5 rounded-full bg-ask-dot" />触发追问条件</dt>
                      <dd className="mt-1">{rule.askCondition}</dd>
                    </div>
                    <div className="rounded-xl bg-clear-bg/60 p-3 ring-1 ring-clear-line/60">
                      <dt className="flex items-center gap-1.5 font-bold text-clear-ink"><i aria-hidden="true" className="size-1.5 rounded-full bg-clear-dot" />跳过/不重复问条件</dt>
                      <dd className="mt-1">{rule.skipCondition}</dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 rounded-xl bg-brand-soft/80 px-3.5 py-2.5 text-brand-deep ring-1 ring-brand-line/60">
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
                    <span>
                      <strong>防幻觉底线：</strong>
                      {rule.antiHallucinationRule}
                    </span>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
