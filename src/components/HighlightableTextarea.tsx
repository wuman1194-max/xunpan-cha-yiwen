import { useEffect, useMemo, useRef } from 'react';
import type { EvidenceSpan } from '../types/rfq';

interface HighlightableTextareaProps {
  roundId: string;
  value: string;
  onChange: (next: string) => void;
  spans: EvidenceSpan[];
  activeSpan: EvidenceSpan | null;
  onCursorSpanChange?: (span: EvidenceSpan | null) => void;
  placeholder?: string;
  ariaLabel?: string;
}

interface TextSegment {
  text: string;
  kind: 'plain' | 'matched' | 'active';
}

function buildSegments(
  text: string,
  spans: EvidenceSpan[],
  activeSpan: EvidenceSpan | null,
  roundId: string,
): TextSegment[] {
  if (!text) return [];

  const roundSpans = spans
    .filter((s) => s.roundId === roundId && s.start >= 0 && s.end > s.start && s.end <= text.length)
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const activeForRound =
    activeSpan &&
    activeSpan.roundId === roundId &&
    activeSpan.start >= 0 &&
    activeSpan.end > activeSpan.start &&
    activeSpan.end <= text.length
      ? activeSpan
      : null;

  const states = new Uint8Array(text.length);
  for (const s of roundSpans) {
    for (let i = s.start; i < s.end; i += 1) {
      if (states[i] < 1) states[i] = 1;
    }
  }
  if (activeForRound) {
    for (let i = activeForRound.start; i < activeForRound.end; i += 1) {
      states[i] = 2;
    }
  }

  const segments: TextSegment[] = [];
  let segStart = 0;
  let currentState = states[0];

  const pushSeg = (from: number, to: number, st: number) => {
    const kind: TextSegment['kind'] = st === 2 ? 'active' : st === 1 ? 'matched' : 'plain';
    segments.push({ text: text.slice(from, to), kind });
  };

  for (let i = 1; i < text.length; i += 1) {
    if (states[i] !== currentState) {
      pushSeg(segStart, i, currentState);
      segStart = i;
      currentState = states[i];
    }
  }
  pushSeg(segStart, text.length, currentState);
  return segments;
}

/**
 * 双层镜像高亮编辑器（0px 像素对齐）
 * - 底层镜像 <div> 与上层透明 <textarea> 100% 共用 sharedTypographyClass
 * - 字号随 CSS 变量 --fs-code 在常规态/路演态同步缩放，零错位、无内部滚动条
 */
export function HighlightableTextarea({
  roundId,
  value,
  onChange,
  spans,
  activeSpan,
  onCursorSpanChange,
  placeholder,
  ariaLabel,
}: HighlightableTextareaProps) {
  const activeMarkRef = useRef<HTMLElement | null>(null);

  const roundSpans = useMemo(
    () =>
      spans
        .filter((s) => s.roundId === roundId && s.start >= 0 && s.end > s.start && s.end <= value.length)
        .sort((a, b) => a.start - b.start || a.end - b.end),
    [spans, roundId, value.length],
  );

  const handleCursorInspect = (pos: number | null | undefined) => {
    if (!onCursorSpanChange) return;
    if (pos == null || Number.isNaN(pos)) {
      onCursorSpanChange(null);
      return;
    }
    const hit = roundSpans.find((s) => s.start <= pos && pos <= s.end) || null;
    onCursorSpanChange(hit);
  };

  const segments = useMemo(
    () => buildSegments(value, spans, activeSpan, roundId),
    [value, spans, activeSpan, roundId],
  );

  const matchedCount = useMemo(() => segments.filter((s) => s.kind !== 'plain').length, [segments]);
  const wordCount = useMemo(() => (value.trim() ? value.trim().split(/\s+/).length : 0), [value]);

  useEffect(() => {
    if (activeSpan && activeSpan.roundId === roundId && activeMarkRef.current) {
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      activeMarkRef.current.scrollIntoView({
        behavior: prefersReducedMotion ? 'instant' : 'smooth',
        block: 'center',
      });
    }
  }, [activeSpan, roundId]);

  const sharedTypographyClass =
    'px-4 py-3.5 font-mono-code text-[length:var(--fs-code)] leading-[1.72] tracking-normal whitespace-pre-wrap break-words';

  return (
    <div className="min-w-0 overflow-hidden rounded-[14px] border border-line-strong/80 bg-white transition-[border-color,box-shadow] focus-within:border-brand focus-within:ring-3 focus-within:ring-brand/14">
      <div
        aria-hidden="true"
        className="flex min-w-0 items-center gap-2 border-b border-line/80 bg-mica px-3.5 py-2 text-[11.5px] text-muted"
      >
        <span className="shrink-0 whitespace-nowrap rounded-md border border-brand-line bg-brand-soft px-1.5 py-0.5 font-mono-code text-[10px] font-bold tracking-wider text-brand-deep">
          EN
        </span>
        <span className="min-w-0 truncate font-semibold text-ink-2">客户英文原文（可直接改字测试）</span>
        <span className="ml-auto inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap font-mono-code text-[11px] text-muted tabular">
          <i className="h-2.5 w-2.5 rounded-[2px] bg-history-bg shadow-[inset_0_-2px_var(--color-history-dot)]" />
          <span>{matchedCount} 处依据</span>
          <span className="text-line-strong">·</span>
          <span>{wordCount} 词</span>
        </span>
      </div>

      <div className="relative min-h-[108px] min-w-0">
        <div
          aria-hidden="true"
          className={`${sharedTypographyClass} pointer-events-none min-h-[108px] text-ink select-none`}
        >
          {value.length === 0 ? (
            <span className="text-faint">{placeholder || ''}</span>
          ) : (
            segments.map((seg, idx) => {
              if (seg.kind === 'active') {
                return (
                  <mark
                    key={`${idx}-active`}
                    ref={activeMarkRef}
                    className="active-evidence-mark rounded-[3px] bg-brand-tint text-brand-deep"
                  >
                    {seg.text}
                  </mark>
                );
              }
              if (seg.kind === 'matched') {
                return (
                  <mark
                    key={`${idx}-matched`}
                    className="rounded-[3px] bg-history-bg text-ink shadow-[inset_0_-2px_var(--color-history-dot)]"
                  >
                    {seg.text}
                  </mark>
                );
              }
              return <span key={`${idx}-plain`}>{seg.text}</span>;
            })
          )}
          {value.endsWith('\n') ? '\u00A0' : ''}
        </div>

        <textarea
          aria-label={ariaLabel}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => handleCursorInspect(e.currentTarget.selectionStart)}
          onKeyUp={(e) => handleCursorInspect(e.currentTarget.selectionStart)}
          onSelect={(e) => handleCursorInspect(e.currentTarget.selectionStart)}
          onBlur={() => onCursorSpanChange?.(null)}
          spellCheck={false}
          placeholder=""
          className={`${sharedTypographyClass} absolute inset-0 h-full w-full resize-none overflow-hidden bg-transparent text-transparent caret-brand selection:bg-brand/20 focus:outline-none`}
        />
      </div>
    </div>
  );
}
