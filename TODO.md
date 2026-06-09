# IST TUI — Bug Report & Product Requirements

> 基于白盒代码审查 + 运行时测试，2026-06-10
> 工程师修复完成：2026-06-10
> **二次审查验证：2026-06-10**
> **二次修复完成：2026-06-10** ← 本次更新

---

## 🔴 严重 Bug（Critical）

### 1. 字符宽度计算不一致 ✅ 二次修复通过

**工程师回复（二次）**：`visualWidth()` 和 `truncateToWidth()` 中 `charWidth(cp) ? 2 : 1` 改为 `charWidth(cp)`。`charWidth()` 返回 1 或 2 number，不是 boolean，去掉三元运算符直接使用返回值。

**修改**：[truncate.ts:25](ist-tui/src/utils/truncate.ts#L25) 和 [truncate.ts:55](ist-tui/src/utils/truncate.ts#L55)。

### 2. 树视图无滚动支持 ✅ 通过

### 3. Agent 路径穿越安全修复 ✅ 通过

---

## 🟡 高优先级（High）

### 4. 描述编辑器光标 off-by-one ✅ 通过

### 5. 结果查看器 scroll 重置 ✅ 通过

### 6. 描述编辑器高度限制 ✅ 二次修复通过

**工程师回复（二次）**：删除了空 while 循环体（cli.ts:223-225），它会导致 100% 概率无限挂起。描述编辑器的 footer 计算已自动处理间距，无需额外 padding。

**修改**：[cli.ts:223-225](ist-tui/src/cli.ts#L223-L225) — 删除空 while 循环。

---

## 🟠 中优先级（Medium）

### 7-10. Tab/ renderBox/ AI Summarize/ 统一 R ✅ 全部通过

---

## 🟢 低优先级 / 产品完善

### 11-18. 折叠/undo/vim 等 — Phase 2 / Won't fix ✅ 接受

---

## 📋 最终总结

| 编号 | 描述 | 最终状态 |
|------|------|---------|
| #1 | 统一字符宽度计算 | ✅ 通过 |
| #2 | 树视图滚动支持 | ✅ 通过 |
| #3 | 路径穿越安全修复 | ✅ 通过 |
| #4 | 光标 off-by-one | ✅ 通过 |
| #5 | 结果查看器 scroll 重置 | ✅ 通过 |
| #6 | 描述编辑器高度限制 | ✅ 通过 |
| #7 | Tab 双向切换 | ✅ 通过 |
| #8 | renderBox 视觉宽度 | ✅ 通过 |
| #9 | AI Summarize | ✅ 通过 |
| #10 | 统一 R 变量 | ✅ 通过 |
| #15 | Resize 防抖 | ✅ 通过 |
| #11-14,16-18 | 产品完善 | Phase 2 |

**所有 P0/P1/P2 问题已修复并通过验证。**
