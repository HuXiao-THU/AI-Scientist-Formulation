# 详细使用示例

## 端到端会话示例

**用户**：「我的 Agent 上下文窗口只有 32k tokens，帮我自主做实验，把 30 分钟
交通速度预测的 MAE 降到 2.5 以下。」

**Agent 使用本技能的完整流程：**

### 1. 先算预算

```bash
python scripts/context_budget.py --context-window 32000 --static-cost 3500 \
  --task-cost 8600 --delta-i 50 --alpha 10 --steps 12
```

关键输出：

```json
{
  "d_star": 39,
  "feasible": true
}
```

d\* = 39 ≥ 所需实验数，问题可解，继续。

### 2. 树搜索式执行实验（每次只改一个因素）

```bash
# 实验 0：气候学基线
python scripts/run_experiment.py --model historical_average
# -> {"mae": 4.2068, ...}

# 实验 1：假设「速度强自相关」→ 换自回归岭回归
python scripts/run_experiment.py --model ridge --n-lags 3
# -> {"mae": 3.1988, ...}  改进 ✓

# 实验 2：假设「拥堵有积累过程」→ 增加滞后窗口
python scripts/run_experiment.py --model ridge --n-lags 12 --time-features
# -> {"mae": 3.0172, ...}  改进 ✓

# 实验 3：假设「高峰动力学非线性」→ 升级到梯度提升
python scripts/run_experiment.py --model gradient_boosting --n-lags 12 --time-features
# -> {"mae": 2.4741, ...}  达标 ✓ 停止实验
```

每次实验后追加一行到 `experiments.jsonl`：

```json
{"step": 0, "action": "baseline", "config_desc": "HA", "hypothesis": "Establish a climatology baseline.", "mae": 4.2068, "parent_step": null}
{"step": 1, "action": "switch to autoregressive ridge", "config_desc": "Ridge 3L", "hypothesis": "Speeds are strongly autocorrelated.", "mae": 3.1988, "parent_step": 0}
{"step": 2, "action": "extend lags + calendar features", "config_desc": "Ridge 12L+T", "hypothesis": "Congestion is periodic and builds up over time.", "mae": 3.0172, "parent_step": 1}
{"step": 3, "action": "upgrade to gradient boosting", "config_desc": "GBM 12L+T", "hypothesis": "Rush-hour dynamics are nonlinear.", "mae": 2.4741, "parent_step": 2}
```

### 3. 生成研究报告

```bash
python scripts/make_report.py --log experiments.jsonl \
  --context-window 32000 --target-mae 2.5 --output report.md
```

`report.md` 即为可直接交付的结构化研究报告。

## 预算不足的示例（应拒绝开始实验）

```bash
python scripts/context_budget.py --context-window 12500 --static-cost 3500 \
  --task-cost 8600 --delta-i 50 --alpha 10 --steps 3
# -> {"d_star": 0, "feasible": false, ...}
```

此时 Agent 应回复：「当前 12.5k 上下文窗口无法容纳任何一次完整实验
（工作上下文 < 任务需求 D）。建议：把窗口增大到 ≥ 13.1k tokens，或将
压缩比 α 从 10 降到 8 以下。」

## 超参数示例

```bash
python scripts/run_experiment.py --model gradient_boosting --n-lags 12 \
  --time-features --hyperparams '{"n_estimators": 120, "max_depth": 4}'
```
