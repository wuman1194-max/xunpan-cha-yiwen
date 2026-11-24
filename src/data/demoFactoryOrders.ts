import type { FactoryHistoryOrder } from '../types/rfq';

export const DEMO_FACTORY_ORDERS: FactoryHistoryOrder[] = [
  {
    id: 'demo-po-2025-0812',
    orderNo: 'PO-2025-0812',
    customerName: 'Nordic Mounting Co.',
    orderDate: '2025-10-18',
    partName: '不锈钢折弯支架 (brackets)',
    materialSpec: '304 stainless steel',
    thickness: '1.5 mm',
    surfaceFinish: '拉丝 (brushed)',
    drawingRef: 'BRK-304-RevB.step',
    notes: '曾按 500/2,000 两档报价，折弯表面需贴保护膜。',
  },
  {
    id: 'demo-po-2025-0640',
    orderNo: 'PO-2025-0640',
    customerName: 'Alpine Controls',
    orderDate: '2025-08-29',
    partName: '铝合金折弯外壳 (enclosure)',
    materialSpec: '5052-H32 aluminum',
    thickness: '2.0 mm',
    surfaceFinish: '哑光黑喷粉 (RAL 9005)',
    drawingRef: 'ENC-AL5052-V3.step',
    notes: '内 R 角 R2.0，喷粉前螺纹孔需遮蔽。',
  },
  {
    id: 'demo-po-2025-0519',
    orderNo: 'PO-2025-0519',
    customerName: 'Pacific Machinery',
    orderDate: '2025-07-11',
    partName: '碳钢安装板 (mounting plate)',
    materialSpec: 'SPCC cold-rolled steel',
    thickness: '2.0 mm',
    surfaceFinish: '镀锌 (zinc plated)',
    drawingRef: 'PLT-SPCC-102.dxf',
    notes: '总体尺寸公差 ±0.2 mm。',
  },
];

export const FACTORY_ORDER_CSV_TEMPLATE = `\uFEFF历史单号,客户名称,下单日期,零件名称,材料与牌号,板材厚度,表面处理,图纸号,备注
PO-2025-0812,Nordic Mounting Co.,2025-10-18,不锈钢折弯支架 (brackets),304 stainless steel,1.5 mm,拉丝 (brushed),BRK-304-RevB.step,"曾按 500/2,000 两档报价，折弯表面贴膜"
PO-2025-0640,Alpine Controls,2025-08-29,铝合金折弯外壳 (enclosure),5052-H32 aluminum,2.0 mm,哑光黑喷粉 (RAL 9005),ENC-AL5052-V3.step,螺纹孔喷粉前遮蔽
PO-2025-0519,Pacific Machinery,2025-07-11,碳钢安装板 (mounting plate),SPCC cold-rolled steel,2.0 mm,镀锌 (zinc plated),PLT-SPCC-102.dxf,整体公差 ±0.2 mm
`;
