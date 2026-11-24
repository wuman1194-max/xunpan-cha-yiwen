import { Check, FileText, Files, PenLine } from 'lucide-react';
import { PRESET_SAMPLES } from '../data/presets';

interface SampleBarProps {
  activePresetId: string | null;
  isPitchMode?: boolean;
  onSelectPreset: (presetId: string) => void;
  onClearToCustom: () => void;
}

function splitTitle(shortTitle: string): { num: string; name: string } {
  const idx = shortTitle.indexOf('｜');
  if (idx < 0) return { num: '', name: shortTitle };
  return { num: shortTitle.slice(0, idx).trim(), name: shortTitle.slice(idx + 1).trim() };
}

export function SampleBar({
  activePresetId,
  isPitchMode = false,
  onSelectPreset,
  onClearToCustom,
}: SampleBarProps) {
  const activePreset = PRESET_SAMPLES.find((p) => p.id === activePresetId);

  return (
    <section className="page-wrap sample-wrap" aria-labelledby="sample-title">
      <div className="sample-panel">
        <div className="sample-row">
          <h2 id="sample-title" className="sample-title">
            <Files size={14} aria-hidden="true" />
            {isPitchMode ? '演示案例' : '试一个现成例子'}
          </h2>
          <div className="seg" role="group" aria-label="现成例子">
            {PRESET_SAMPLES.map((preset) => {
              const active = preset.id === activePresetId;
              const { num, name } = splitTitle(preset.shortTitle);
              return (
                <button
                  type="button"
                  key={preset.id}
                  className="seg-item sample-choice"
                  aria-pressed={active}
                  onClick={() => onSelectPreset(preset.id)}
                >
                  <span className="seg-dot" aria-hidden="true" />
                  {active ? (
                    <Check size={13} aria-hidden="true" className="shrink-0 text-brand" />
                  ) : (
                    <FileText size={13} aria-hidden="true" className="shrink-0 text-faint" />
                  )}
                  {num && <span className="seg-num shrink-0 whitespace-nowrap">{num}</span>}
                  <span className="seg-name">{name}</span>
                  <small className="shrink-0 whitespace-nowrap">{preset.badge}</small>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            className="sample-custom lift"
            aria-pressed={activePresetId === null}
            onClick={onClearToCustom}
          >
            <PenLine size={13.5} aria-hidden="true" />
            自己写/粘贴新邮件
          </button>
        </div>

        {!isPitchMode && (
          <p className="sample-description" aria-live="polite">
            <strong>{activePreset ? '当前情景' : '自由输入模式'}</strong>
            <span className="min-w-0">
              {activePreset?.description ?? '把客户发来的英文问价邮件粘到左侧舞台，右侧立即拆出中文核对单和英文回信。'}
            </span>
          </p>
        )}
      </div>
    </section>
  );
}
