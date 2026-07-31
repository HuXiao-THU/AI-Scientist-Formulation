---
name: ccts-research-navigator
description: >-
  科研助手技能：在 LLM 上下文窗口预算约束下规划并执行自主科研实验
  （上下文约束树搜索 CCTS）。技能提供三个可执行脚本：上下文预算计算器、
  真实交通速度预测实验运行器、研究报告生成器。适用于"帮我自主做实验/
  调参/跑基线/评估上下文预算够不够/生成实验报告"等科研全流程请求。
version: 1.0.0
author: HuXiao-THU (AI-Scientist-Formulation)
license: Apache-2.0
language: zh-CN
triggers:
  keywords:
    - 自主实验
    - 科研助手
    - 上下文预算
    - context budget
    - 树搜索实验
    - 交通预测
    - 调参
    - 实验报告
  conditions:
    - 用户要求 Agent 自主规划并执行一系列机器学习实验
    - 用户询问在给定上下文窗口下还能执行多少次实验（可行性分析）
    - 用户要求把已完成的实验记录整理成结构化研究报告
dependencies:
  python: ">=3.11"
  packages:
    - numpy>=1.26
    - scikit-learn>=1.4
entrypoints:
  - scripts/context_budget.py
  - scripts/run_experiment.py
  - scripts/make_report.py
---

# CCTS Research Navigator（上下文约束科研导航技能）

## 技能定位

AI Agent 自主做科研时，**上下文窗口是最稀缺的资源**：每完成一次实验，
压缩后的历史信息会挤占后续实验可用的工作上下文。本技能把这一约束
形式化为 CCTS（Context-Constrained Tree Search）模型，让 Agent 能够：

1. **算预算** —— 在开始实验前计算研究深度上界 `d* = ⌊(C−S−D)/(α·ΔI)⌋`，
   判断问题在当前上下文窗口下是否可解；
2. **做实验** —— 用真实数据、真实模型执行一次可复现的交通速度预测实验，
   返回真实的 MAE/RMSE 指标；
3. **写报告** —— 把实验日志自动整理成研究报告（问题、预算、实验表、
   最优假设链、结论）。

## 执行指令（Agent 按此流程操作）

### 第 1 步：实验开始前，先计算上下文预算

```bash
python scripts/context_budget.py \
  --context-window 32000 --static-cost 3500 --task-cost 8600 \
  --delta-i 50 --alpha 10 --steps 12
```

输出 JSON 包含 `d_star`（最多可执行的实验数）、逐步的 `c_hist/c_work`
表以及 `feasible` 标志。**若 `d_star` 为 0，应立即告知用户问题在当前
上下文窗口下不可解，并建议增大窗口或降低压缩比 α，不要盲目开始实验。**

### 第 2 步：以树搜索方式逐个执行实验

从气候学基线（`historical_average`）出发，每次只改动一个因素
（换模型 / 加滞后特征 / 加日历特征 / 调超参数），并在执行前用一句话
写明假设。执行：

```bash
python scripts/run_experiment.py --model ridge --n-lags 6 --horizon 6
python scripts/run_experiment.py --model gradient_boosting --n-lags 12 \
  --time-features --rolling
```

输出 JSON 含 `mae`、`rmse`、`n_train`、`n_test`、`duration_s`，全部来自
真实训练和真实的时间序列外推测试集（后 25%）。将每次实验以一行 JSON
追加到 `experiments.jsonl`（格式见 `resources/usage_examples.md`）。

**每执行一次实验，把已用实验数与第 1 步得到的 `d_star` 对比；达到
`d_star` 时必须停止并进入第 3 步。**

### 第 3 步：生成研究报告

```bash
python scripts/make_report.py --log experiments.jsonl \
  --context-window 32000 --static-cost 3500 --task-cost 8600 \
  --delta-i 50 --alpha 10 --target-mae 2.5 --output report.md
```

生成的 `report.md` 使用 `templates/research_report.md` 模板，可直接
交付给用户。

## 输入输出契约

- 所有脚本从命令行参数读取输入、向 stdout 输出 JSON（`make_report.py`
  输出 markdown 到 `--output` 文件），退出码 0 表示成功；
- 相同参数重复运行结果完全一致（固定随机种子），保证可复现；
- 脚本互相独立，不依赖网络与外部服务。

## 限制与注意事项

- `run_experiment.py` 单次运行约 0.01–3 秒（取决于模型），不要在一次
  回复中串行执行超过 `d_star` 次；
- 当前实验场景为走廊级 30 分钟交通速度预测；扩展到其它任务时保持相同
  的 JSON 契约即可；
- 预算参数（S、D、ΔI、α）应根据实际部署的 Agent 系统实测标定，
  默认值来自 Phase 1 实测估计。

## 详细使用示例

见 `resources/usage_examples.md`（含端到端会话示例与 `experiments.jsonl`
样例），测试见 `tests/`。
