# AI-Scientist-Formulation

一个基于 GUI 的实验验证应用，用于验证 **上下文约束树搜索（Context-Constrained Tree Search, CCTS）** 框架。该框架将 AI Agent 的自主科研过程建模为 LLM 上下文窗口约束下的树搜索问题。

当前版本为 **Phase 1 MVP**，聚焦于交通预测实验场景，使用模拟（mock）执行。

## 架构概览

```
app/
├── backend/    # FastAPI REST API + CCTS 领域逻辑 (Python ≥ 3.11)
├── frontend/   # React + Vite 单页仪表盘 (Node.js)
└── worker/     # 命令行工具，通过 HTTP 推进实验一步
```

| 层级 | 技术栈 | 存储方式 |
| ---- | ------ | ------- |
| 后端 | FastAPI, Pydantic v2, Uvicorn | 内存 (dict) |
| 前端 | React 19, Vite 7 | — |
| Worker | Python + httpx | — |

## 功能特性

- **CCTS 公式引擎** — 计算深度上界 `d*`、历史上下文 `c_hist`、工作上下文 `c_work`，以及可行性判断。
- **Run 管理** — 创建预测实验 Run，可配置 `context_window`（上下文窗口）、`alpha`（压缩比）、`static_cost`（静态开销）、`task_cost`（任务需求）、`delta_i`（信息增量）。
- **模拟实验步进** — 每次点击 "Advance" 模拟一个实验节点，生成随机 MAE 结果，自动检测上下文预算是否耗尽。
- **实时仪表盘** — 表格视图展示状态、深度进度、`c_hist` / `c_work` 变化，每 3 秒自动刷新。
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

1. **创建 Run** — 设置 `Context Window`（如 32000）和 `Alpha`（如 10），点击 **Create Prediction Run**。
2. **推进实验** — 点击 **Advance** 按钮模拟一次实验步进。每步会计算新的 `c_hist` 和 `c_work`，并生成模拟的 MAE 结果。
3. **观察变化** — 观察深度 / 预测最大深度的比值、`c_hist` 逐步增长、`c_work` 逐步缩减的过程。
4. Run 将以 `completed`（MAE ≤ 4.0，实验成功）或 `failed`（上下文预算耗尽，即 `c_work < D`）状态终止。

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
| POST | `/api/runs` | 创建新 Run |
| GET | `/api/runs` | 列出所有 Run |
| GET | `/api/runs/{run_id}` | 获取 Run 详情（含所有节点） |
| POST | `/api/runs/{run_id}/steps/mock` | 推进 Run 一步（模拟） |
| GET | `/api/runs/{run_id}/events?since=N` | 从偏移量 `N` 轮询 Run 事件 |

### 创建 Run 请求体

```json
{
  "problem_type": "prediction",
  "context_window": 32000,
  "alpha": 10.0,
  "static_cost": 3500,
  "task_cost": 8600,
  "delta_i": 50,
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

## 项目进度

当前为 **Phase 1 MVP**。已完成：

- [x] CCTS 公式引擎（`d*`、`c_hist`、`c_work`、可行性判断）
- [x] 后端 REST API（内存存储）
- [x] 前端 Run 概览仪表盘
- [x] 模拟实验步进与上下文预算追踪
- [x] 后端单元测试

待实现：

- [ ] 持久化数据库（PostgreSQL）
- [ ] 真实 LLM 集成与交通预测模型
- [ ] 研究树可视化浏览器
- [ ] SSE / WebSocket 实时推送
- [ ] 更多问题类型（网络均衡分析、信号灯优化）
- [ ] 压缩比 $\alpha$ 实测实验
- [ ] Docker / Compose 部署方案
- [ ] CI/CD 流水线

## 许可证

[Apache License 2.0](LICENSE)
