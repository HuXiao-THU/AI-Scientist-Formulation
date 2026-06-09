# IST TUI — Bug Report & Product Requirements

> 基于白盒代码审查 + 运行时测试，2026-06-10

---

## 🔴 严重 Bug（Critical）

### 1. 字符宽度计算不一致，导致 TUI 行截断错误

**影响范围**：整个 TUI 渲染 — 树视图、日志面板、结果查看器、描述编辑器。

**根因**：代码中存在两套宽度计算逻辑，彼此不一致：
- `visualWidth()` / `isWideChar()` / `truncateToWidth()` 使用精确的 Unicode 范围（CJK、特殊符号等），正确地将 Box-Drawing 字符（`├─│└┘┌┐┤`）和符号（`●○◉✓✗`）计为宽度 1。
- `clipToWidth()` 和 `wrapLines()` 使用粗糙规则 `(cp > 127 && cp < 0x20000) || cp >= 0x20000`，将所有非 ASCII 字符一律计为宽度 2。

**实际影响**：
- **树视图**：每行因 Box-Drawing 前缀字符被过度截断 1-4 个字符（嵌套越深丢失越多）—— [tree-view.ts](ist-tui/src/tui/tree-view.ts) → [cli.ts:230](ist-tui/src/cli.ts#L230) 的 `clipToWidth()` 调用处。
- **日志面板（Experiment Log）**：边框水平线 `────` 被 `clipToWidth` 计为双倍宽度，导致整个 log box 的右半部分被裁切掉 ~40 个字符，面板完全不可用 —— [log-panel.ts](ist-tui/src/tui/log-panel.ts) → [cli.ts:235](ist-tui/src/cli.ts#L235)。
- **描述编辑器**：`wrapLines()` 在遇到任意非 ASCII 字符时过早换行 —— [cli.ts:93](ist-tui/src/cli.ts#L93)。

**修复方向**：
1. 统一宽度计算到 `isWideChar()` 的精确逻辑，修改 `clipToWidth()` 和 `wrapLines()` 中的宽度判断。
2. 提取公共函数 `charWidth(cp: number): number` 到 [truncate.ts](ist-tui/src/utils/truncate.ts)，所有位置引用同一个实现。
3. 添加单元测试覆盖：ASCII、CJK、Emoji、Box-Drawing、Latin-1 补充字符。

**涉及文件**：
- [truncate.ts:63-79](ist-tui/src/utils/truncate.ts#L63-L79) — `clipToWidth()`
- [truncate.ts:21-27](ist-tui/src/utils/truncate.ts#L21-L27) — `visualWidth()` / `isWideChar()`
- [cli.ts:76-109](ist-tui/src/cli.ts#L76-L109) — `wrapLines()`

---

### 2. 树视图无滚动支持 —— 超出屏幕的节点不可见

**影响**：当节点数量超过 `maxTree` 行时，只有前 N 行可见。通过 ↑↓ 键导航到可见范围之外的节点时，选中状态移到屏幕外，用户完全看不见。

**根因**：`renderTree()` 返回所有节点的完整行列表，但 [cli.ts:229](ist-tui/src/cli.ts#L229) 只取 `treeLines.slice(0, maxTree)`，没有跟踪滚动偏移量（scroll offset）。

**涉及文件**：
- [cli.ts:39](ist-tui/src/cli.ts#L39) — 缺少 `treeScroll` 状态变量
- [cli.ts:229](ist-tui/src/cli.ts#L229) — 硬截断
- [app.ts:240-262](ist-tui/src/app.ts#L240-L262) — `navigateUp/Down` 没有触发视图跟随

**修复方向**：
1. 添加 `treeScroll` 状态（参考已有的 `resultScroll`）。
2. 导航时自动滚动，使选中节点保持在可视区域内。
3. 边界处理：`maxTree` 随 terminal resize 变化时重新计算。

---

### 3. Agent 工具存在路径穿越（Path Traversal）安全漏洞

**影响**：AI Agent 在执行实验时可以通过 `read` / `write` 工具访问 workspace 之外的任意文件。

**根因**：[tools.ts:80-81](ist-tui/src/tools/tools.ts#L80-L81) 和 [tools.ts:121-122](ist-tui/src/tools/tools.ts#L121-L122) 直接拼接路径，未解析和校验收敛后的路径是否在 workspace 内。
```ts
const fullPath = params.file_path.startsWith("/")
  ? params.file_path : `${workspacePath}/${params.file_path}`;
```
如果 `file_path = "../../../etc/passwd"`，则可以逃逸 workspace。

**修复方向**：
1. 使用 `path.resolve(workspacePath, params.file_path)` 解析路径。
2. 检查 `resolvedPath.startsWith(path.resolve(workspacePath))`。
3. 拒绝绝对路径或规范化后不在 workspace 内的路径。

**涉及文件**：
- [tools.ts:69-101](ist-tui/src/tools/tools.ts#L69-L101) — `createReadTool`
- [tools.ts:110-138](ist-tui/src/tools/tools.ts#L110-L138) — `createWriteTool`

---

## 🟡 高优先级（High）

### 4. 描述编辑器光标定位存在 off-by-one 错误

**位置**：[cli.ts:112-124](ist-tui/src/cli.ts#L112-L124) `cursorDisplayPos()`

**问题**：当光标位于换行后第一行的起始位置（恰好是上一行的 endPos），条件 `pos >= w.startPos && pos <= endPos` 会匹配到上一行而非下一行，导致光标渲染在错误的位置。应改为 `pos >= w.startPos && pos < endPos`（对非最后一行），或统一使用 `pos < endPos` 判断。

**同时**：第 206 行 `if (cur.dispLine >= wrapped.length)` 处理光标在最后一行之后的情况，但由于上述 off-by-one，光标可能在第 N 行的末尾被渲染为第 N+1 行的开头。两者叠加影响光标行为。

---

### 5. 结果查看器（Result Viewer）切换节点后 scroll 位置不重置

**位置**：[cli.ts:39](ist-tui/src/cli.ts#L39) `resultScroll` + [cli.ts:391-394](ist-tui/src/cli.ts#L391-L394) `'m'` 键处理

**问题**：查看节点 A 的结果后滚到底部，按 Esc 退出，选择节点 B 按 `m` 查看结果 — `resultScroll` 未重置，可能超出节点 B 的结果行数。虽有 [cli.ts:142](ist-tui/src/cli.ts#L142) 的 clamp 保护，但仍可能显示在中间而非顶部，用户体验差。

**修复**：进入结果查看模式时（`'m'` 键）将 `resultScroll = 0`。

---

### 6. 描述编辑器占满中部空间，编辑时树被挤压

**位置**：[cli.ts:184-208](ist-tui/src/cli.ts#L184-L208) 描述编辑渲染 + [cli.ts:217-218](ist-tui/src/cli.ts#L217-L218) 布局计算

**问题**：描述编辑器的所有换行行都渲染在中间区域，行数多时树只剩 `Math.max(5, ...)` 即 5 行。用户同时看不到树结构和编辑内容。

**修复方向**：
1. 限制描述编辑器最大显示行数（如 8-10 行），超出部分滚动。
2. 或让描述编辑器有自己的滚动偏移量。

---

## 🟠 中优先级（Medium）

### 7. Tab 键在两种编辑模式间切换不对称

**位置**：[cli.ts:257-259](ist-tui/src/cli.ts#L257-L259) vs [cli.ts:319](ist-tui/src/cli.ts#L319)

**问题**：
- Title 编辑时按 Tab → 切换到 Description 编辑 ✓
- Description 编辑时按 Tab → **保存并退出编辑** ✗（期望：切换回 Title 编辑）

这导致用户在两种编辑模式间只能单向切换。

---

### 8. `renderBox` 内容宽度计算使用原始字符串长度而非视觉宽度

**位置**：[log-panel.ts:72](ist-tui/src/log-panel.ts#L72)

```ts
const cl = c.replace(/\x1b\[[0-9;]*m/g, "").length;
```

**问题**：`c.length` 计算的是原始 JavaScript 字符串长度，不是终端视觉宽度。当内容包含 Emoji（如 🔧 `U+1F527`，某些编码下 `.length === 2`）时，计算的 padding 会少 1，导致边框未对齐。改进后应使用 `visualWidth(stripAnsi(c))`。

---

### 9. AI Summarize 功能为 stub，未实现

**位置**：[app.ts:213-216](ist-tui/src/app.ts#L213-L216)

**问题**：`aiSummarize()` 只设置一个 error 消息 "not yet implemented"。UI 中没有对应的快捷键绑定，README 中将其列为 "Next Steps" 之一。需完整实现或从 UI 提示中移除。

---

### 10. 日志面板使用 `process.stdout.rows` 而非统一的 `R` 变量

**位置**：[log-panel.ts:37](ist-tui/src/log-panel.ts#L37)

```ts
const maxLines = Math.max(5, process.stdout.rows - 20);
```

**问题**：cli.ts 在 resize 事件中更新局部变量 `R`，但 `renderLogPanel` 直接读 `process.stdout.rows`。在 resize 事件和下次渲染之间可能存在短暂不一致（影响较小，但不够干净）。且小终端（<25 行）时 `maxLines` 可能 < 5，被 clamp 到 5。

---

## 🟢 低优先级 / 产品完善（Low / Enhancement）

### 11. 缺少树节点折叠/展开功能

当树结构变深时，无法折叠某个 idea 下的子节点来管理视图空间。建议添加快捷键（如 `Space` 折叠/展开当前节点）。

---

### 12. 缺少 Undo/Redo 支持

删除节点、编辑标题/描述均无撤销功能。误操作后只能手动恢复。建议使用简单的 command pattern 实现撤销栈。

---

### 13. 实验日志条目可能过大

**位置**：[log-panel.ts:6-25](ist-tui/src/log-panel.ts#L6-L25) `ExperimentLog`

**问题**：Assistant 消息文本可能很长（完整 LLM 响应），但 `ExperimentLog.append()` 不加截断地存储。500 条上限下，内存可能膨胀。建议对 `type === "assistant"` 的条目截断到 500 字符。

---

### 14. 缺少树节点水平滚动（深度嵌套时）

**位置**：[tree-view.ts:156-158](ist-tui/src/tree-view/tree-view.ts#L156-L158)

**问题**：树前缀 `│  │  │  ...` 随深度线性增长（每层 3 字符），`maxTitleWidth = Math.max(10, width - reserved)` 在最坏情况下只剩 10 字符。无水平滚动机制。

---

### 15. Terminal resize 无防抖

**位置**：[cli.ts:26](ist-tui/src/cli.ts#L26)

**问题**：每次 resize 事件立即触发 `render()`（全屏重绘）。快速拖拽窗口大小时可能频繁刷新，引起闪烁。建议加 50ms 防抖。

---

### 16. 描述编辑器不支持水平滚动

**位置**：[cli.ts:186-208](ist-tui/src/cli.ts#L186-L208)

**问题**：`wrapLines` 自动换行后，如果某一行仍因包含超长单词而溢出（或 maxW 极小），无法水平滚动查看被截断的内容。

---

### 17. 缺少 Vim 风格快捷键

当前仅支持方向键和几个字母键。IDE 用户习惯 `j/k` 上下移动、`h/l` 折叠等。可作为可选的 keybindings 配置。

---

### 18. 实验运行错误信息不够详细

**位置**：[experiment.ts:218-222](ist-tui/src/experiment/experiment.ts#L218-L222)

**问题**：catch 块只记录 `safeErrorMessage(err, 500)`，可能丢失堆栈信息。建议同时记录完整 error.stack 到日志。

---

## 📋 修复优先级建议

| 优先级 | 编号 | 描述 | 预计工时 |
|--------|------|------|----------|
| P0 | #1 | 统一字符宽度计算 | 1-2h |
| P0 | #2 | 树视图滚动支持 | 1-2h |
| P0 | #3 | 路径穿越安全修复 | 0.5h |
| P1 | #4 | 光标 off-by-one | 0.5h |
| P1 | #5 | 结果查看器 scroll 重置 | 0.25h |
| P1 | #6 | 描述编辑器高度限制 | 1h |
| P2 | #7 | Tab 双向切换 | 0.25h |
| P2 | #8 | renderBox 视觉宽度 | 0.5h |
| P2 | #9 | AI Summarize 实现 | 2-4h |
| P2 | #10 | 统一 R 变量 | 0.25h |
| P3 | #11-18 | 产品完善项 | 视情况 |
