# 「询盘差一问」项目交接文档

- **项目名称**：询盘差一问（钣金件报价前英文询盘澄清助手）
- **项目目录**：`C:\Users\link\.gemini\antigravity\scratch\xunpan-cha-yiwen`
- **打包归档**：`C:\Users\link\.gemini\antigravity\scratch\xunpan-cha-yiwen.tar.gz`
- **交付节点参考**：2026-12-04 前完成真实业务验证、公网部署与产品说明计划书终稿

---

## 1. 产品定位与能力边界

### 1.1 解决的真实痛点
中小型钣金厂外贸业务员收到客户英文询盘时，往往面临“直接转发给工程会被退回、全问一遍又显得不专业且降低客户回复率”的两难问题。本工具站在**材料成型与钣金报价工艺**视角，在进入 CAD 审图和核价前完成 3 件事：
1. **分清 8 项核心字段状态**：哪些已经说清（`已核实`）、哪些引用了历史订单（`查旧单`）、哪些客户承诺随后补发（`客户待发`）、哪些必须向客户追问或消歧（`待向客户确认` / `需二选一/消歧` / `缺关键明细`）。
2. **严格防脑补与防重复追问**：绝不擅自把 `stainless steel` 补成 `304`，或把 `Same thickness as last time` 脑补成 `1.5 mm`；已核实、可查旧单、客户待发的项自动移出追问列表，单封回信最多收敛至 **3 个**最影响报价的追问。
3. **点击数值定位原文 + 生成可编辑英文回信**：右侧工程需求卡点击任意数值或引用胶囊，左侧英文原文同步高亮并滚动定位；底部回信严格仅引用已核实字段与勾选问题。

### 1.2 首版刻意不做的范围（Scope Guardrails）
- **不做 CAD 识图、自动算价与邮件代发**：保留在工厂现有报价与邮件工作流中。
- **聚焦单件钣金折弯件**：若邮件出现 `CNC machining`、`injection molding` / `die casting`、`welded assembly` / `BOM`，或单封邮件同时混写多款不同零件（如 `brackets` 与 `covers`），界面仅给出非阻塞边界提示，不强行拆解多件总成。

---

## 2. 交付清单与快速启动

### 2.1 运行环境要求
- Node.js（已实测于 `v24.22.1`）与 npm（`11.19.1`）
- 纯前端零配置即可完整演示，**无需登录、无需数据库、默认无需外部 API Key**

### 2.2 常用命令
```bash
# 1. 安装依赖（若从 tar.gz 解压）
npm install

# 2. 启动本地开发服务器
npm run dev

# 3. 运行自动化单元测试（22 项）
npm test

# 4. TypeScript 类型检查 + 生产构建（输出至 dist/）
npm run build

# 5. 本地预览生产构建包
npm run preview
```

### 2.3 目录结构与核心文件索引

| 模块 | 文件路径 | 核心职责与关键导出 |
| :--- | :--- | :--- |
| 工程入口与配置 | `package.json`, `index.html`, `tsconfig.json`, `vite.config.ts` | Vite 7 + React 19 + Tailwind CSS v4 构建配置；`vite.config.ts` 内置开发态 `/api/extract` 代理中间件 |
| 无服务器代理 | `api/extract.ts`, `.env.example` | 供 Vercel/Node 部署的可选 OpenAI 兼容转发接口；未配置 `LLM_API_KEY` 时返回 `501`，前端自动使用内置本地引擎 |
| 数据结构定义 | `src/types/rfq.ts` | 定义 `EmailRound`、`EvidenceSpan`、`FieldKey`（8 字段）、`FieldStatus`、`ClarificationQuestion`、`AnalysisResult`、`BenchmarkReport`、`EngineConfig` |
| 原创样例与评测集 | `src/data/presets.ts`, `src/data/benchmarkCases.ts` | `PRESET_SAMPLES`（3 套原创两轮样例）；`BENCHMARK_CASES`（10 封多样化实时评测用例，含 9 个单件目标案例 + 1 个已知多件边界案例） |
| 钣金判断规则库 | `src/data/rulesCatalog.ts` | `SHEET_METAL_RULES_CATALOG`：8 字段的报价影响、工艺依据、触发/跳过条件与防幻觉底线 |
| 本地抽取与翻译 | `src/engine/localExtractor.ts`, `src/engine/localTranslator.ts` | `extractRoundLocally`；`translateRfqRoundToChinese` / `translateReplyToChinese`（来信与回信实时中文翻译） |
| 工厂旧单库与匹配 | `src/data/demoFactoryOrders.ts`, `src/engine/historyOrderStore.ts`, `src/components/FactoryOrdersDrawer.tsx` | 支持纯浏览器本地解析 `.xlsx`/`.csv`（含 UTF-8/GBK 兼容与模板下载）、演示旧单及按单号/零件/材质/工艺智能打分匹配 |
| 外部模型与校验 | `src/engine/llmExtractor.ts`, `src/engine/groundingValidator.ts` | `extractRoundsWithLlm` 调用模型；`validateAndGroundLlmOutput` 逐字核对引文，无原文依据的值直接拦截并计数 |
| 多轮合并与规则 | `src/engine/merger.ts`, `src/engine/sheetMetalRules.ts` | `mergeExtractedRounds` 追踪轮次覆盖与跨轮加档；`evaluateSheetMetalRules` 包含铜/黄铜分支、SGCC 预镀锌防误问、Gauge 材料换算提示及 `≤ 3` 问截断 |
| 回信、评测与编排 | `src/engine/replyGenerator.ts`, `src/engine/evaluator.ts`, `src/engine/pipeline.ts` | `generateEnglishReply`、`runBenchmarkSuite`、`formatBenchmarkMarkdown`、`analyzeRoundsLocally`、`composeReplyFromAnalysis`、`formatChineseEngineeringBrief` |
| 主工作台与组件 | `src/App.tsx`, `src/components/*.tsx` | `HighlightableTextarea`、`EmailThreadPanel`（含评委一键改字试测栏）、`RequirementCardPanel`、`ClarificationPanel`、`ReplyDraftPanel`、`BenchmarkDrawer`、`RulesDrawer`、`EngineSettingsModal` |
| 自动化测试 | `src/__tests__/pipeline.test.ts` | 22 个 Vitest 端到端断言（含防幻觉、防中文混入英文回信、实时翻译与旧单解析） |

---

## 3. 技术架构与防幻觉机制

### 3.1 处理流水线
```text
英文邮件多轮文本 (EmailRound[])
   │
   ├─[默认] localExtractor.ts (按轮次传递 priorContext，毫秒级本地解析，零网络依赖)
   └─[可选] llmExtractor.ts (/api/extract 或 BYOK) ──▶ groundingValidator.ts (逐字比对，无原句依据直接剔除)
   │
   ▼
merger.ts (第 1 轮 → 第 N 轮合并，支持跨轮加档、通用“same as last time”分流与“第 X 轮更新”标识)
   │
   ▼
sheetMetalRules.ts (结合 askCustomerForHistoryFields 开关分流：内部查旧单 / 客户待发 / P0>P1>P2 截断 ≤3 问)
   │
   ▼
replyGenerator.ts (仅基于已核实字段与勾选追问生成简洁/礼貌两档可编辑英文回信)
```

### 3.2 内置抽取引擎的关键工程细节
1. **数字冲突隔离（`localExtractor.ts`）**：在扫描采购数量前，先识别并掩码（mask）订单编号（`PO#`）、长宽尺寸（`100 x 200 mm`）、数字公差（`±0.2 mm`）、板材厚度（`1.5 mm`、`1.5t`、`16 gauge`、`0.060 in.`）、色号（`RAL 9005`）、金属牌号（`304`、`316L`、`1.4301`、`5052-H32`、`6061-T6`、`SPCC`、`SGCC`、`C260`）及交期时长（`2 weeks`），确保这类数字绝不会被误当成采购数量。
2. **分档、跨轮加档 vs 改单区分**：支持 2 档、3 档及以上分档询价（`100, 500, and 2,000 pcs`）；支持第 2 轮增量加档（如 `C260, also price 1,500.` 自动与第 1 轮 `300` 合并为两档）；结合 `originally planned ... actually change it to` 识别疑似改单。
3. **材料成型专业规则深度**：
   - 预镀锌基板（`SGCC` / `SECC` / `DX51D`）不再误触发“碳钢无防锈必问是否镀锌”；
   - 铜材/黄铜（`C110`/`T2` vs `C260`/`H62`）有独立折弯与牌号状态规则；
   - `Gauge` 板厚保留原文值（如 `16 Gauge`），仅在工程备注中提示对应材质的毫米参考值（不锈钢 ≈ `1.59 mm` / 碳钢 ≈ `1.52 mm` / 铝 ≈ `1.29 mm`）。
4. **“查不到旧单”人工兜底开关**：对历史引用默认放入“业务员先内部核对旧单”琥珀色卡片；若实际翻不到旧单，勾选“查不到旧单？改为向客户追问”立即加入追问列表与回信。

---

## 4. 评审演示脚本（建议 2 分钟完整流程）

1. **开场第 1 轮（默认“样例 1｜拉丝不锈钢支架”）**
   - 原文：`Please quote 500 brushed stainless steel brackets. Same thickness as last time. Could you also price 2,000?`
   - 展示要点：`500 / 2,000` 识别为两档询价；板厚进入顶部“业务员先内部核对旧单”；底部仅建议 **2 个追问**（牌号、图纸），回信绝不脑补 `304` 或 `1.5 mm`。
2. **交互验证 1：点击数值定位原文 & 评委一键改字试测**
   - 点击右侧 `两档分档询价：500 / 2,000 件` 或 `R1: "Same thickness as last time"` 胶囊定位左侧原句；
   - 点击第 1 轮下方的 **“+ 补牌号 316L”**、**“- 删旧单板厚”** 或 **“⇄ 改成改单 2,000”**（或直接修改英文正文），实时观察右侧需求卡与追问改变，再点 **“↺ 恢复原文”**。
3. **第 2 轮动态更新**
   - 点击 **“⚡ 一键填入第 2 轮客户补充回复”**（写入 `304 stainless, 1.5 mm for both quantities. Drawing to follow.`）：牌号/板厚更新、两档数量与拉丝保留、图纸标为“客户待发”、追问清零。
4. **10 封实时评测抽屉（计划书量化支撑）**
   - 点击顶部 **“实测评测 (10例)”**，展示实时运行的 **9/9 单件目标案例通过（0 漏问、0 重复追问、0 擅自补值）+ 1 个诚实记录的多件 BOM 边界案例**，并可一键将任一案例载入工作台验证或复制 Markdown 实测表。

---

## 5. 当前验证状态

| 检查项 | 覆盖范围与命令 | 结果 |
| :--- | :--- | :--- |
| 单元测试 | `npm test`（`src/__tests__/pipeline.test.ts`） | **22/22 通过**（覆盖样例 1–3、评委改字、第 2 轮极简牌号、3 档数量+Gauge、通用历史引用、跨轮加档+黄铜+SGCC、防幻觉校验、纯英文回信防中文混入、实时翻译、工厂旧单解析/匹配及 10 例评测套件） |
| 类型与构建 | `npm run build`（`tsc --noEmit && vite build`） | **通过（0 错误）**，产出 `dist/` 静态包（无 Google Fonts 阻塞请求，国内网络秒开） |
| 浏览器实测 | 桌面端 `1440×900` 与移动端 `390×844` Chrome 无头实机核验 | **通过**，控制台 0 报错、0 横向溢出、双层原话高亮 0px 错位、首屏完整展示全链路与一键复制按钮 |

---

## 6. 已知边界与待迭代项（已接入 Case 10 并可直接写进计划书）

1. **单封邮件混写多款不同零件（Multi-item BOM，对应评测 Case 10）**：当前能检测多零件并提示“建议按零件拆分核对”，但单件模型会合并两套材料/板厚；后续 V2 可演进为按行/分句拆出多张子需求卡。
2. **极简电报体缩写**：如 `16ga CRS w/ PEMs` 类超短非正式写法仍可根据实测语料持续扩充词典。
3. **长句跨段隐含推翻**：若前文数量与后文推翻词相隔跨越多段，本地规则可能判为待消歧而非直接覆盖。

---

## 7. 交接后至 12 月 4 日前的执行清单

- [ ] **第 1–2 天（低成本人工校准）**：拿 `src/data/presets.ts` 里的样例找接触过机加工/钣金报价的老师、校友或业务员标注“必须问 / 可以查 / 已说清”，对照核对 `src/data/rulesCatalog.ts`。
- [ ] **第 3–9 天（实测表扩充与失败案例整理）**：运行内置「实测评测 (10例)」或补充真实客户邮件，核对漏问、重复追问与擅自补值统计，一键复制 Markdown 实测表与 Case 10 边界分析写进产品说明计划书。
- [ ] **第 10–12 天（公网部署与手机流量复测）**：将项目部署至 Vercel / Netlify，用手机蜂窝网络完整测通演示流程、改字试测与 10 例评测抽屉。
