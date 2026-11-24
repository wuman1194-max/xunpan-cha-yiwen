import { useEffect, useRef } from 'react';
import {
  BookOpen,
  ChevronDown,
  FlaskConical,
  FolderOpen,
  MonitorPlay,
  Play,
  ScanText,
  Settings2,
  SlidersHorizontal,
} from 'lucide-react';
import type { AnalysisAudit, EngineConfig } from '../types/rfq';

interface HeaderProps {
  engineConfig: EngineConfig;
  audit: AnalysisAudit;
  factoryOrderCount: number;
  isPitchMode: boolean;
  isTourActive?: boolean;
  onStartTour?: () => void;
  onTogglePitchMode: () => void;
  onOpenFactoryOrders: () => void;
  onOpenBenchmark: () => void;
  onOpenRules: () => void;
  onOpenSettings: () => void;
}

export function Header({
  engineConfig,
  audit,
  factoryOrderCount,
  isPitchMode,
  isTourActive = false,
  onStartTour,
  onTogglePitchMode,
  onOpenFactoryOrders,
  onOpenBenchmark,
  onOpenRules,
  onOpenSettings,
}: HeaderProps) {
  const advancedRef = useRef<HTMLDetailsElement>(null);
  const modePill =
    audit.engineUsed === 'llm'
      ? '外部大模型 · 已启用原话校验'
      : engineConfig.mode === 'local'
        ? '免登录 · 打开就能用'
        : '免登录 · 本地兜底模式';

  useEffect(() => {
    function closeOutside(event: PointerEvent) {
      const menu = advancedRef.current;
      if (menu?.open && event.target instanceof Node && !menu.contains(event.target)) {
        menu.open = false;
      }
    }
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);

  function closeAdvanced() {
    const menu = advancedRef.current;
    if (!menu) return;
    menu.open = false;
    menu.querySelector('summary')?.focus();
  }

  return (
    <header className="masthead">
      <div className="page-wrap masthead-inner">
        <div className="identity">
          <span className="brand-mark" aria-hidden="true">
            <ScanText size={18} strokeWidth={1.9} />
          </span>
          <div className="identity-text">
            <h1>询盘差一问</h1>
            <span className="identity-sep" aria-hidden="true">/</span>
            <p className="hidden sm:block">钣金件报价前英文澄清助手</p>
            <p className="sm:hidden">钣金英文询盘助手</p>
          </div>
        </div>

        <div className="header-actions">
          {!isPitchMode && (
            <span className="mode-indicator hidden shrink-0 whitespace-nowrap lg:inline-flex">
              <i className="live-dot" aria-hidden="true" />
              {modePill}
            </span>
          )}

          {onStartTour && (
            <button
              type="button"
              className="header-action lift hidden md:inline-flex"
              aria-pressed={isTourActive}
              onClick={onStartTour}
              title="30 秒四步互动演示：从模糊来信到旧单核对再到全绿闭环"
            >
              <Play size={13} aria-hidden="true" className="text-brand" />
              <span>{isTourActive ? '导览中' : '30秒导览'}</span>
            </button>
          )}

          <button
            type="button"
            className="pitch-toggle lift"
            aria-pressed={isPitchMode}
            onClick={onTogglePitchMode}
            title="切换纯净大字路演模式（快捷键 P）"
          >
            <MonitorPlay size={14} aria-hidden="true" />
            <span>{isPitchMode ? '退出路演态' : '路演模式'}</span>
          </button>

          <button type="button" className="header-action btn-orders lift" onClick={onOpenFactoryOrders}>
            <FolderOpen size={14} aria-hidden="true" />
            <span>工厂旧单库</span>
            <span
              className={`order-count shrink-0 whitespace-nowrap tabular ${
                factoryOrderCount > 0 ? 'has-items' : ''
              }`}
            >
              {factoryOrderCount}
            </span>
          </button>

          <details
            ref={advancedRef}
            className="advanced"
            onKeyDown={(event) => {
              if (event.key === 'Escape' && advancedRef.current?.open) {
                event.preventDefault();
                closeAdvanced();
              }
            }}
          >
            <summary className="header-action">
              <Settings2 size={14} aria-hidden="true" className="hide-sm" />
              <span>进阶工具</span>
              <ChevronDown size={13} aria-hidden="true" className="chev" />
            </summary>
            <div className="advanced-options">
              {[
                { icon: FlaskConical, title: '10例实测', desc: '10 封真实询盘实时跑分与边界报告', open: onOpenBenchmark },
                { icon: BookOpen, title: '判断规则表', desc: '钣金 8 项核对标准与防幻觉底线', open: onOpenRules },
                { icon: SlidersHorizontal, title: '模型设置', desc: '本地零配置引擎 / 外部大模型切换', open: onOpenSettings },
              ].map(({ icon: Icon, title, desc, open }) => (
                <button
                  type="button"
                  key={title}
                  onClick={() => {
                    closeAdvanced();
                    open();
                  }}
                >
                  <span className="menu-icon" aria-hidden="true">
                    <Icon size={15} />
                  </span>
                  <span className="min-w-0">
                    <span className="menu-title">{title}</span>
                    <span className="menu-desc">{desc}</span>
                  </span>
                </button>
              ))}
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
