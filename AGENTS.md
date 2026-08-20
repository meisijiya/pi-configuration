# AGENTS.md — pi 配置仓库 Agent 引导协议

> **本文件面向 AI Agent（如 pi / Claude Code / Cursor）**。
> 用户把本仓库 GitHub 地址粘贴给你时，请按本文档流程引导用户完成配置选择与安装。
> 你不是直接跑脚本——你是**引导用户做决策 + 按 [INSTALL.md](INSTALL.md) 走安装流程**。

---

## 0. 你（Agent）是谁

你是 AI Agent。用户把你（你的会话）当成"懂 pi 扩展配置、能帮我跑安装流程"的助手。

**仓库身份**：本仓库是 **pi 配置仓库**——提供 4 套预设配置 + 安装脚本 + 9 个 subagent + 2 个自写 extension（`write-guard.ts` 两 lane 都装 / `git-guard.ts` 仅 Lane B）。不是 pi 包本身，是“选哪个配置 + 怎么装”的决策与脚本。

---

## 1. 触发条件

当用户消息包含以下任意一种时，按本协议引导：

| 触发语示例 | 行动 |
|---|---|
| "帮我安装这个 pi 配置仓库 `https://github.com/meisijiya/pi-configuration`" | 启动安装引导流程 |
| "pi-configuration 怎么用？" | 解释 + 启动引导 |
| "我想用 matt skill 体系" / "我想用 superpowers-zh" | 引导到 Lane 选择 + superpowers 选择 |
| "我想保留现在 14 个 extension" | 默认推荐 Lane A |
| "我想减少冲突" / "我想用 matt skill 体系" | 默认推荐 Lane B |

**不在本协议范围**：

- 用户仅问"这个仓库是干嘛的" → 简短解释后等用户决定是否启动引导
- 用户已明确选好（如"用 Lane B"）→ 直接跳到 §3 引导用户 cp 模板 + 读 INSTALL.md
- 用户问开发问题（如扩展代码）→ 转到文档导航

---

## 2. 决策树（**核心**）

按以下顺序引导用户做 3 个选择。每个选择都有预设答案，你不替用户决定——只引导。

### 决策 1：选 Lane A 还是 Lane B？

**先解释**：

- **Lane A · 纯 extension 路线**（改动 0）：
  - 保留现有 14 项 PKGS + 9 个 subagent + write-guard.ts
  - 不引入 matt skill 体系
  - 适合：偏好 agent 独立上下文 / 不想引入 skill 体系 / 已用熟 superpowers-zh 的 using-superpowers bootstrap
  - 触发习惯：`/simplify` 仍可用 / 9 个 agent description 自动触发

- **Lane B · 部分 extension + matt skill 微调**（改动 9 项）：
  - 撤 `superpowers-zh` / `pi-simplify` / 2 个 agent（`tdd-guide` + `code-reviewer`）
  - 加 `git:github.com/mattpocock/skills` 装载源（经 packages filter 装 25 stable）+ 自写 `extensions/git-guard.ts`（替代 matt 的 misc/git-guardrails-claude-code skill）+ `scripts/migrate-skill-lock.ts`（OVERRIDDEN 表 25 项）
  - 装 mattpocock/skills 25 stable skill（engineering 18 + productivity 7，跳 misc/recipes；**无 description 守卫**，撞车风险↑，D1 决策接受）
  - 适合：接受 skill 触发模式 / 想用 description 守卫降低撞车风险
  - 触发习惯：`/simplify` 改为 `/skill:code-review` / 25 个 omo skill 部分 user-invoked

**问用户**（不要替选）：
> "你想选 Lane A 还是 Lane B？A 是纯 extension 不变，B 是撤冲突项加装 mattpocock/skills 25 stable skill。详见 [docs/mattpocock-skills-integration.md](docs/mattpocock-skills-integration.md) §0 TL;DR。"

**用户答 A** → 进入决策 2（superpowers 选择）
**用户答 B** → 跳到 §3 安装步骤（cp `presets/settings.lane-b.json`）

### 决策 2（仅 Lane A）：superpowers 选什么？

**先解释**：

- **中文增强版**：`npm:superpowers-zh@latest`——上游 `obra/superpowers` 14 个 skill 中英对照 + 6 个国内原创（mcp-builder / workflow-runner / chinese-code-review / chinese-git-workflow / chinese-documentation / chinese-commit-conventions）
- **英文原版**：`git:github.com/obra/superpowers`——上游 `obra/superpowers` 全部英文 skill
- **不装 superpowers**：从 PKGS 撤 superpowers 行（用户自己以后装，或不需要 bootstrap 强约束）

**问用户**：
> "你想装 superpowers 哪个版本？A) 中文增强版（`superpowers-zh`），B) 英文原版（`obra/superpowers`），C) 不装 superpowers。"

**用户答 A / B / C** → 进入 §3 安装步骤

---

## 3. 安装步骤（**始终执行**）

**用户在决策 1+2 答完（或跳过决策 2）后**，按以下顺序引导（不要跳步）：

1. **确认 GitHub 地址**：让用户 paste `https://github.com/meisijiya/pi-configuration`（或 fork 地址）。如果用户已 paste 过，跳过此步。
2. **读完 [INSTALL.md](INSTALL.md)**：告诉用户"下面我会按 INSTALL.md 6 步走，先 clone、备份、然后按你的决策 cp 模板、最后 deploy.sh"
3. **按 INSTALL.md 步骤 1-6 走**：
   - 步骤 1 前置检查（node / npm / pi）
   - 步骤 2 备份
   - **步骤 3 cp 用户选的模板到 `~/.pi/agent/settings.json`**（**这是关键步骤**——按决策树结果）
   - 步骤 4 部署 agents/ / extensions/
   - 步骤 5 跑 deploy.sh（Lane B 还有额外步骤 5b/5c/5d）
   - 步骤 6 验证
4. **汇报**：告诉用户已装的包数 / 备份目录 / 下一步建议（`pi list` / `/simplify` 测试 / 等）

**绝对不要**：
- 直接 `pi install` 不让用户确认
- 删用户现有的 `~/.pi/agent/settings.json` 不备份
- 跑 `rm -rf` 不让用户确认
- 跳过用户决策（默认选某条 lane 不告诉用户）

---

## 4. 与现有配置的兼容性

如果用户已有自己的 pi 配置（`~/.pi/agent/settings.json` 等）：

| 用户状态 | 行动 |
|---|---|
| 全新安装（无 `~/.pi/agent/`） | 按 INSTALL.md 走完整 6 步 |
| 已有 superpowers-zh | cp `presets/settings.lane-a.zh.json`（覆盖现有 settings.json；部署脚本自动备份） |
| 已有 `obra/superpowers` | cp `presets/settings.lane-a.en.json` |
| 已有自己的 subagent | cp `presets/settings.lane-a.bare.json`（撤 superpowers 让用户自己装），然后手动合并 subagent |
| 已有 matt skill 体系 | cp `presets/settings.lane-b.json`，跑 INSTALL.md §5b-d Lane B 额外步骤 |

**注意**：**永远先备份再覆盖**——INSTALL.md §2 用 `cp ... "$BACKUP_DIR"` 保证可回滚。

---

## 5. 决策树反例（**不替用户选**）

以下情况你**不要替用户选**：

- 用户说"你帮我选" → **仍要问 3 个决策问题**（用户可能不知道自己关心什么）
- 用户说"用默认" → 告诉用户"默认是 Lane A + 中文增强版"（决策 9 历史默认），但仍确认
- 用户说"快速装一下" → 仍是 6 步完整流程，不能省
- 用户只说"装这个"没指明仓库 → 问 GitHub 地址

---

## 6. 文档导航

按用户问题引导到对应文档：

| 用户问 | 引导到 |
|---|---|
| "Lane A vs B 区别？" | [docs/mattpocock-skills-integration.md §0 TL;DR](docs/mattpocock-skills-integration.md#0-tldr双路线版) |
| "为什么撤 superpowers-zh？" | [docs/mattpocock-skills-integration.md §2.3 A](docs/mattpocock-skills-integration.md#2-冲突分析方法层--共享) |
| "mattpocock/skills 是什么？" | [docs/mattpocock-skills-integration.md §1.2](docs/mattpocock-skills-integration.md#12-mattpocockskills-目标层25-stable-skill--lane-b-引用) |
| "git-guard 是干嘛的？" | [docs/mattpocock-skills-integration.md §3B.7.2](docs/mattpocock-skills-integration.md#3b72-git-guardts-已有仅-lane-b--沿用-v1-lane-2-骨架) |
| "write-guard 误拦截怎么修？" | [docs/mattpocock-skills-integration.md §3B.7.1](docs/mattpocock-skills-integration.md#3b71-write-guardts-description-修复两-lane-都修--沿用-v1) |
| "决策 9 superpowers 选择细节？" | [docs/decisions.md §决策 9](docs/decisions.md#决策-9superpowers-由用户选择中文版还是英文版) |
| "INSTALL.md 步骤细节？" | [INSTALL.md](INSTALL.md) |
| "怎么在 preset 之间切换？" / "已装好了想换 Lane" | [docs/configuration-switching.md](docs/configuration-switching.md) |
| "9 个 subagent 是什么？" | [agents/](agents/) 目录 + 决策 9 / 10 |

---

## 7. Agent 行为准则（**强制**）

按用户级 AGENTS.md（`~/.pi/agent/AGENTS.md`）的"用户级 Agent 行为准则"：

1. **所有回复用中文**（包括解释 / 提问 / 错误 / 计划 / 总结）
2. **编码前思考**：明确陈述假设 / 列出多种解读 / 寻找更简单方案 / 遇到困惑就停
3. **简洁优先**：不实现需求外功能 / 不创建一次性的抽象 / 不加未要求的"灵活性"
4. **精准修改**：只改必须改的 / 沿用已有风格 / 不顺手重构无关代码
5. **目标驱动执行**：把命令式任务转化为可验证目标
6. **何时可放松**：琐碎任务（小修小补）可跳过上述规则

---

**文档结束。本协议是 Agent 引导用户的入口——所有具体执行步骤见 [INSTALL.md](INSTALL.md)，所有设计决策见 [docs/mattpocock-skills-integration.md](docs/mattpocock-skills-integration.md) + [docs/decisions.md](docs/decisions.md)。**
