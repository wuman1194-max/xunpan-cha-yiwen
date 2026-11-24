import { useEffect, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Languages,
  MailCheck,
  PenLine,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { ReplyTone } from '../types/rfq';

async function safeCopyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below for non-HTTPS LAN preview
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

interface ReplyDraftPanelProps {
  replyText: string;
  replyZhPreview: string;
  subjectLine?: string;
  highlightedQuestionIdx?: number | null;
  isDirty: boolean;
  tone: ReplyTone;
  onChangeReplyText: (next: string) => void;
  onChangeTone: (tone: ReplyTone) => void;
  onResetFromAnalysis: () => void;
}

export function ReplyDraftPanel({
  replyText,
  replyZhPreview,
  subjectLine = '',
  highlightedQuestionIdx = null,
  isDirty,
  tone,
  onChangeReplyText,
  onChangeTone,
  onResetFromAnalysis,
}: ReplyDraftPanelProps) {
  const [copied, setCopied] = useState(false);
  const [copiedSubject, setCopiedSubject] = useState(false);
  const [showZhPreview, setShowZhPreview] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    const syncHeight = () => {
      el.style.height = 'auto';
      el.style.height = `${Math.max(200, el.scrollHeight + 10)}px`;
    };
    syncHeight();
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(syncHeight);
      ro.observe(el);
    }
    window.addEventListener('resize', syncHeight);
    return () => {
      ro?.disconnect();
      window.removeEventListener('resize', syncHeight);
    };
  }, [replyText]);

  const handleCopy = async () => {
    const ok = await safeCopyText(replyText);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  };

  const handleCopySubject = async () => {
    if (!subjectLine) return;
    const ok = await safeCopyText(subjectLine);
    if (ok) {
      setCopiedSubject(true);
      setTimeout(() => setCopiedSubject(false), 1800);
    }
  };

  const wordCount = replyText.trim() ? replyText.trim().split(/\s+/).length : 0;

  return (
    <section aria-labelledby="draft-heading" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="draft-heading" className="flex items-center gap-2 text-[14.5px] font-extrabold text-ink">
          <MailCheck aria-hidden="true" className="size-4.5 shrink-0 text-brand" />
          帮你写好的英文回信
        </h3>
        <span className="font-mono-code text-[11px] font-medium text-faint tabular">{wordCount} words</span>
      </div>

      {/* 信纸级商务英文编辑器 */}
      <div className="mt-2.5 overflow-hidden rounded-[16px] border border-line-strong/80 bg-white shadow-[0_6px_22px_-14px_rgb(15_23_42/18%)] transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/14">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/80 bg-mica px-3.5 py-2.5">
          <div className="flex items-center gap-2">
            <span className="inline-flex shrink-0 items-center rounded-md border border-brand-line bg-brand-soft px-1.5 py-0.5 font-mono-code text-[10px] font-bold tracking-wider text-brand-deep">
              EN
            </span>
            {isDirty ? (
              <span className="chip tone-history h-5.5 text-[11px]">
                <PenLine className="size-3" />
                你已手动修改
              </span>
            ) : (
              <span className="chip tone-brand h-5.5 text-[11px]">
                <Sparkles className="size-3" />
                按核对结果自动生成
              </span>
            )}
            {highlightedQuestionIdx !== null && (
              <span className="chip tone-brand hidden h-5.5 text-[10.5px] sm:inline-flex">
                正在联动左侧第 {highlightedQuestionIdx + 1} 问
              </span>
            )}
          </div>

          <div
            role="group"
            aria-label="回信语气"
            className="inline-flex items-center rounded-lg bg-well p-0.5"
          >
            {(['concise', 'polite'] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={tone === value}
                onClick={() => onChangeTone(value)}
                className={`min-h-7 shrink-0 whitespace-nowrap rounded-md px-2.5 text-[11.5px] font-semibold transition-all pointer-coarse:min-h-11 ${
                  tone === value
                    ? 'bg-white text-ink shadow-[0_1px_2px_rgb(15_23_42/10%)]'
                    : 'text-muted hover:text-ink'
                }`}
              >
                {value === 'concise' ? '干脆利落' : '更客气礼貌'}
              </button>
            ))}
          </div>
        </div>

        {subjectLine && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line/70 bg-white px-4 py-2 text-[12px]">
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="shrink-0 font-mono-code text-[10.5px] font-bold uppercase tracking-wider text-faint">
                Subject
              </span>
              <span lang="en" className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere]">
                {subjectLine}
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopySubject}
              className="inline-flex min-h-6.5 shrink-0 items-center gap-1 rounded-md bg-mica px-2 text-[11px] font-semibold text-ink-2 ring-1 ring-black/7 hover:bg-brand-soft hover:text-brand-deep pointer-coarse:min-h-10"
            >
              {copiedSubject ? <Check className="size-3 text-clear-ink" /> : <Copy className="size-3" />}
              {copiedSubject ? '已复制标题 ✓' : '复制邮件标题'}
            </button>
          </div>
        )}

        <textarea
          ref={textareaRef}
          aria-label="帮你写好的英文回信"
          lang="en"
          value={replyText}
          onChange={(e) => onChangeReplyText(e.target.value)}
          rows={9}
          spellCheck={false}
          className="block min-h-[200px] w-full resize-none overflow-hidden bg-transparent px-4 py-3.5 text-[length:var(--fs-reply)] leading-[1.68] text-ink outline-none"
        />

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line/80 bg-mica px-3.5 py-3">
          <button
            type="button"
            onClick={handleCopy}
            className={`ui-button-cobalt lift min-h-10 rounded-xl px-4.5 text-[13px] pointer-coarse:min-h-11 ${
              copied
                ? 'border-[#065f46] bg-[linear-gradient(180deg,#0d9c6f,#066a4e)] shadow-[0_6px_16px_-8px_rgb(6_106_78/65%)]'
                : ''
            }`}
          >
            {copied ? <Check className="size-4 shrink-0" /> : <Copy className="size-4 shrink-0" />}
            <span aria-live="polite">{copied ? '已复制！去粘贴发邮件吧' : '一键复制英文回信'}</span>
          </button>
          {isDirty ? (
            <button
              type="button"
              onClick={onResetFromAnalysis}
              className="lift inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-history-line bg-history-bg px-3 text-[12px] font-semibold text-history-ink hover:bg-[#fef3c7] pointer-coarse:min-h-11"
            >
              <RotateCcw className="size-3.5 shrink-0" />
              重新生成这封信
            </button>
          ) : (
            <span className="text-[12px] text-muted">正文支持直接微调再复制</span>
          )}
        </div>
      </div>

      {isDirty && (
        <p className="mt-2 text-[11.5px] leading-snug text-history-ink">
          已锁定你手改的正文，勾选左侧问题不会覆盖；想按最新清单重写请点「重新生成这封信」。
        </p>
      )}

      {replyZhPreview && (
        <div className="well-soft relative mt-3 overflow-hidden pr-3.5 pl-4.5">
          <span
            aria-hidden="true"
            className="absolute inset-y-2.5 left-0 w-[3px] rounded-r-full bg-brand"
          />
          <div className="flex items-center justify-between gap-2 py-2">
            <span className="flex min-w-0 items-center gap-2 text-[12.5px] leading-snug font-bold text-ink">
              <Languages className="size-4 shrink-0 text-brand" />
              <span className="min-w-0">中文对照（发信前核对意思）</span>
            </span>
            <button
              type="button"
              aria-expanded={showZhPreview}
              onClick={() => setShowZhPreview((prev) => !prev)}
              className="inline-flex min-h-8 shrink-0 items-center gap-0.5 whitespace-nowrap rounded-lg px-2 text-[12px] font-semibold text-brand hover:bg-brand-soft pointer-coarse:min-h-11"
            >
              {showZhPreview ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {showZhPreview ? '收起' : '展开'}
            </button>
          </div>
          {showZhPreview && (
            <div
              key={replyZhPreview}
              className="zh-refresh -mx-1 mb-3 rounded border-t border-black/6 px-1 pt-2.5 pb-0.5 text-[13px] leading-[1.72] whitespace-pre-wrap text-ink-2 [overflow-wrap:anywhere]"
            >
              {replyZhPreview}
            </div>
          )}
        </div>
      )}

      <p className="mt-2.5 flex items-start gap-2 rounded-xl bg-clear-bg/70 px-3 py-2 text-[12px] leading-snug text-clear-ink ring-1 ring-clear-line/70">
        <ShieldCheck className="mt-0.5 size-4 shrink-0" />
        只按上面核对过的信息写信，绝不替你乱填没确认过的型号或厚度
      </p>
    </section>
  );
}
