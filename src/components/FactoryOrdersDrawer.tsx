import { useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Lock,
  Plus,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react';
import { DEMO_FACTORY_ORDERS } from '../data/demoFactoryOrders';
import { downloadFactoryOrderCsvTemplate, parseFactoryOrderFile } from '../engine/historyOrderStore';
import type { FactoryHistoryOrder } from '../types/rfq';

interface FactoryOrdersDrawerProps {
  open: boolean;
  orders: FactoryHistoryOrder[];
  onClose: () => void;
  onReplaceOrders: (orders: FactoryHistoryOrder[]) => void;
  onAppendOrders: (orders: FactoryHistoryOrder[]) => void;
  onDeleteOrder: (orderId: string) => void;
}

export function FactoryOrdersDrawer({
  open,
  orders,
  onClose,
  onReplaceOrders,
  onAppendOrders,
  onDeleteOrder,
}: FactoryOrdersDrawerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [statusMessage, setStatusMessage] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const [newOrderNo, setNewOrderNo] = useState('');
  const [newCustomer, setNewCustomer] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newPart, setNewPart] = useState('');
  const [newMaterial, setNewMaterial] = useState('');
  const [newThickness, setNewThickness] = useState('');
  const [newFinish, setNewFinish] = useState('');
  const [newDrawing, setNewDrawing] = useState('');

  if (!open) return null;

  const processFile = async (file: File) => {
    setStatusMessage(null);
    try {
      const { orders: parsed, warnings } = await parseFactoryOrderFile(file);
      if (parsed.length === 0) {
        setStatusMessage({
          kind: 'err',
          text: warnings.join('；') || '表格里没有读取到有效旧单记录，请检查表头与内容。',
        });
        return;
      }
      onAppendOrders(parsed);
      setStatusMessage({
        kind: 'ok',
        text: `已成功从「${file.name}」本地导入 ${parsed.length} 条历史订单${warnings.length ? `（注：${warnings.join('；')}）` : ''}。`,
      });
    } catch (err) {
      setStatusMessage({
        kind: 'err',
        text: err instanceof Error ? err.message : '读取表格失败，请确认文件为标准的 .xlsx 或 .csv 格式。',
      });
    }
  };

  const handleLoadDemoOrders = () => {
    const existingNos = new Set(orders.map((o) => o.orderNo));
    const freshDemos = DEMO_FACTORY_ORDERS.filter((d) => !existingNos.has(d.orderNo));
    if (freshDemos.length === 0) {
      setStatusMessage({ kind: 'ok', text: '3 条演示旧单已经在库里了，无需重复载入。' });
      return;
    }
    onAppendOrders(freshDemos);
    setStatusMessage({
      kind: 'ok',
      text: `已载入 ${freshDemos.length} 条工厂演示旧单（含 PO-2025-0812 等），关闭本弹窗即可在右舞台“工厂旧单智能核对”里一键带入。`,
    });
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPart.trim() && !newMaterial.trim() && !newThickness.trim()) return;
    const item: FactoryHistoryOrder = {
      id: `manual-${Date.now()}`,
      orderNo: newOrderNo.trim() || `OLD-${orders.length + 1}`,
      customerName: newCustomer.trim() || undefined,
      orderDate: newDate.trim() || undefined,
      partName: newPart.trim() || '定制钣金件',
      materialSpec: newMaterial.trim(),
      thickness: newThickness.trim(),
      surfaceFinish: newFinish.trim(),
      drawingRef: newDrawing.trim() || undefined,
    };
    onAppendOrders([item]);
    setNewOrderNo('');
    setNewCustomer('');
    setNewDate('');
    setNewPart('');
    setNewMaterial('');
    setNewThickness('');
    setNewFinish('');
    setNewDrawing('');
    setShowAddForm(false);
    setStatusMessage({ kind: 'ok', text: `已添加旧单记录「${item.orderNo}」。` });
  };

  const secondaryBtn = 'ui-button lift min-h-10 rounded-xl px-3 text-xs pointer-coarse:min-h-11';

  return (
    <div
      className="overlay flex justify-end"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby="factory-orders-title" className="drawer-panel reveal max-w-3xl">
        {/* Header */}
        <div className="drawer-head">
          <div className="flex min-w-0 items-start gap-3">
            <span className="drawer-icon" aria-hidden="true"><FileSpreadsheet className="size-5" /></span>
            <div className="min-w-0">
              <span className="spec-label">HISTORY ARCHIVE · EXCEL / CSV</span>
              <h3 id="factory-orders-title" className="drawer-title mt-0.5">工厂旧单库（支持 Excel / CSV 导入）</h3>
              <p className="drawer-sub">
                导入你们厂以前做过的老订单表格，遇到老外写“和上次一样”时就能自动翻出来核对。
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="关闭旧单库" className="icon-close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Privacy Banner */}
        <div className="flex items-start gap-2 border-b border-clear-line/70 bg-clear-bg px-4 py-2.5 text-xs leading-relaxed text-clear-ink sm:px-6">
          <Lock className="mt-0.5 size-4 shrink-0" />
          <span>
            <strong>纯本地浏览器读取：</strong>你的表格只在你自己电脑的浏览器里解析和暂存，<strong>绝不上传到任何服务器</strong>，放心导入。
          </span>
        </div>

        {/* Action Toolbar + Dropzone */}
        <div className="border-b border-line bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleLoadDemoOrders}
              className="lift inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#065f46] bg-[linear-gradient(180deg,#0d9c6f,#066a4e)] px-3 text-xs font-semibold text-white shadow-[0_6px_14px_-8px_rgb(6_106_78/70%)] pointer-coarse:min-h-11"
            >
              <Zap className="h-3.5 w-3.5" />
              一键载入 3 条演示旧单（新手体验）
            </button>

            <button type="button" onClick={downloadFactoryOrderCsvTemplate} className={secondaryBtn}>
              <Download className="h-3.5 w-3.5" />
              下载标准表格模板 (.csv)
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="ui-button-primary lift min-h-10 rounded-xl px-3 text-xs pointer-coarse:min-h-11"
            >
              <Upload className="h-3.5 w-3.5" />
              选择 Excel / CSV 文件导入
            </button>

            <button
              type="button"
              onClick={() => setShowAddForm((prev) => !prev)}
              aria-expanded={showAddForm}
              className={secondaryBtn}
            >
              <Plus className="h-3.5 w-3.5" />
              手填一条旧单
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv,.tsv,.txt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void processFile(f);
                e.target.value = '';
              }}
              className="hidden"
            />
          </div>

          {/* Drag & drop zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) void processFile(f);
            }}
            className={`mt-3 flex flex-col items-center gap-1.5 rounded-xl border border-dashed px-4 py-4 text-center text-[12.5px] leading-relaxed transition-colors ${
              isDragging
                ? 'border-brand bg-brand-soft text-brand-deep'
                : 'border-line-strong bg-mica text-muted'
            }`}
          >
            <span aria-hidden="true" className="grid size-8 place-items-center rounded-lg border border-line bg-white text-ink shadow-[0_1px_2px_rgb(17_20_28/4%)]">
              <Upload className="size-4" />
            </span>
            <span>
              也可以直接把电脑里的 <span className="font-mono-code font-semibold text-ink">.xlsx</span> 或{' '}
              <span className="font-mono-code font-semibold text-ink">.csv</span> 旧单表拖到这里（表头含“单号、零件、材料、板厚、表面、图纸”即可自动识别）
            </span>
          </div>

          {statusMessage && (
            <div
              role="status"
              className={`reveal mt-3 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs leading-relaxed [overflow-wrap:anywhere] ${
                statusMessage.kind === 'ok'
                  ? 'border-clear-line bg-clear-bg text-clear-ink'
                  : 'border-ask-line bg-ask-bg text-ask-ink'
              }`}
            >
              {statusMessage.kind === 'ok' ? <CheckCircle2 className="size-4 shrink-0" /> : <AlertCircle className="size-4 shrink-0" />}
              <span>{statusMessage.text}</span>
            </div>
          )}

          {/* Optional inline manual add row */}
          {showAddForm && (
            <form
              onSubmit={handleManualSubmit}
              className="reveal mt-3 grid grid-cols-1 gap-2 rounded-xl border border-line bg-mica p-3 text-sm sm:grid-cols-2"
            >
              <input
                type="text"
                aria-label="单号"
                value={newOrderNo}
                onChange={(e) => setNewOrderNo(e.target.value)}
                placeholder="单号（如 PO-2025-0901）"
                className="field-input"
              />
              <input
                type="text"
                aria-label="零件名称"
                value={newPart}
                onChange={(e) => setNewPart(e.target.value)}
                placeholder="零件名称（如 支架 brackets）*"
                className="field-input"
              />
              <input
                type="text"
                aria-label="材料牌号"
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                placeholder="材料牌号（如 304 stainless）"
                className="field-input"
              />
              <input
                type="text"
                aria-label="板厚"
                value={newThickness}
                onChange={(e) => setNewThickness(e.target.value)}
                placeholder="板厚（如 1.5 mm）"
                className="field-input"
              />
              <input
                type="text"
                aria-label="表面"
                value={newFinish}
                onChange={(e) => setNewFinish(e.target.value)}
                placeholder="表面（如 brushed 拉丝）"
                className="field-input"
              />
              <input
                type="text"
                aria-label="图号"
                value={newDrawing}
                onChange={(e) => setNewDrawing(e.target.value)}
                placeholder="图号（可选）"
                className="field-input"
              />
              <input
                type="text"
                aria-label="客户名"
                value={newCustomer}
                onChange={(e) => setNewCustomer(e.target.value)}
                placeholder="客户名（可选）"
                className="field-input"
              />
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  aria-label="日期"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  placeholder="日期（可选）"
                  className="field-input"
                />
                <button type="submit" className="ui-button-primary lift min-h-10 shrink-0 rounded-xl px-4 text-xs pointer-coarse:min-h-11">
                  保存
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Orders List */}
        <div className="min-w-0 p-4 sm:p-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-[14px] font-bold text-ink">
              当前库内旧单记录
              <span className="chip tone-brand"><i className="chip-dot" aria-hidden="true" />共 {orders.length} 条</span>
            </span>
            {orders.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  onReplaceOrders([]);
                  setStatusMessage({ kind: 'ok', text: '已清空旧单库。' });
                }}
                className="inline-flex min-h-10 items-center gap-1 rounded-xl px-2.5 text-xs font-semibold text-ask-ink hover:bg-ask-bg pointer-coarse:min-h-11"
              >
                <Trash2 className="h-3.5 w-3.5" />
                清空旧单库
              </button>
            )}
          </div>

          {orders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line-strong bg-white px-5 py-8 text-center text-[13px] leading-relaxed text-muted">
              <span aria-hidden="true" className="mx-auto mb-2 grid size-10 place-items-center rounded-xl bg-mica-2 text-faint">
                <FileSpreadsheet className="size-5" />
              </span>
              <p className="font-semibold text-ink">还没有导入任何工厂旧单</p>
              <p className="mt-1">
                你可以点击上方绿色的 <strong className="text-clear-ink">「一键载入 3 条演示旧单」</strong> 体验自动匹配效果，或上传自己的 Excel / CSV 表格。
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {orders.map((order) => (
                <div key={order.id} className="card p-4 text-[13px] [overflow-wrap:anywhere]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-brand-soft px-2 py-0.5 font-mono-code text-xs font-bold text-brand-deep ring-1 ring-brand-line">
                        {order.orderNo}
                      </span>
                      <span className="font-bold text-ink">{order.partName}</span>
                      {order.customerName && <span className="text-muted">· {order.customerName}</span>}
                      {order.orderDate && <span className="font-mono-code text-[11.5px] text-muted">({order.orderDate})</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => onDeleteOrder(order.id)}
                      aria-label={`删除 ${order.orderNo}`}
                      className="inline-flex size-10 items-center justify-center rounded-lg text-muted hover:bg-ask-bg hover:text-ask-ink pointer-coarse:size-11"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5 text-xs">
                    {order.materialSpec && (
                      <span className="rounded-md border border-line bg-mica px-2 py-0.5 text-ink-2">
                        材料：<strong className="text-ink">{order.materialSpec}</strong>
                      </span>
                    )}
                    {order.thickness && (
                      <span className="rounded-md border border-brand-line bg-brand-soft px-2 py-0.5 font-mono-code text-brand-deep">
                        板厚：<strong>{order.thickness}</strong>
                      </span>
                    )}
                    {order.surfaceFinish && (
                      <span className="rounded-md border border-line bg-mica px-2 py-0.5 text-ink-2">
                        表面：<strong className="text-ink">{order.surfaceFinish}</strong>
                      </span>
                    )}
                    {order.drawingRef && (
                      <span className="rounded-md border border-line bg-mica px-2 py-0.5 font-mono-code text-ink-2">
                        图号：{order.drawingRef}
                      </span>
                    )}
                  </div>

                  {order.notes && <p className="mt-1.5 text-xs text-muted">备注：{order.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
