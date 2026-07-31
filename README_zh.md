# AI-Scientist-Formulation

一个基于 GUI 的实验验证应用，用于验证 **上下文约束树搜索（Context-Constrained Tree Search, CCTS）** 框架。该框架将 AI Agent 的自主科研过程建模为 LLM 上下文窗口约束下的树搜索问题。

当前版本为 **Phase 2 演示版**：一个能够在上下文窗口预算约束下自主规划、执行并汇报**真实交通预测实验**（真实模型训练、真实样本外 MAE）的科研 Agent，并附带一个面向**清华大学人工智能创新大赛**的合规技能包。

## 架构概览

```
app/
├── backend/    # FastAPI REST API + CCTS 领域逻辑 + 真实实验引擎 (Python ≥ 3.11)
├── frontend/   # React + Vite 科研仪表盘：研究树、MAE 曲线、预算条 (Node.js)
└── worker/     # 命令行工具，通过 HTTP 推进实验一步
skills/
└── ccts-research-navigator/   # 独立技能包（SKILL.md + scripts + templates + tests）
```

| 层级 | 技术栈 | 存储方式 |
| ---- | ------ | ------- |
| 后端 | FastAPI, Pydantic v2, Uvicorn | 内存 (dict) |
| 前端 | React 19, Vite 7 | — |
| Worker | Python + httpx | — |

## 功能特性

- **CCTS 公式引擎** — 计算深度上界 `d*`、历史上下文 `c_hist`、工作上下文 `c_work`，以及可行性判断。
- **真实实验引擎** — 确定性走廊交通数据集（早晚高峰、逐日需求波动、交通事故、自相关噪声）+ 五种可真实训练的模型（气候学基线、岭回归、梯度提升、随机森林、MLP），指标为严格按时间切分的真实样本外 MAE/RMSE。
- **科研 Agent** — 在实验设计空间上做树搜索：选择有希望的分支 → 用一句自然语言写明假设 → 只改动一个因素 → 执行实验并评判结果；达到目标 MAE 或上下文预算耗尽时自动停止。
- **研究树仪表盘** — 实时 SVG 研究树（最优路径高亮）、实验检查器（假设 + 配置 + 指标）、MAE 收敛曲线、上下文预算条，以及一键**自动生成研究报告**（可下载 markdown）。
- **技能包** — `skills/ccts-research-navigator/` 把同样的能力封装为三个独立 CLI 脚本（预算计算器、实验运行器、报告生成器），含 SKILL.md 元数据、模板、详细使用示例和测试。
- **事件流** — 基于轮询的事件 API（`GET /api/runs/{id}/events?since=`），追踪 Run 生命周期事件。

## 环境要求

- **Python** ≥ 3.11
- **Node.js** ≥ 18（附带 npm）

## 快速开始

### 1. 启动后端

```bash
cd app/backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
uvicorn ccts_backend.main:app --reload --host 0.0.0.0 --port 8000
```

API 已在 `http://127.0.0.1:8000` 启动。验证方法：

```bash
curl http://127.0.0.1:8000/health
# {"status":"ok"}
```

### 2. 启动前端

打开新终端：

```bash
cd app/frontend
npm install
npm run dev
```

在浏览器中打开 `http://localhost:4173` 即可访问仪表盘。

> 如需连接不同的后端地址，在启动前设置 `VITE_API_BASE_URL` 环境变量：
>
> ```bash
> VITE_API_BASE_URL=http://your-host:8000 npm run dev
> ```

### 3. 使用仪表盘

1. **启动研究 Run** — 设置 `Context Window`（如 32000）、`α`（如 10）和 `Target MAE`（如 2.5），点击 **Launch Research Run**。Agent 会立即执行真实的气候学基线实验。
2. **▶ Run Agent** — Agent 自主循环「假设 → 实验 → 分析」；实时观察研究树生长、MAE 收敛、上下文预算消耗。也可用 **Single Step** 单步控制。
3. **检查节点** — 点击树中任意节点，在 Experiment Inspector 中查看其假设、配置和指标。
4. Run 以 `completed`（达到目标 MAE）或 `failed`（上下文预算耗尽，即 `c_work < D`）终止。点击 **Research Report** 查看自动生成的研究报告。

### 4.（可选）使用 Worker 命令行

Worker 可以从命令行推进一个 Run 一步：

```bash
cd app/worker
pip install -e .
python -m ccts_worker.worker_main --run-id <RUN_ID>
```

它会调用 `POST /api/runs/{run_id}/steps/mock` 并将 JSON 事件输出到 stdout。使用 `--api-base` 指定非默认的后端地址。

## API 参考

| 方法 | 端点 | 说明 |
| ---- | ---- | ---- |
| GET | `/health` | 健康检查 |
| POST | `/api/runs` | 创建新 Run（`mode: "real"` 时立即执行基线实验） |
| GET | `/api/runs` | 列出所有 Run |
| GET | `/api/runs/{run_id}` | 获取 Run 详情（含树结构的所有节点） |
| POST | `/api/runs/{run_id}/steps/agent` | Agent 执行一次真实实验（提出假设→运行→评判） |
| POST | `/api/runs/{run_id}/steps/mock` | 推进 Run 一步（模拟） |
| GET | `/api/runs/{run_id}/report` | 自动生成的 markdown 研究报告 |
| GET | `/api/runs/{run_id}/events?since=N` | 从偏移量 `N` 轮询 Run 事件 |

### 创建 Run 请求体

```json
{
  "problem_type": "prediction",
  "mode": "real",
  "context_window": 32000,
  "alpha": 10.0,
  "static_cost": 3500,
  "task_cost": 8600,
  "delta_i": 50,
  "target_mae": 2.5,
  "summary_mode": "structured"
}
```

所有字段均有默认值，其中 `context_window` 和 `alpha` 是实验的主要调节参数。

| 参数 | 含义 | 默认值 |
| ---- | ---- | ----- |
| `problem_type` | 问题类型（当前仅支持 `prediction`） | `"prediction"` |
| `context_window` | LLM 上下文窗口大小（tokens） | `32000` |
| `alpha` | 压缩比（理想=1，实际 LLM 摘要 ≈ 8–16） | `10.0` |
| `static_cost` | 静态开销 $S$（系统提示 + 问题描述） | `3500` |
| `task_cost` | 任务需求 $D$（代码 + 环境 + 推理 + 输出） | `8600` |
| `delta_i` | 平均信息增量 $\overline{\Delta I}$ | `50` |
| `summary_mode` | 摘要模式 | `"structured"` |

## 运行测试

```bash
cd app/backend
pip install -e ".[dev]"
pytest -q
```

## CCTS 模型简介

核心公式计算 AI Agent 在给定上下文窗口下能执行的最大连续实验次数（研究深度）：

$$d^* = \left\lfloor \frac{C - S - D}{\alpha \cdot \overline{\Delta I}} \right\rfloor$$

其中：
- **$C$** — 上下文窗口总大小（tokens）
- **$S$** — 静态开销（系统提示 + 问题描述），理解问题的"入场费"
- **$D$** — 任务需求（代码 + 环境 + 推理 + 输出），执行一次实验的"工作台大小"
- **$\overline{\Delta I}$** — 每次实验的平均信息增量
- **$\alpha$** — 压缩比（理想压缩=1，实际 LLM 摘要 ≈ 8–16）

**可解性条件**：当 $d^* \geq k^*$（$k^*$ 为解决问题所需的最少实验次数）时，问题在当前上下文窗口下可解。

详见 [research_plan.md](research_plan.md) 中的完整形式化框架。

## 清华大学人工智能创新大赛参赛说明

本仓库同时作为参赛作品：

- **智能体创新主赛事 · 科研助手赛道** — 仪表盘完整演示了一个自主科研 Agent 的实验闭环（假设 → 真实实验 → 分析 → 报告），且预算约束被显式量化。启发式提议策略位于 `app/backend/src/ccts_backend/domain/agent.py`，通过 `propose_next()` 单点隔离，部署到"清小搭"平台时可直接替换为平台 LLM 驱动的提议策略。
- **技能开发专项赛** — `skills/ccts-research-navigator/` 为符合标准格式的技能包：`SKILL.md` 含 YAML 元数据（名称、描述、版本、触发条件），附可执行 `scripts/`、`templates/`、含详细使用示例的 `resources/` 以及 `tests/`。

## 项目进度

当前为 **Phase 2**。已完成：

- [x] CCTS 公式引擎（`d*`、`c_hist`、`c_work`、可行性判断）
- [x] 后端 REST API（内存存储）
- [x] 真实交通预测实验引擎（5 种模型、可复现指标）
- [x] 带自然语言假设的树搜索科研 Agent
- [x] 研究树可视化 + MAE 收敛曲线 + 预算条
- [x] 自动生成 markdown 研究报告
- [x] 大赛技能包（独立 CLI 脚本）
- [x] 后端 + 技能包单元测试

待实现：

- [ ] 持久化数据库（PostgreSQL）
- [ ] LLM 驱动的提议策略（直接替换 `propose_next()`）
- [ ] SSE / WebSocket 实时推送
- [ ] 更多问题类型（网络均衡分析、信号灯优化）
- [ ] 压缩比 $\alpha$ 实测实验
- [ ] Docker / Compose 部署方案
- [ ] CI/CD 流水线

## 许可证

[Apache License 2.0](LICENSE)
