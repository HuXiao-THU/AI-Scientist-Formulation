# IST 自动化实验 MVP 功能测试指南

本文档基于 `data/cal_housing.csv` 样例数据集，逐条引导你完成 MVP 的端到端功能验证。

---

## 0. 前置检查

### 0.1 确认 Claude Code CLI 可用

在终端执行：

```bash
claude -p "Reply with exactly HELLO." --output-format json --tools ""
```

**预期结果**：返回包含 `"HELLO"` 的 JSON。如果报错，说明 Claude Code 未安装或未登录，需先完成配置。

### 0.2 确认样例数据存在

```bash
ls -la data/cal_housing.csv
```

**预期结果**：文件存在，大小约 2KB，包含 30 行 California Housing 数据。

### 0.3 安装依赖并启动应用

```bash
cd ist-app
npm install
npm run dev
```

**预期结果**：Electron 窗口打开，显示 Welcome 页面（New Project / Open Project）。

---

## 1. 基础画布功能测试

### 1.1 新建工程

1. 点击 **New Project**
2. 画布上出现一个空的根节点（黄色，灵感节点）

**验证点**：

- [ ] 画布正常渲染，根节点为黄色
- [ ] 根节点没有标题文本

### 1.2 编辑根节点

1. 点击根节点 → 右侧弹出信息栏（Node Details）
2. 在 **Title** 输入：`加州房价预测`
3. 在 **Description** 输入：`探索使用 cal_housing.csv 数据集预测加州房屋中位价格的方法。数据集包含收入中位数、房龄、平均房间数、平均卧室数、人口、平均入住率、经纬度等特征。`

**验证点**：

- [ ] 右侧信息栏正确显示，类型标签为 "Idea"（黄色）
- [ ] 标题和描述可编辑，编辑后节点标题在画布上实时更新
- [ ] 信息栏右上角的 × 可以关闭信息栏

### 1.3 画布缩放与拖动

1. 在画布空白处用鼠标滚轮缩放
2. 按住鼠标左键拖动画布平移

**验证点**：

- [ ] 缩放范围在 0.25x ~ 4x 之间，不会无限缩小或放大
- [ ] 拖动平滑，无卡顿

---

## 2. 节点树结构测试

### 2.1 添加灵感子节点

1. 选中根节点，找到节点右侧的 **+灵感节点** 按钮并点击
2. 新灵感节点出现在根节点右侧
3. 点击新节点，在信息栏输入：
  - 标题：`线性回归基线`
  - 描述：`在 cal_housing.csv 上建立简单的线性回归基线。以 MedInc、HouseAge、AveRooms、AveBedrms、Population、AveOccup、Latitude、Longitude 为特征，MedHouseVal 为目标变量。按 80/20 划分训练集和测试集，报告 RMSE 和 R²。`

**验证点**：

- [ ] 新灵感节点为黄色，通过**黄色**连线与父节点相连
- [ ] 节点在父节点**右侧**

### 2.2 添加实验节点

1. 选中刚创建的「线性回归基线」灵感节点
2. 点击 **+实验节点** 按钮
3. 点击新实验节点，在信息栏输入：
  - 标题：`运行线性回归`
  - 描述：`编写 Python 脚本：1) 读取 data/cal_housing.csv；2) 按 80% 训练 / 20% 测试划分数据；3) 使用 sklearn LinearRegression 拟合模型；4) 在测试集上打印 RMSE 和 R²；5) 将预测结果保存到 output/predictions.csv。`

**验证点**：

- [ ] 新实验节点为灰色，通过**灰色**连线与父灵感节点相连
- [ ] 实验节点位于父灵感节点**下方**
- [ ] 信息栏类型标签显示 "Experiment"（灰色）
- [ ] 实验节点的信息栏中出现 **Run Experiment** 按钮和 Status 状态行

### 2.3 验证实验节点不可添加子节点

1. 选中上一步的实验节点

**验证点**：

- [x] 实验节点旁**没有** +灵感节点 和 +实验节点 按钮

### 2.4 添加第二个灵感子节点

1. 再次选中根节点
2. 点击 **+灵感节点**
3. 编辑新节点：
  - 标题：`随机森林方案`
  - 描述：`在同一数据集上尝试随机森林回归，并与线性回归基线进行对比。`

**验证点**：

- [ ] 两个灵感子节点在根节点右侧**从上往下排列**
- [ ] 节点与连线不重叠，布局自动调整

---

## 3. 保存与打开工程文件测试

### 3.1 保存工程

1. 按 `Cmd+S`（Mac）
2. 在弹出的保存对话框中选一个位置，文件名为 `test-housing.ist`

**验证点**：

- [ ] 弹出保存对话框，默认扩展名为 `.ist`
- [ ] 保存后标题栏显示文件路径，不再有 `*` 脏标记

### 3.2 验证 `.ist` 文件内容

在终端中检查保存的文件：

```bash
cat /path/to/your/test-housing.ist | python3 -m json.tool | head -30
```

**验证点**：

- [ ] 文件为合法 JSON
- [ ] 包含 `version`、`rootNodeId`、`nodes`、`meta` 字段
- [ ] `nodes` 中有根节点、两个灵感子节点、一个实验节点
- [ ] 节点包含你输入的 title 和 description

### 3.3 关闭并重新打开

1. 按 `Cmd+N` 新建一个空工程（原工程被替换）
2. 按 `Cmd+O`，选择刚才保存的 `test-housing.ist`

**验证点**：

- [ ] 所有节点和内容完整恢复
- [ ] 树状结构布局与保存前一致

---

## 4. Harness 配置测试

### 4.1 检查默认配置

1. 点击右上角 **Settings** 按钮
2. 向下滚动到 **Experiment Harness (Claude Code CLI)** 区域

**验证点**：

- [ ] Command 默认值为 `claude`
- [ ] Permission mode 默认值为 `bypassPermissions`
- [ ] Model 为空（使用 Claude Code 默认模型）
- [ ] Extra args 为空

### 4.2 保持默认配置

如果你的 Claude Code CLI 就是 `claude` 命令（通常如此），则无需修改。直接点击 **Save** 关闭。

> 如果你的 Claude Code 安装路径不在 PATH 中，需要在 Command 中填入完整路径，如 `/usr/local/bin/claude`。

---

## 5. 自动化实验核心测试 ⭐

这是 MVP 最核心的测试环节。

### 5.1 运行实验前的准备

1. 确保已保存工程（`Cmd+S`），因为工作区路径依赖于 `.ist` 文件位置
2. 注意保存位置：如果你将 `.ist` 保存为 `/Users/you/test-housing.ist`，则工作区将自动创建在 `/Users/you/test-housing-workspace/`

### 5.2 运行第一个实验

1. 点击之前创建的实验节点「运行线性回归」
2. 确认信息栏中 Description 已填写（必须非空才能运行）
3. 点击 **Run Experiment** 按钮

**观察与验证**：

- [ ] 按钮变为 **Stop Experiment**（红色）
- [ ] Status 显示 **Running**（黄色）
- [ ] 窗口底部出现 **Experiment Log** 面板，显示 "Running…"
- [ ] 日志面板中开始出现流式输出（Claude Code 的思考和操作过程）
- [ ] 日志自动滚动到底部

### 5.3 等待实验完成

实验通常需要 1~5 分钟。耐心等待，观察日志输出。

**实验完成后验证**：

- [ ] Status 变为 **Done**（绿色）或 **Failed**（红色）
- [ ] 按钮恢复为 **Run Experiment**
- [ ] 信息栏中出现 **Result** 区域，显示实验摘要文本
- [ ] 信息栏中出现 **Branch** 信息，格式为 `exp/xxxxxxxx`

### 5.4 验证 Git 工作区

在终端中检查工作区：

```bash
# 替换为你实际的工作区路径
WORKSPACE="/path/to/test-housing-workspace"

# 确认是 git 仓库
git -C "$WORKSPACE" log --oneline --all

# 查看分支列表，应包含 main 和 exp/xxxxxxxx
git -C "$WORKSPACE" branch -a

# 查看实验分支上的文件
git -C "$WORKSPACE" ls-tree --name-only HEAD
```

**验证点**：

- [ ] 工作区目录已自动创建
- [ ] 是一个合法的 git 仓库
- [ ] `main` 分支存在，包含基线 commit（含 `data/cal_housing.csv`）
- [ ] 实验分支 `exp/xxxxxxxx` 存在
- [ ] 实验分支上有 Claude Code 生成的代码文件（如 `.py` 脚本）
- [ ] 实验分支上有 `RESULT.md` 文件

### 5.5 验证运行轨迹落盘

```bash
ls "$WORKSPACE/.ist-runs/"
```

**验证点**：

- [ ] 存在一个以 UUID 命名的子目录
- [ ] 子目录中包含：
  - `prompt.md` — 发送给 Claude Code 的完整 prompt
  - `command.json` — 实际执行的 CLI 命令
  - `stdout.jsonl` — Claude Code 的原始流式输出
  - `result.json` — 运行结果摘要（含 `success`、`gitBranch`、`experimentResult`、`exitCode`）

检查 prompt 内容：

```bash
cat "$WORKSPACE/.ist-runs/$(ls $WORKSPACE/.ist-runs/ | head -1)/prompt.md"
```

**验证点**：

- [ ] prompt 包含 "Inspiration path (root → current)" 部分，从根节点到当前实验节点的完整路径
- [ ] prompt 包含实验描述
- [ ] prompt 包含 "data/cal_housing.csv" 的提示

### 5.6 验证结果回写到节点

1. 按 `Cmd+S` 保存工程
2. 在终端中检查 `.ist` 文件：

```bash
cat /path/to/test-housing.ist | python3 -c "
import json, sys
proj = json.load(sys.stdin)
for nid, n in proj['nodes'].items():
    if n['type'] == 'experiment':
        print(f\"Node: {n['title']}\")
        print(f\"  runStatus: {n.get('runStatus')}\")
        print(f\"  gitBranch: {n.get('gitBranch')}\")
        print(f\"  experimentResult: {(n.get('experimentResult') or '')[:200]}...\")
"
```

**验证点**：

- [ ] `runStatus` 为 `done`
- [ ] `gitBranch` 为 `exp/xxxxxxxx`
- [ ] `experimentResult` 包含实验摘要文本
- [ ] `meta.workspacePath` 已被设置（保存后可在 JSON 中看到）

---

## 6. 停止实验测试

### 6.1 创建一个新的长时间实验

1. 在「线性回归基线」灵感节点下再添加一个实验节点
2. 描述输入：`编写一个完整的 Python 脚本，在 data/cal_housing.csv 上对 5 种回归模型（Linear、Ridge、Lasso、ElasticNet、SVR）进行穷举式超参数网格搜索，使用 10 折交叉验证。每个模型至少尝试 20 组超参数组合。`
3. 点击 **Run Experiment**

### 6.2 中途停止

1. 等待几秒钟，确认日志已开始输出
2. 点击 **Stop Experiment**

**验证点**：

- [ ] 实验在几秒内停止
- [ ] Status 恢复为 **Idle**
- [ ] 日志面板停止更新

---

## 7. AI 辅助功能测试

> 此部分需要在 Settings 中配置 AI（OpenAI 或 Anthropic 的 API Key）。如果暂未配置，可跳过。

### 7.1 配置 AI

1. 点击 **Settings**
2. 选择 Provider（如 OpenAI）
3. 填入 Base URL（默认即可）和 API Key
4. 选择 Model（如 `gpt-4o-mini`）
5. 点击 **Save**

### 7.2 AI 生成标题

1. 新建一个灵感节点，只填描述：`在加州房价数据集上应用 XGBoost、LightGBM 等梯度提升方法，并与集成堆叠（ensemble stacking）方案对比性能。`
2. 点击 **AI Generate Title**

**验证点**：

- [ ] 标题自动生成，内容与描述相关
- [ ] 生成过程中按钮显示 "Generating..."

### 7.3 AI 一键总结

1. 选中根节点
2. 点击 **AI Summarize**

**验证点**：

- [ ] 描述被更新为 AI 生成的总结
- [ ] 总结涵盖从根到当前灵感节点的路径以及所有子节点的概要

---

## 8. 节点删除测试

### 8.1 删除空节点

1. 新建一个灵感节点，不填任何内容
2. 选中它，按 `Delete` 键

**验证点**：

- [ ] 节点直接删除，无弹窗确认

### 8.2 删除有内容的节点

1. 选中一个有标题的节点
2. 按 `Delete` 键

**验证点**：

- [ ] 弹出确认对话框
- [ ] 取消后节点仍在
- [ ] 确认后节点及其所有子节点被删除

### 8.3 根节点不可删除

1. 选中根节点
2. 按 `Delete` 键

**验证点**：

- [ ] 无反应，根节点不可删除

---

## 9. 错误处理测试

### 9.1 无描述时运行实验

1. 创建一个实验节点，Description 留空
2. 点击 **Run Experiment**

**验证点**：

- [ ] 显示错误提示 "Please enter an experiment description first"
- [ ] 实验不会启动

### 9.2 未保存工程时运行实验

1. 按 `Cmd+N` 新建工程（不保存）
2. 创建灵感节点 → 创建实验节点 → 填写描述 → Run Experiment

**验证点**：

- [ ] 应用应能处理此情况（工作区会使用 `userData` 下的默认路径），不会崩溃

---

## 10. 端到端完整流程回顾 Checklist

完成以上所有测试后，对照确认：


| #   | 功能                                                  | 通过？ |
| --- | --------------------------------------------------- | --- |
| 1   | 新建/打开/保存 `.ist` 工程文件                                |     |
| 2   | 灵感节点（黄色）与实验节点（灰色）正确渲染                               |     |
| 3   | 树状布局自动排列，连线颜色正确                                     |     |
| 4   | 画布缩放与拖动                                             |     |
| 5   | 右侧信息栏编辑标题、描述                                        |     |
| 6   | 节点删除逻辑（空节点/有内容/根节点）                                 |     |
| 7   | 快捷键（Cmd+S/N/O/Delete/Escape）                        |     |
| 8   | Settings 中配置 Harness 参数                             |     |
| 9   | Run Experiment → Claude Code CLI 被调用                |     |
| 10  | 实时流式日志显示在 LogPanel                                  |     |
| 11  | 实验完成后 git commit 到独立分支                              |     |
| 12  | 实验结果回写到节点（runStatus / gitBranch / experimentResult） |     |
| 13  | 运行轨迹落盘到 `.ist-runs/`                                |     |
| 14  | Stop Experiment 能正常终止实验                             |     |
| 15  | AI Generate Title（需配置 AI）                           |     |
| 16  | AI Summarize（需配置 AI）                                |     |
| 17  | 工程保存后重新打开，所有数据完整恢复                                  |     |


