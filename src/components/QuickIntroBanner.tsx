import { Check, ChevronDown, ChevronUp, Play, Sparkles, X } from 'lucide-react';

interface QuickIntroBannerProps {
  open: boolean;
  hiddenInPitch?: boolean;
  onToggle: () => void;
  onStartTour?: () => void;
}

const COMPARE_PAIRS = [
  {
    code: '01',
    before: '只写“不锈钢”就硬报（304/316L 差价大易亏钱）',
    after: '红黄绿一眼标清缺漏',
    detail: '没写的规格标成“未指定”，绝不替你瞎猜。',
  },
  {
    code: '02',
    before: '客户说“和上次一样”还去追问，显得不专业',
    after: '先自动翻工厂旧单库',
    detail: '支持 Excel/CSV 匹配带入，查不到再勾选问客户。',
  },
  {
    code: '03',
    before: '英文看不懂，让 AI 直写又怕悄悄脑补 1.5mm',
    after: '实时中文翻译，最多只问 3 件事',
    detail: '回信严格按核对信息生成，发信前附中文对照。',
  },
];

export function QuickIntroBanner({
  open,
  hiddenInPitch = false,
  onToggle,
  onStartTour,
}: QuickIntroBannerProps) {
  if (hiddenInPitch) return null;

  return (
    <section className="page-wrap intro-wrap" aria-labelledby="intro-title">
      <div className="intro-shell">
        <div className="intro-bar">
          <div className="intro-lead">
            <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
              <span className="guide-chip">
                <Sparkles size={11} aria-hidden="true" />
                3 秒看懂
              </span>
              <div className="flex items-center gap-1.5 sm:hidden">
                {onStartTour && (
                  <button
                    type="button"
                    className="intro-toggle border-brand-line bg-brand-soft/80 text-brand-deep"
                    onClick={onStartTour}
                  >
                    <Play size={11} aria-hidden="true" />
                    4步导览
                  </button>
                )}
                <button
                  type="button"
                  className="intro-toggle"
                  onClick={onToggle}
                  aria-expanded={open}
                  aria-controls="intro-reasons"
                >
                  {open ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
                  {open ? '收起' : '展开'}
                </button>
              </div>
            </div>
            <h2 id="intro-title">
              英文询盘，<span className="intro-accent">问清再报价</span>。
            </h2>
            <p className="intro-sub">
              粘进老外英文信，自动拆成大白话中文核对单，再写出绝不瞎编参数的英文回信。
            </p>
          </div>

          {/* 钣金折弯零件迷你蓝图示意图（大屏一眼识别垂直行业） */}
          <div
            aria-hidden="true"
            className="blueprint-card hidden items-center gap-3 px-3 py-1.5 lg:flex"
          >
            <svg width="112" height="46" viewBox="0 0 112 46" fill="none" className="shrink-0">
              {/* Vertical wall of L-bracket */}
              <path
                d="M14 10 L36 6 L36 28 L14 32 Z"
                fill="#dbe6ff"
                stroke="#2447ff"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              {/* Bottom flange */}
              <path
                d="M14 32 L36 28 L66 34 L44 38 Z"
                fill="#eef2ff"
                stroke="#2447ff"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              {/* Dashed bend line */}
              <line x1="14" y1="32" x2="36" y2="28" stroke="#d97706" strokeWidth="1.5" strokeDasharray="3 2" />
              {/* Mounting holes */}
              <ellipse cx="25" cy="18" rx="3" ry="3.8" fill="#ffffff" stroke="#2447ff" strokeWidth="1.2" />
              <ellipse cx="42" cy="33" rx="3.8" ry="2.2" fill="#ffffff" stroke="#2447ff" strokeWidth="1.2" />
              {/* Dimension ticks */}
              <line x1="8" y1="10" x2="8" y2="32" stroke="#64748b" strokeWidth="0.9" />
              <line x1="6" y1="10" x2="10" y2="10" stroke="#64748b" strokeWidth="0.9" />
              <line x1="6" y1="32" x2="10" y2="32" stroke="#64748b" strokeWidth="0.9" />
              {/* Spec tags */}
              <rect x="70" y="5" width="38" height="11" rx="3" fill="#fff1f4" stroke="#fecdd8" />
              <text x="89" y="13" textAnchor="middle" fill="#b91c43" fontSize="8" fontWeight="700" fontFamily="monospace">
                304?
              </text>
              <rect x="70" y="18" width="38" height="11" rx="3" fill="#fffbeb" stroke="#fde2a3" />
              <text x="89" y="26" textAnchor="middle" fill="#8f4707" fontSize="8" fontWeight="700" fontFamily="monospace">
                t=旧单?
              </text>
              <rect x="70" y="31" width="38" height="11" rx="3" fill="#fff1f4" stroke="#fecdd8" />
              <text x="89" y="39" textAnchor="middle" fill="#b91c43" fontSize="8" fontWeight="700" fontFamily="monospace">
                STEP?
              </text>
            </svg>
            <div className="leading-tight">
              <div className="font-mono-code text-[10px] font-bold text-brand-deep">SHEET METAL RFQ</div>
              <div className="mt-0.5 text-[11px] font-semibold text-ink-2">专注单件钣金折弯</div>
              <div className="text-[10.5px] text-muted">先查缺项 · 绝不脑补</div>
            </div>
          </div>

          <div className="intro-right hidden sm:flex">
            {onStartTour && (
              <button
                type="button"
                className="intro-toggle border-brand-line bg-brand-soft/75 text-brand-deep hover:bg-brand-tint"
                onClick={onStartTour}
              >
                <Play size={11} aria-hidden="true" />
                4步交互导览
              </button>
            )}
            <button
              type="button"
              className="intro-toggle"
              onClick={onToggle}
              aria-expanded={open}
              aria-controls="intro-reasons"
            >
              {open ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
              {open ? '收起痛点对比' : '展开痛点对比'}
            </button>
          </div>
        </div>

        <div id="intro-reasons" className="intro-collapse" data-open={open} inert={!open}>
          <div>
            <div className="compare-strip">
              {COMPARE_PAIRS.map((item) => (
                <div key={item.code} className="compare-cell">
                  <div className="compare-old">
                    <span className="inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-ask-bg text-ask-ink">
                      <X size={10} strokeWidth={2.6} aria-hidden="true" />
                    </span>
                    <span>
                      <s>{item.before}</s>
                    </span>
                  </div>
                  <div className="compare-new">
                    <span className="mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-full bg-clear-bg text-clear-ink">
                      <Check size={10} strokeWidth={2.8} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <b className="text-ink">{item.after}</b>
                      <span className="text-muted"> · {item.detail}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
