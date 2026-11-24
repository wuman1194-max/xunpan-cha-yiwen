import { useEffect, useState } from 'react';
import { Cpu, Lock, X } from 'lucide-react';
import type { EngineConfig } from '../types/rfq';

interface EngineSettingsModalProps {
  open: boolean;
  config: EngineConfig;
  onSave: (next: EngineConfig) => void;
  onClose: () => void;
}

const OPTION_CLASS =
  'flex min-w-0 cursor-pointer items-start gap-3 rounded-2xl bg-white p-4 ring-1 ring-black/7 transition-[background-color,box-shadow] hover:ring-black/16 has-checked:bg-brand-soft/45 has-checked:ring-2 has-checked:ring-brand/55';

export function EngineSettingsModal({ open, config, onSave, onClose }: EngineSettingsModalProps) {
  const [draft, setDraft] = useState<EngineConfig>(config);
  const [proxyAvailable, setProxyAvailable] = useState<boolean | null>(null);

  useEffect(() => {
    setDraft(config);
  }, [config, open]);

  useEffect(() => {
    if (!open) return;
    fetch('/api/extract')
      .then((res) => (res.ok ? res.json() : { configured: false }))
      .then((data: { configured?: boolean }) => setProxyAvailable(Boolean(data.configured)))
      .catch(() => setProxyAvailable(false));
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="overlay flex items-center justify-center p-3 sm:p-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="engine-settings-title" className="reveal max-h-full w-full max-w-lg overflow-y-auto overscroll-contain rounded-2xl border border-line-strong bg-canvas p-4 shadow-[var(--shadow-pop)] sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
          <div className="flex items-center gap-3">
            <span className="drawer-icon" aria-hidden="true"><Cpu className="size-5" /></span>
            <div>
              <span className="spec-label">ENGINE · RUNTIME CONFIG</span>
              <h3 id="engine-settings-title" className="drawer-title mt-0.5">解析引擎与模型设置</h3>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭设置" className="icon-close">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-2.5 text-[13px] leading-relaxed">
          <label className={OPTION_CLASS}>
            <input
              type="radio"
              name="engineMode"
              checked={draft.mode === 'local'}
              onChange={() => setDraft({ ...draft, mode: 'local' })}
              className="mt-0.5 size-4 shrink-0 accent-[#2546ff]"
            />
            <div className="min-w-0">
              <div className="font-bold text-ink">内置本地解析引擎（默认推荐 · 免登录零配置）</div>
              <p className="mt-0.5 text-xs text-muted">
                毫秒级响应任意英文改写，无需网络或 API Key，完全在浏览器本地完成原句抽取与钣金规则校验。
              </p>
            </div>
          </label>

          <label className={OPTION_CLASS}>
            <input
              type="radio"
              name="engineMode"
              checked={draft.mode === 'llm_proxy'}
              onChange={() => setDraft({ ...draft, mode: 'llm_proxy' })}
              className="mt-0.5 size-4 shrink-0 accent-[#2546ff]"
            />
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold text-ink">服务端大模型代理 (/api/extract)</span>
                <span className={`chip ${proxyAvailable ? 'tone-clear' : 'tone-pending'}`}>
                  <i className="chip-dot" aria-hidden="true" />
                  {proxyAvailable === null ? '检测中...' : proxyAvailable ? '服务端已配置' : '服务端未配置 Key'}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-muted">
                公网部署时通过环境变量注入 LLM_API_KEY；仍强制经过原句锚定防幻觉校验层，不可用时自动回退本地引擎。
              </p>
            </div>
          </label>

          <label className={OPTION_CLASS}>
            <input
              type="radio"
              name="engineMode"
              checked={draft.mode === 'llm_byok'}
              onChange={() => setDraft({ ...draft, mode: 'llm_byok' })}
              className="mt-0.5 size-4 shrink-0 accent-[#2546ff]"
            />
            <div className="min-w-0 flex-1 [overflow-wrap:anywhere]">
              <div className="font-bold text-ink">自带 OpenAI 兼容接口（仅当前会话内存保存）</div>
              <p className="mt-0.5 text-xs text-muted">
                适合评委测试任意大模型抽取；所有输出仍须通过原句逐字比对，缺少原文引用的字段将被自动拦截。
              </p>
            </div>
          </label>

          {draft.mode === 'llm_byok' && (
            <div className="reveal grid gap-3 rounded-xl border border-brand-line bg-brand-soft/60 p-3">
              <div>
                <label htmlFor="engine-baseUrl" className="block text-[12px] font-semibold text-ink-2">Base URL</label>
                <input
                  type="text"
                  id="engine-baseUrl"
                  value={draft.baseUrl}
                  onChange={(e) => setDraft({ ...draft, baseUrl: e.target.value })}
                  placeholder="https://api.openai.com/v1"
                  className="field-input mt-1 font-mono-code text-sm"
                />
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label htmlFor="engine-model" className="block text-[12px] font-semibold text-ink-2">Model</label>
                  <input
                    type="text"
                    id="engine-model"
                    value={draft.model}
                    onChange={(e) => setDraft({ ...draft, model: e.target.value })}
                    placeholder="gpt-4o-mini"
                    className="field-input mt-1 font-mono-code text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="engine-apiKey" className="flex items-center gap-1 text-[12px] font-semibold text-ink-2">
                    <Lock className="h-3 w-3" /> API Key (sessionStorage)
                  </label>
                  <input
                    type="password"
                    id="engine-apiKey"
                    value={draft.apiKey}
                    onChange={(e) => setDraft({ ...draft, apiKey: e.target.value })}
                    placeholder="sk-..."
                    className="field-input mt-1 font-mono-code text-sm"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-line pt-3">
          <button type="button" onClick={onClose} className="ui-button min-h-10 rounded-xl px-4 pointer-coarse:min-h-11">
            取消
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(draft);
              onClose();
            }}
            className="ui-button-primary lift min-h-10 rounded-xl px-4 pointer-coarse:min-h-11"
          >
            保存设置
          </button>
        </div>
      </div>
    </div>
  );
}
