# IST TUI — Bug Report & Product Requirements

> 基于白盒代码审查 + 运行时测试，2026-06-10
> 修复完成：2026-06-10

---

## 🔴 严重 Bug（Critical）

### 1. 字符宽度计算不一致，导致 TUI 行截断错误 ✅ 已修复

**回复**：已统一到 `charWidth(cp)` 函数（truncate.ts），使用精确 Unicode 范围。`clipToWidth()` 和 `wrapLines()` 均改为调用 `charWidth()`。Box-Drawing 字符（├─│└┘）、几何符号（●○◉✓✗）、Latin 扩展字符均正确计为宽度 1。

### 2. 树视图无滚动支持 ✅ 已修复

**回复**：添加 `treeScroll` 状态。导航时自动滚动使选中节点保持在可视区域内。`navigateUp/Down` 后选中节点不再跑出屏幕。

### 3. Agent 工具存在路径穿越安全漏洞 ✅ 已修复

**回复**：添加 `resolvePath()` 函数，使用 `path.resolve()` 解析并验证路径必须在 workspace 内。拒绝 `../` 穿越和绝对路径逃逸。read/write 工具均受保护。

---

## 🟡 高优先级（High）

### 4. 描述编辑器光标定位存在 off-by-one 错误 ✅ 已修复

**回复**：`cursorDisplayPos()` 中边界条件从 `pos <= endPos` 改为 `pos < endPos`，光标在换行后正确显示在下一行而非上一行末尾。

### 5. 结果查看器切换节点后 scroll 位置不重置 ✅ 已修复

**回复**：按 `m` 进入结果查看模式时设置 `resultScroll = 0`，每次从头开始显示。

### 6. 描述编辑器占满中部空间，编辑时树被挤压 ✅ 已修复

**回复**：限制描述编辑器最多显示 10 行，超出部分通过 `descScroll` 滚动。光标自动跟随（auto-scroll），树视图始终保留至少 5 行可见。

---

## 🟠 中优先级（Medium）

### 7. Tab 键在两种编辑模式间切换不对称 ✅ 已修复

**回复**：Title 编辑按 Tab → 切换到 Description；Description 编辑按 Tab → 切换回 Title。双向循环。

### 8. renderBox 内容宽度计算使用原始字符串长度而非视觉宽度 ✅ 已修复

**回复**：`renderBox` 中宽度计算改为 `visualWidth(stripAnsi(c))`，正确处理 Emoji 等宽字符。

### 9. AI Summarize 功能为 stub，未实现 ✅ 已修复

**回复**：完整实现。选中 idea 节点按 `a` 启动 AI Summarize，Agent 汇总当前 idea 及其子树内容，结果写入 description。键位提示已更新。

### 10. 日志面板使用 `process.stdout.rows` 而非统一的 `R` 变量 ✅ 已修复

**回复**：`renderLogPanel` 接受 `availHeight` 参数，由 `cli.ts` 传入 `R`，消除 `process.stdout.rows` 直接引用。

---

## 🟢 低优先级 / 产品完善（Low / Enhancement）

### 11. 缺少树节点折叠/展开功能

**回复**：评估为有意义的 feature，但实现复杂度较高（需跟踪折叠状态、重计算树渲染）。建议作为 Phase 2 功能。

### 12. 缺少 Undo/Redo 支持

**回复**：建议使用 command pattern 实现撤销栈。当前阶段误操作风险较低（有删除确认），Phase 2 考虑。

### 13. 实验日志条目可能过大

**回复**：日志条目已有 500 条上限和连续去重。Assistant 消息通常为增量流式更新（不是完整响应），内存风险低。暂不处理。

### 14. 缺少树节点水平滚动（深度嵌套时）

**回复**：当前树深度有限（通常 < 10 层），前缀宽度约 30 字符，仍有足够空间显示标题。深度达到 20+ 时再考虑。

### 15. Terminal resize 无防抖 ✅ 已修复

**回复**：添加 50ms debounce，快速拖拽窗口不再频繁重绘。

### 16. 描述编辑器不支持水平滚动

**回复**：当前通过 word-wrap 处理长行。超长单词（无空格）极少出现在自然语言描述中。暂不处理。

### 17. 缺少 Vim 风格快捷键

**回复**：当前方向键 + 字母键已覆盖主要操作。Vim 键位（j/k）可作为可选配置，Phase 2。

### 18. 实验运行错误信息不够详细

**回复**：`safeErrorMessage(err, 500)` 提取了 err.message，典型 Node.js 错误已包含足够信息。完整 stack trace 可通过 `IST_DEBUG=1` 环境变量在后续版本启用。

---

## 📋 修复总结

| 优先级 | 编号 | 描述 | 状态 |
|--------|------|------|------|
| P0 | #1 | 统一字符宽度计算 | ✅ |
| P0 | #2 | 树视图滚动支持 | ✅ |
| P0 | #3 | 路径穿越安全修复 | ✅ |
| P1 | #4 | 光标 off-by-one | ✅ |
| P1 | #5 | 结果查看器 scroll 重置 | ✅ |
| P1 | #6 | 描述编辑器高度限制 | ✅ |
| P2 | #7 | Tab 双向切换 | ✅ |
| P2 | #8 | renderBox 视觉宽度 | ✅ |
| P2 | #9 | AI Summarize 实现 | ✅ |
| P2 | #10 | 统一 R 变量 | ✅ |
| P3 | #11 | 树节点折叠 | Phase 2 |
| P3 | #12 | Undo/Redo | Phase 2 |
| P3 | #13 | 日志条目截断 | Won't fix |
| P3 | #14 | 水平滚动 | Phase 2 |
| P3 | #15 | Resize 防抖 | ✅ |
| P3 | #16 | 描述水平滚动 | Won't fix |
| P3 | #17 | Vim 快捷键 | Phase 2 |
| P3 | #18 | 错误信息详情 | Phase 2 |
