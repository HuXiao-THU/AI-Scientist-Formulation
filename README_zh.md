# IST — Idea Search Tree（灵感搜索树）

**TUI 原生的自主 AI 科研智能体。** IST 将科研过程建模为一棵由灵感和实验组成的树，每个实验节点交由 LLM 驱动的 Agent 来编写代码、执行分析、汇报结果——所有这些都在一个键盘驱动的终端界面中完成。

## 设计理念

人类研究者通过**试错**来探索科研问题——提出假设、执行实验、分析结果、产生新的分支方向。IST 复现了这一过程：

- **灵感节点（Idea）** 构成一棵树。每个灵感可以派生子灵感或具体的实验。
- **实验节点（Experiment）** 由 AI Agent 执行，编写代码、运行分析、总结发现。
- **实验结果** 沿树向上汇聚，为下一步的分支决策提供依据。

IST 探索的核心研究问题是：**在 LLM 上下文窗口有限的约束下，树节点之间需要对信息进行压缩传递，哪些科研问题可解，哪些还需要工程突破？**

## 架构

```
ist-tui/
└── src/
    ├── cli.ts              # TUI 主循环 + 键盘输入
    ├── app.ts              # 应用状态机
    ├── core/
    │   ├── types.ts        # IST 数据模型
    │   ├── ist-file.ts     # .ist 文件持久化
    │   ├── tree-model.ts   # 树 CRUD 操作
    │   └── experiment.ts   # Agent 实验执行器
    ├── tui/
    │   ├── tree-view.ts    # ASCII 树形渲染
    │   ├── node-detail.ts  # 节点详情面板
    │   └── log-panel.ts    # 实验日志面板
    └── utils/
        └── truncate.ts     # 文本工具
```

### 技术栈

| 层 | 技术 |
|---|------|
| TUI 渲染 | 终端 ANSI 转义码 |
| Agent 框架 | [`@earendil-works/pi-agent-core`](https://github.com/earendil-works/pi) |
| LLM 抽象 | [`@earendil-works/pi-ai`](https://github.com/earendil-works/pi) |
| 运行时 | Node.js ≥ 22, TypeScript |

### 为什么选择 TUI 而非 GUI？

最初的 Electron GUI 版本遇到了原生层崩溃问题（Node.js buffer assertion failure）。切换到纯终端 TUI 后，彻底消除了进程隔离、IPC 序列化和原生 UI 框架依赖——Agent 在进程内直接运行，事件流畅通无阻。

## 快速开始

### 环境要求

- **Node.js** ≥ 22
- Anthropic API Key（在环境变量中设置 `ANTHROPIC_API_KEY`）

### 安装与运行

```bash
cd ist-tui
npm install
npm run dev
```

或打开已有的 `.ist` 工程：

```bash
npm run dev -- /path/to/project.ist
```

### 键盘操作

| 键 | 功能 |
|----|------|
| `↑` `↓` | 导航树节点 |
| `i` | 添加灵感子节点 |
| `e` | 添加实验子节点 |
| `r` | 运行实验（需选中实验节点） |
| `s` | 保存工程 |
| `Tab` | 编辑标题 |
| `Del` | 删除节点 |
| `q` | 退出 |

## 工作流程

### 1. 构建研究树

从一个根灵感开始，逐步分支出研究树：

```
● [I] 加州房价预测                              ← 根灵感
├─ ● [I] 线性回归基线
│  └─ ○ [E] 运行线性回归                          ← 实验
├─ ● [I] 随机森林对比
│  └─ ○ [E] 运行随机森林
└─ ● [I] 梯度提升方法
   ├─ ○ [E] 运行 XGBoost
   └─ ○ [E] 运行 LightGBM
```

- `●` 黄色 = 灵感节点
- `○` 灰色 = 实验节点
- `✓` 绿色 = 实验成功
- `✗` 红色 = 实验失败

### 2. 运行实验

选中实验节点，按 `r`。IST 会：
1. 从根节点到当前节点的完整路径构建 system prompt
2. 创建 pi Agent 并配备代码执行工具
3. Agent 编写代码、运行分析、汇总结果
4. 右侧日志面板实时流式展示进度
5. 实验结果回写到节点并保存至 `.ist` 文件

### 3. 迭代和分支

查看实验结果，添加新的灵感和实验，继续探索。整棵研究树保留了完整的研究轨迹，便于后续分析。

## CCTS 模型（研究背景）

IST 基于**上下文约束树搜索（CCTS）**框架，该框架将 AI 自主科研形式化为 LLM 上下文窗口限制下的树搜索问题：

$$d^* = \left\lfloor \frac{C - S - D}{\alpha \cdot \overline{\Delta I}} \right\rfloor$$

其中：
- **$C$** — 上下文窗口总大小（tokens）
- **$S$** — 静态开销（系统提示 + 问题描述）
- **$D$** — 每次实验的任务需求（代码 + 环境 + 推理 + 输出）
- **$\overline{\Delta I}$** — 每次实验的平均信息增量
- **$\alpha$** — 压缩比（理想 = 1，实际 LLM 摘要 ≈ 8–16）

**可解性条件**：当 $d^* \geq k^*$（$k^*$ 为解决问题所需的最少实验次数）时，问题在当前上下文窗口 $C$ 下可解。

详见 [idea.md](idea.md) 中的原始研究构想。

## 项目进度

- [x] TUI 树形导航与编辑
- [x] Agent harness 集成（pi-agent-core）
- [x] 实验执行与流式日志
- [x] `.ist` 文件持久化
- [ ] 内置工具注册（bash, read, write）
- [ ] 每个实验独立 Git 分支
- [ ] 灵感节点 AI 摘要
- [ ] Session 持久化（JSONL）
- [ ] CCTS 上下文预算追踪
- [ ] 多 LLM 提供商支持

## 分支

| 分支 | 说明 |
|------|------|
| `main` | 稳定基线 |
| `TUI` | 活跃开发 — TUI 原生 IST |
| `GUI` | 归档 — 基于 Electron 的 GUI 版本 |

## 许可证

[Apache License 2.0](LICENSE)
