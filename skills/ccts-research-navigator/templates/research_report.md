# Autonomous Research Report: 30-min Traffic Speed Prediction

*Generated automatically by the CCTS Research Navigator skill.*

## 1. Problem

Predict corridor average speed 30 minutes ahead from 5-minute loop-detector
history (4 weeks of data, last 25% held out chronologically).
Success criterion: test MAE <= {target_mae} km/h.

## 2. Context Budget (CCTS)

| Quantity | Value |
| --- | --- |
| Context window C | {context_window} tokens |
| Static overhead S | {static_cost} tokens |
| Task demand D | {task_cost} tokens |
| Mean information gain dI | {delta_i} tokens/experiment |
| Compression ratio alpha | {alpha} |
| Depth upper bound d* | **{d_star}** experiments |
| Experiments executed | {n_experiments} |

## 3. Experiment Log

| # | Action | Configuration | MAE (km/h) | vs parent | Verdict |
| --- | --- | --- | --- | --- | --- |
{experiment_rows}

## 4. Best Hypothesis Chain

{hypothesis_chain}

## 5. Conclusion

{conclusion}
