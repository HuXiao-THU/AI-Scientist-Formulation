# AI-Scientist-Formulation

面向科研人员的 **灵感搜索树（IST, Idea Search Tree）** 桌面应用与相关设计文档仓库。核心理念是 **human in the loop**：由人掌握研究脉络与细节，再逐步接入自动化实验与 Agent 能力。

## 仓库结构

| 路径 | 说明 |
|------|------|
| [`idea.md`](idea.md) | 产品愿景、交互与数据模型需求（含规划中的 Agent / Git 分支等） |
| [`ist-app/`](ist-app/) | **当前可运行的桌面应用**（Electron + React） |
| [`.cursor/plans/`](.cursor/plans/) | 内部技术方案与 MVP 计划（可选阅读） |

应用源码与依赖均在 `ist-app` 子目录，请在**该目录**下安装依赖与执行脚本。

## `ist-app` 已实现能力（MVP）

- **画布**：XMind 风格树状布局（灵感节点向右展开、实验节点在父灵感节点下方排列），SVG 节点与贝塞尔连线；支持平移与缩放（`react-zoom-pan-pinch`）。
- **节点类型**：灵感节点（黄色）、实验节点（灰色）；实验节点下不可再挂子节点（与 `idea.md` 一致）。
- **编辑与交互**：点击节点在右侧详情栏编辑标题与描述；从灵感节点可新建子灵感或子实验；删除时根据是否有内容/子树弹出确认。
- **工程文件**：JSON 结构、扩展名 **`.ist`**；新建 / 打开 / 保存 / 另存为；启动时尝试恢复上次打开的文件路径。
- **快捷键**（渲染进程内）：`Cmd/Ctrl+S` 保存、`Cmd/Ctrl+Shift+S` 另存为、`Cmd/Ctrl+N` 新建、`Cmd/Ctrl+O` 打开；`Delete` / `Backspace` 删除选中节点（输入框内不触发）；`Escape` 取消选中。
- **AI（主进程调用，密钥不进入前端）**：在 **AI Settings** 中配置提供商（OpenAI / Anthropic）、Base URL、API Key、模型名；支持根据描述**生成标题**、对从根到当前灵感的路径及子树**一键总结**（兼容自定义 Base URL 的 OpenAI 式接口）。
- **打包**：`electron-builder` 配置 macOS（dmg / zip）、Windows（NSIS），并注册 **`.ist`** 文件关联（详见 `ist-app/electron-builder.yml`）。

## 技术栈（`ist-app`）

- **桌面**：Electron 35+，`electron-vite` 构建  
- **界面**：React 19、TypeScript、Tailwind CSS v4  
- **状态**：Zustand  
- **布局**：纯函数布局引擎 `src/layout/treeLayout.ts`，与 UI 解耦  

## 开发与运行

环境要求：**Node.js**（建议 LTS）与 **npm**。

```bash
cd ist-app
npm install
npm run dev
```

类型检查：

```bash
npm run typecheck
```

生产构建与本地预览打包产物：

```bash
npm run build
npm run preview
```

生成安装包 / 分发文件：

```bash
npm run package
```

输出目录见 `ist-app/electron-builder.yml` 中的 `directories.output`（默认 `ist-app/dist`）。

## `.ist` 数据概要

工程为 JSON，主要字段包括 `version`、`rootNodeId`、`nodes`（节点字典）、`meta`（创建/更新时间）。节点含 `type`（`idea` | `experiment`）、`title`、`description`、`parentId`、`childrenIds` 等；类型定义见 `ist-app/shared/types.ts`。

## 规划与未实现项

后台 **Agent 自动跑实验**、**按实验节点划分 Git 分支**、**撤销/重做**、**运行实验**按钮的具体后端等，见 [`idea.md`](idea.md) 中的长期规划；当前代码以画布编辑、文件持久化与 AI 辅助读写为主。

## 许可证

见仓库根目录 [`LICENSE`](LICENSE)。
