# omo-skills 集成最终设计（双路线版 · Lane A & Lane B）

> 状态：**最终设计（Design）**，经 3 lane 独立复审整合后定稿。
> 来源：升级自 `docs/mattpocock-skills-integration-survey.md`（v1.2 mattpocock/skills 调研稿，**未提交**）。
> 升级日期：2026-08-10。
> 复审反馈：3 lane 并行复审（冲突评级 / 实施细节 / 风险与重构）。
> 决策摘要：**§3A / §3B 二选一执行**。Lane A 保持现状（14 项 PKGS + 9 agent）；Lane B 微调（撤 2 agent + 撤 2 npm + 加 1 git 源 + 加 1 自写 extension）。

---

## 0. TL;DR（双路线版）

1. **pi 原生支持 Agent Skills 标准（SKILL.md）**——omo-skills 25 个 skill 全部 SKILL.md 格式，可直接 `cp -r` 到 `~/.pi/agent/skills/`（`agent` 单数）。
2. **双路线配置**——本文档 §3A 与 §3B **二选一执行**：

   | Lane | 性质 | 改动 | 适合 |
   |---|---|---|---|
   | **§3A Lane A** 纯 extension | 不装 skill 体系 | **0** | 用户偏好"agent 独立上下文" / 不想引入 skill 体系 / 已用熟 superpowers-zh |
   | **§3B Lane B** 部分 extension + matt skill 微调 | 撤 2 agent + 撤 2 npm + 加 1 git 源 + 加 1 自写 ext | **9 项** | 用户接受 skill 触发模式 + 用 description 守卫降低撞车风险 |

3. **§2.2 关键修正**（来自 Lane 1 复审）：
   - ❌ 原方案"撤 4 个 agent"基于"omo 完全覆盖"理由，对 `spec-miner` / `explore` **不成立**——omo 的 `domain-modeling` / `to-spec` 是术语 + 正向合成，不覆盖 brownfield 反向；`wayfinder` 是多会话规划，不覆盖只读文件搜索。**Lane B 实际撤 agent 数 = 2**（仅 `tdd-guide` + `code-reviewer`）。
   - ✅ `superpowers-zh` 必撤（`using-superpowers` bootstrap 与 omo on-demand 触发模型**强制冲突**）。
   - ✅ `pi-simplify` 撤（`/simplify` 由 omo `code-review` 接管，调用方式 `/simplify` → `/skill:code-review`）。
   - ✅ `pi-plan-mode` 保留（结构层职责 omo-skills 替代不了；**Lane 1 修正**：实际冲突仅 A 类，无 C 类流程覆盖）。
4. **§4 关键风险**（来自 Lane 3 复审）：
   - **§4.4 .skill-lock.json 实际 63 条记录**（非 49），且其中 47 条 `meisijiya/skills` + 1 条 `mattpocock/skills` + 15 misc。omo `cp -r` 覆盖 `handoff` 后 lock 不更新——**孤儿记录**。新增 `extensions/migrate-skill-lock.ts`。
   - **§4.8 幽灵 lock 修正**：用户机器**实际只有 9 个 SKILL.md 文件**，54 条 lock 是幽灵。`brainstorming` 等"superpowers-zh 来源"撤除后消失是**理论风险非实际**——这些 skill 现在已不在磁盘上。
   - **§4.3 git-guard 漏拦截命令**：`bash -c "git reset --hard"` / `git --exec-path=/tmp reset --hard` / 反斜杠转义 / `git -c alias.dh=... dh` 都会绕过。README 必须明列**已知绕过**。
   - **§4.1 setup-matt-pocock-skills 缓解不足**：README 软提示不够——smoke test 必跑 `/skill:setup-matt-pocock-skills` 强制 init。
5. **§3 实施关键修正**（来自 Lane 2 复审）：
   - **§3.5 README 算术 bug**：原文 `10+1+3 = 13` 是错的（实际 = 14）。应改为 `9 个外部扩展包 + 1 个 skill 源 + 3 个内置 = 13 个`。
   - **§3.3 settings.json 注释**：补一句"`extensions` 是加载列表，`packages` 是 trust 声明，二者可重叠（重复声明无害）"。
6. **不可被任何 lane 取代的扩展**（两 lane 共保留）：`codegraph-pi` / `pi-lsp-client` / `context7-pi` / `pi-tasks` / `pi-subagents` / `pi-web-access` / `pi-mcp-extension` / `supi-claude-md` / `pi-plan-mode` + 3 个内置（`pi-system-prompt` / `pi-context-view` / `pi-context-breakup`） + 自写 `write-guard.ts`。
7. **不可被任何 lane 取代的 subagent**（两 lane 共保留）：`agent-evaluator` / `harness-optimizer` / `security-reviewer` / `build-error-resolver` / `silent-failure-hunter` + **Lane B 还保留** `spec-miner` / `explore`（Lane 1 修正）。

---

## 1. 现状盘点（事实层 · 共享）

### 1.1 本仓库（基线）

**3 个内置 npm 包**（写到 `settings.json` 的 `extensions`）：

| 包 | 作用 |
|---|---|
| `pi-system-prompt` | 系统 prompt 增强 |
| `pi-context-view` | 上下文可视化 |
| `pi-context-breakup` | 上下文分段 |

**12 个外部 npm 包 + 2 个 git 包**（`deploy.sh` / `install-packages.sh` 当前 14 项 PKGS）：

| 包 | 类别 | 作用 |
|---|---|---|
| `superpowers-zh` | 方法论 | 14 翻译 + 6 国内原创 skill；`using-superpowers` bootstrap 强制 model 检查 skills |
| `nosuiyi/codegraph-pi` | 代码理解 | 4 个 tool（explore / node / search / callers） |
| `code-yeongyu/pi-lsp-client` | LSP | 40+ 语言服务器 |
| `@upstash/context7-pi` | 文档 | resolve-library-id + query-docs |
| `@tintinweb/pi-tasks` | 任务 | 7 个 tool 的 DAG 任务系统 |
| `@tintinweb/pi-subagents` | subagent | Claude Code 风格 Task tool |
| `pi-web-access` | 研究 | 20+ 搜索 provider + GitHub 克隆 + YouTube + PDF |
| `pi-mcp-extension` | MCP 桥 | 给 pi 加 MCP 客户端 |
| `@mrclrchtr/supi-claude-md` | AGENTS.md | 主动维护 CLAUDE.md / AGENTS.md |
| `pi-simplify` | 评审 | `/simplify` 只审 diff |
| `pi-plan-mode` | 流程 | `/plan` toggle，写工具屏蔽 + AI 过滤 bash |

**9 个 subagent**（`agents/` 目录，全部有 frontmatter）：

| agent | 关键能力 | omo-skills 覆盖？ |
|---|---|---|
| `agent-evaluator` | 5 轴评分 | 否（matt 无对应） |
| `build-error-resolver` | 构建/TS 错误最小 diff | 部分（omo `diagnosing-bugs`） |
| `code-reviewer` | diff 评审 + 严重度分级 | 是（omo `code-review`） |
| `explore` | 只读文件搜索（quick/medium/very thorough 三档） | 否（**Lane 1 修正**：omo `wayfinder` 是多会话规划，正交） |
| `harness-optimizer` | subagent 配置优化 | 否（matt 无对应） |
| `security-reviewer` | OWASP / 凭据扫描 | 否（matt 无对应） |
| `silent-failure-hunter` | 静默失败深审 | 部分（omo `diagnosing-bugs`） |
| `spec-miner` | OpenSpec spec 反向提取 | 否（**Lane 1 修正**：omo `domain-modeling` + `to-spec` 方向正交） |
| `tdd-guide` | 强制 TDD | 是（omo `tdd`） |

**1 个自写 extension**：`extensions/write-guard.ts`——白名单 `openspec/specs/<capability>/spec.md`，配合 `spec-miner` 防 prompt injection 越权写（**Lane 1 实测发现**：当前 description 无差别拦截所有 write 调用，必须修）。

**1 个配置层 / 部署层**：`settings.json`（声明 extensions + packages + trust）、`mcp.json`（MCP servers）、`tasks-global.json` / `tasks-project.json`（任务系统）、`web-search.json`（搜索 provider）、`deploy.sh` / `install-packages.sh`（幂等部署）、`docs/decisions.md`（决策记录 9 条）。

> 注：当前 `settings.json` 已应用决策 9（`superpowers-zh`），与升级调研稿时代一致。

### 1.2 omo-skills 目标层（25 skill · Lane B 引用）

omo-skills 仓库分 4 桶（README §仓库布局），本设计按 INSTALL.md §2 能力对照表分类：

**Engineering bucket（18 个）**：

| skill | 能力标签 | 触发方式 | 本仓库对应 |
|---|---|---|---|
| `grill-with-docs` | 追问对齐（带文档背景） | user | 无直接对应 |
| `domain-modeling` | 领域建模 | model | 部分：`spec-miner`（**Lane 1 修正**：方向正交，不覆盖） |
| `codebase-design` | 深模块设计 | model | 无对应 |
| `tdd` | 测试驱动 | model | `tdd-guide` agent |
| `improve-codebase-architecture` | 架构扫描 | user | 无对应 |
| `to-spec` | spec 合成（正向） | user | 部分：`spec-miner`（**Lane 1 修正**：方向正交） |
| `to-tickets` | 工单拆分 | user | 无直接对应 |
| `triage` | issue 分类 | user | 无对应 |
| `wayfinder` | 多会话决策票规划 | user | 无对应（**Lane 1 修正**：与 `explore` 正交） |
| `implement` | 实现调度 | user | 无对应 |
| `resolving-merge-conflicts` | 冲突解析 | model | 无对应 |
| `wizard` | 交互向导 | model | 无对应 |
| `prototype` | 原型 | model | 无对应 |
| `setup-matt-pocock-skills` | 一次性 init | user | 无对应 |
| `ask-matt` | 路由 | user | 无对应 |
| `diagnosing-bugs` | 调试 | model | 部分：`build-error-resolver` + `silent-failure-hunter` |
| `code-review` | 审查 | model | `code-reviewer` agent + `pi-simplify` |
| `research` | 研究 | model | 无对应 |

**Productivity bucket（7 个）**：

| skill | 能力标签 | 触发方式 | 本仓库对应 |
|---|---|---|---|
| `grill-me` | 追问对齐（开放反问） | user | 无对应 |
| `grilling` | 追问对齐（持续追问） | model | 同上 |
| `teach` | 教学 | user | 无对应 |
| `to-questionnaire` | 问卷 | user | 无对应 |
| `wait-what` | 纠错 | model | 无对应 |
| `writing-for-agents` | 写作规范 | model | 无对应 |
| `handoff` | 交接 | user | `pi-tasks` + `pi-subagents` 间接支撑 |

**5 个备选（INSTALL.md §3 标注）**：omo 内置覆盖装 omo 时跳过；装 pi 时按 §4 步骤 2 现场询问。本设计 Lane B **全装入**（25 个）。

### 1.3 装载源与目录（仅 Lane B 装载）

| 项 | 值 |
|---|---|
| 源仓库 | `https://github.com/meisijiya/omo-skills` |
| git ref | default branch HEAD（trust maintainer，与现有 2 个 git 源策略同；详见 §4.4） |
| 装载方式 | INSTALL.md §5 pi 章节：for 循环 `cp -r skills/<bucket>/<name> <target>/` |
| 目标目录 | `~/.pi/agent/skills/`（agent 单数） |
| 实际生效 | 当前 `~/.pi/agent/skills/` 已 symlink 到 `~/.agents/skills/`，一份装两份可见 |

### 1.4 用户机器当前状态（**修正版 · Lane 3 复审**）

`~/.agents/.skill-lock.json` 实际状态：

- **63 条 lock 记录**（§1.4 v1 写 49 是错的——已修正）
- 来源分布（Lane 3 统计）：47 `meisijiya/skills` + 1 `mattpocock/skills`（含 `handoff`）+ 4 `anthropics/skills` + 3 `stablyai/orca` + 8 misc（OthmanAdi / vercel-labs / lewislulu / ...）
- **实际只有 9 个 SKILL.md 文件**在 `~/.agents/skills/` 下——其余 54 条 lock 是幽灵（已删但 lock 未清理）
- 9 个真实 SKILL.md 包括 `brainstorming` / `diagnosing-bugs` / `research` / `prototype` / `computer-use` / `docx` / `orca-cli` / `orchestration` / `pdf` / `pptx` / `weread-skills` 等

→ **`brainstorming` 等实际是 meisijiya/skills 域来源**（47/63），不是 superpowers-zh 来源（lock 中**无任何 superpowers-zh 条目**）。

### 1.5 Lane A / Lane B 与用户当前状态对应

| 用户当前状态 | 对应 Lane | 备注 |
|---|---|---|
| 保留 superpowers-zh + 4 agent 全留 + 9 个 SKILL.md 不变 | **Lane A** | 保持现状；omo-skills 仅作参考 |
| 撤 superpowers-zh + 撤 tdd-guide + code-reviewer + 装 omo-skills 25 skill + 修 write-guard + 加 git-guard + 加 migrate-skill-lock | **Lane B** | 完整迁移 |

---

## 2. 冲突分析（方法层 · 共享）

### 2.1 冲突类型分类

omo-skills 与本仓库的冲突**不在 pi runtime 加载层**（skills 走 on-demand 加载，extension 走常驻），而是 **3 类语义层冲突**：

| 冲突类型 | 含义 | 风险 |
|---|---|---|
| **A. trigger 重叠** | 两个能力的 description 都匹配同一类用户输入 | model 不知道选哪个，prompt 缓存抖动 |
| **B. 职责重复** | 两个能力做同一件事但风格/深度不同 | 用户认知负担 + prompt 体积浪费 |
| **C. 流程覆盖** | 一个能力强制走完整流程，另一个被嵌入其中 | model 提示词互相覆盖，效果不可预测 |

omo-skills 的 14 个 description 守卫**降低 A 类风险**（加了去歧义短语 + "何时不调用" 段落），不消除 B/C。

### 2.2 按冲突类型逐项判定（**修正版 · Lane 1 复审**）

| 本地能力 | omo-skills 对应 | 冲突类型 | 严重度 | 方案 | 修正说明 |
|---|---|---|---|---|---|
| `superpowers-zh`（整体） | `tdd`+`diagnosing-bugs`+`grill-me`/`grill-with-docs`+... | A+B+C | **高** | **撤**（Lane B） | bootstrap 强制冲突（无修正） |
| `tdd-guide` agent | `tdd` skill | A+B | 中 | **撤**（Lane B） | 接受损失：eval-driven TDD 增补（v1.8）/ 80% 覆盖率硬约束 / mocking 实操细节 |
| `spec-miner` agent | `domain-modeling` + `to-spec` | **B**（仅） | **低** | **保留**（Lane B）⚠️ | **Lane 1 修正**：omo 两 skill 方向正交——domain-modeling 是术语/ADR 沉淀，to-spec 是正向对话合成，spec-miner 是 brownfield 反向提取。**omo 不覆盖** |
| `code-reviewer` agent | `code-review` skill | A+B | 中 | **撤**（Lane B） | 接受损失：severity → verdict 链路（approve/warn/block）；omo 输出是 narrative 不是 verdict |
| `explore` agent | `wayfinder` skill | **无冲突** | **—** | **保留**（Lane B）⚠️ | **Lane 1 修正**：explore 是只读文件搜索（quick/medium/very thorough 三档），wayfinder 是多会话决策票规划——**完全正交** |
| `silent-failure-hunter` agent | `diagnosing-bugs` skill | A | 低 | **保留**（两 lane） | 静默失败 vs 用户可见 bug，目标不同 |
| `build-error-resolver` agent | `diagnosing-bugs` skill | A | 低 | **保留**（两 lane） | "构建错误最小 diff" 是独立纪律 |
| `pi-simplify` extension | `code-review` skill | A+B | 中 | **撤**（Lane B） | `/simplify` 由 omo `code-review` 接管 |
| `pi-plan-mode` extension | `grill-with-docs` / `grill-me` / `wayfinder` | **仅 A** ⚠️ | 低 | **保留**（两 lane） | **Lane 1 修正**：plan-mode 是结构层（屏蔽写工具），不进入对话流程——**C 类流程覆盖其实不存在** |
| `agent-evaluator` / `harness-optimizer` / `security-reviewer` agent | 无 | 无 | — | **保留**（两 lane） | matt 不覆盖 |
| `write-guard.ts` extension | （omo `git-guardrails-claude-code` 走 Claude Code hooks，pi 不识别） | B | 低 | **保留 + 修**（两 lane） | §4.7 修复 caller 维度（散落两处已合并到 §3B.7） |
| 10 个外部 npm 扩展（除 superpowers-zh / pi-simplify / pi-plan-mode / write-guard.ts） | 无直接对应 | 无 | — | **保留**（两 lane） | 互补层 |

### 2.3 关键判断

**A. `superpowers-zh` 怎么处理？**

`superpowers-zh` 包体里有一个 `using-superpowers` bootstrap skill，**强制 model 每次回应前先检查 skills 列表**。omo-skills 的 on-demand 触发模型没有这个 bootstrap。

如果 **同时装**：
- model 每次回应前要走两次 skill 列表检查
- 同一类问题可能被 `superpowers` 的 `brainstorming` 和 omo `grill-me` 两个 description 同时匹配
- 跨包 trigger 重叠是**不可调和的**——必须二选一

**结论**：**Lane B 撤 `superpowers-zh`**（同时撤 `superpowers` 备份），把 brainstorming / TDD / debugging 全部让给 omo-skills。Lane A 保留。

**B. agent 体系 vs skill 体系——撤哪些？（**修正版 · Lane 1**）**

agent 在 pi 里有 3 个 omo-skills 不具备的**结构性优势**：
1. 独立上下文：agent 跑在 sub-session 里，主对话不污染
2. 独立 model：可指定更便宜的模型（如 deepseek-v4-flash）
3. 独立 max_turns / color / 工具集

但也有 3 个劣势：
1. agent 走 `prompt_mode: replace`，直接替换主 prompt，**对 superpowers 的 bootstrap 不友好**（Lane B 撤 superpowers-zh 后这个劣势消失）
2. agent description 是声明式，model 在主对话里看不到 agent 细节
3. 9 个 agent 的 description 加起来 ≈ 1.5K token，启动即占用

**Lane B 撤 2 个 agent**（**不是 4 个**）：
- `tdd-guide` —— omo `tdd` 覆盖（接受 eval-driven TDD 增补 / 80% 覆盖率硬约束 / mocking 实操损失）
- `code-reviewer` —— omo `code-review` 覆盖（接受 severity → verdict 链路损失）

**Lane B 保留 7 个 agent**（**包括 `spec-miner` / `explore`**，**Lane 1 修正**）：
- `silent-failure-hunter` / `build-error-resolver`（独立上下文 + 纵深职责）
- `agent-evaluator` / `harness-optimizer` / `security-reviewer`（omo-skills 不覆盖）
- `spec-miner`（omo 不覆盖 brownfield 反向提取，**§2.2 表中已加 ⚠️**）
- `explore`（omo `wayfinder` 与之正交，**§2.2 表中已加 ⚠️**）

**Lane A 全保留 9 个 agent**。

**C. extension 基础设施要动哪些？**

- `superpowers-zh` → **Lane B 撤** / Lane A 保留
- `pi-simplify` → **Lane B 撤** / Lane A 保留
- `pi-plan-mode` → **两 lane 保留**（结构层职责 omo-skills 替代不了）
- 其余 10 个 npm 包 + 3 个内置 + `write-guard.ts` → **两 lane 保留**
- `extensions/git-guard.ts` → **Lane B 新增**（替代 omo-skills `git-guardrails-claude-code`，详见 §3B.7）
- `extensions/write-guard.ts` description → **两 lane 修复**（caller 维度判定）
- `extensions/migrate-skill-lock.ts` → **Lane B 新增**（详见 §4.4）

**D. omo-skills 的 `git-guardrails-claude-code` 在 pi 里的状态**

omo-skills 的 `git-guardrails-claude-code` 用 Claude Code hooks JSON 格式。**pi 不识别**——必须重写为 pi extension 风格（`pi.on("tool_call", ...)`）。

**结论**：
- omo-skills 这个 skill **不能直接装**（skill 内容是 Claude Code 格式）
- 在 pi 里**重写**为 pi extension（参考本仓 `write-guard.ts` 风格）
- 重写后职责：本仓 `write-guard.ts` 守住"写路径"，新写 `extensions/git-guard.ts` 守住"git 子命令"


---

## 3A. Lane A 实施详细（纯 extension · 改动 0）

**核心**：保持现状，不引入 omo-skills 装载源。omo-skills 25 skill 仅作参考文档保留（未来如需装可走 Lane B）。

### 3A.1 settings.json 由 AGENTS.md 决策树选择（superpowers 由用户决定）

按 [AGENTS.md §3 决策树](../AGENTS.md#3-安装步骤始终执行)，**Lane A 内部 superpowers 还有 3 种选择**——对应 [presets/](../presets/) 目录 3 个模板：

| 模板 | superpowers 源 | PKGS 项数 | 适用 |
|---|---|---|---|
| [`settings.lane-a.zh.json`](../presets/settings.lane-a.zh.json) | `npm:superpowers-zh@latest` | 14 | 中文工作流（决策 9 历史默认） |
| [`settings.lane-a.en.json`](../presets/settings.lane-a.en.json) | `git:github.com/obra/superpowers` | 14 | 英文原版 superpowers |
| [`settings.lane-a.bare.json`](../presets/settings.lane-a.bare.json) | （无） | 13 | 不装 superpowers（用户自己后续装） |

**Agent 安装步骤**（详见 [INSTALL.md §3](../INSTALL.md#3-cp-用户选的-settings-模板)）：

```bash
cp presets/settings.lane-a.zh.json ~/.pi/agent/settings.json
# 或 en / bare
```

**PKGS 数组三选一**：

**zh 模板（14 项）**：
```bash
PKGS=(
  "npm:pi-context-view"
  "npm:pi-system-prompt"
  "npm:pi-context-breakup"
  "npm:superpowers-zh@latest"   # 决策 9：中文增强版
  "git:github.com/nosuiyi/codegraph-pi"
  "git:github.com/code-yeongyu/pi-lsp-client"
  "npm:@upstash/context7-pi@latest"
  "npm:@tintinweb/pi-tasks@latest"
  "npm:@tintinweb/pi-subagents@latest"
  "npm:pi-web-access@latest"
  "npm:pi-mcp-extension@latest"
  "npm:@mrclrchtr/supi-claude-md@latest"
  "npm:pi-simplify@latest"
  "npm:pi-plan-mode@latest"
)
```

**en 模板（14 项）**：`superpowers-zh@latest` → `git:github.com/obra/superpowers`

**bare 模板（13 项）**：删 superpowers 行

**不增 `git:github.com/meisijiya/omo-skills`**——omo-skills 不进 Lane A 的 `settings.json` packages。

### 3A.2 agents/ 不变（9 个）

9 个 subagent **全保留**：`agent-evaluator` / `build-error-resolver` / `code-reviewer` / `explore` / `harness-optimizer` / `security-reviewer` / `silent-failure-hunter` / `spec-miner` / `tdd-guide`。

### 3A.3 settings.json 不变

保持当前 14 项 packages 数组 + 3 项 extensions。`extensions` 与 `packages` 字段有 3 项重叠（`pi-system-prompt` / `pi-context-view` / `pi-context-breakup`）——这是 pi 的合法模式（`extensions` 控制加载，`packages` 控制 trust 声明）。

### 3A.4 README.md 验证清单（**小幅调整**）

- **不加** omo-skills 装载小节
- **不加** `/skill:code-review` `/skill:grill-me` 等新触发语
- `/simplify` 仍可用
- 加一行参考："omo-skills 集成方案（未实施）见 [docs/omo-skills-integration.md §3B](docs/omo-skills-integration.md#3b-lane-b-实施详细部分-extension--matt-skill-微调)"

### 3A.5 适用范围

- 用户偏好"agent 独立上下文"——9 个 subagent 各跑独立 sub-session，主对话不污染
- 用户不想引入 skill 体系——on-demand prompt 协议增加 prompt 体积
- 用户按 [AGENTS.md §3 决策树](../AGENTS.md#3-安装步骤始终执行) 选择 superpowers 版本——可能用 `superpowers-zh` 的 `using-superpowers` bootstrap 强约束（中文版）/ `obra/superpowers` 英文原版 / 不装
- 用户保留 `pi-simplify` 的 `/simplify` 单命令习惯

### 3A.6 回滚到 Lane B 的成本

如果未来想从 Lane A 切到 Lane B：跑 Lane B 的 `install-packages.sh` + 删 2 agent + 加 git-guard.ts + 修 write-guard.ts 即可。**回滚成本 = Lane B 实施成本**。

---

## 3B. Lane B 实施详细（部分 extension + matt skill 微调 · 改动 9 项）

**核心**：撤冲突最严重的项（`superpowers-zh` bootstrap / `pi-simplify` / 2 个 agent），引入 omo-skills 25 skill（带 description 守卫降低撞车风险），新增 `git-guard.ts` 替代 omo-skills 的 `git-guardrails-claude-code`，新增 `migrate-skill-lock.ts` 同步 lock 文件。

### 3B.1 install-packages.sh 变更（14 → 13 项：删 2 加 1）

**保留（13 项 = 3 内置 + 9 外部 npm + 3 git）**：

```bash
PKGS=(
  # 3 个内置 extension（保留）
  "npm:pi-context-view"
  "npm:pi-system-prompt"
  "npm:pi-context-breakup"

  # 9 个外部 extension（保留）
  "git:github.com/nosuiyi/codegraph-pi"
  "git:github.com/code-yeongyu/pi-lsp-client"
  "npm:@upstash/context7-pi@latest"
  "npm:@tintinweb/pi-tasks@latest"
  "npm:@tintinweb/pi-subagents@latest"
  "npm:pi-web-access@latest"
  "npm:pi-mcp-extension@latest"
  "npm:@mrclrchtr/supi-claude-md@latest"
  "npm:pi-plan-mode@latest"   # 保留：结构层职责 omo-skills 不覆盖

  # omo-skills 装载源（新增）
  "git:github.com/meisijiya/omo-skills"
)
```

**移除（2 个）**：

- `npm:superpowers-zh@latest` —— omo-skills 覆盖（using-superpowers bootstrap 强制冲突）
- `npm:pi-simplify@latest` —— omo `code-review` 覆盖（`/simplify` → `/skill:code-review`）

**数量核对**：14 - 2 + 1 = **13 项**。✓（Lane 2 已 JSON 语法验证通过）

### 3B.2 agents/ 变更（9 → 7 个 · **Lane 1 修正**）

**撤（2 个 · 不是 4 个）**：

- `agents/tdd-guide.md` —— omo `tdd` 覆盖
- `agents/code-reviewer.md` —— omo `code-review` 覆盖

**保留（7 个）**：

- `agent-evaluator` / `build-error-resolver` / `harness-optimizer` / `security-reviewer` / `silent-failure-hunter` / `spec-miner` / `explore`

> **Lane 1 修正记录**：原调研稿"撤 4 个 agent（tdd-guide / spec-miner / code-reviewer / explore）"中，`spec-miner` / `explore` 撤判理由错误（§2.2 已说明）——这两个 agent 的能力 omo-skills 不覆盖，**Lane B 保留**。

### 3B.3 settings.json 草案（Lane 2 JSON 验证通过）

```jsonc
{
  "extensions": [
    // 加载列表（与 packages 字段有 3 项重叠，重复声明无害）
    "pi-system-prompt",
    "pi-context-view",
    "pi-context-breakup"
  ],
  "packages": [
    // trust 声明列表
    "npm:pi-context-view",
    "npm:pi-system-prompt",
    "npm:pi-context-breakup",

    "git:github.com/nosuiyi/codegraph-pi",
    "git:github.com/code-yeongyu/pi-lsp-client",
    "npm:@upstash/context7-pi@latest",
    "npm:@tintinweb/pi-tasks@latest",
    "npm:@tintinweb/pi-subagents@latest",
    "npm:pi-web-access@latest",
    "npm:pi-mcp-extension@latest",
    "npm:@mrclrchtr/supi-claude-md@latest",
    "npm:pi-plan-mode@latest",

    "git:github.com/meisijiya/omo-skills"
  ],
  "trust": true
}
```

> **Lane 2 注释补全**：`extensions` 是加载列表（运行时引用），`packages` 是 trust 声明（安装时校验签名）。二者可重叠——重复声明无害。

### 3B.4 deploy.sh 变更

- §3 部署配置段保留 `agents/` 目录的 `for` 循环（自动只拷贝剩余 7 个）
- §4 PKGS 数组按 §3B.1 列表更新（14 → 13 项：删 2 加 1）
- §6 下一步提示更新验证清单（移除 `/simplify`，加 `/skill:code-review` 等）

### 3B.5 README.md 变更（**算术 bug 修正 · Lane 2**）

**修正版**：

- 顶部扩展表"方法论"行：`superpowers-zh` → `omo-skills`（"25 个 skill 装载源，详见 [决策 10](docs/decisions.md#决策-10omo-skills-集成方案-b-lane-b)"）
- **核心数字**："合计 11 个外部扩展包 + 3 个内置 = 14" → **"合计 9 个外部扩展包 + 1 个 skill 源 + 3 个内置 = 13 个"**（**Lane 2 修正算术 bug**：9+1+3 = 13 ✓，原 10+1+3 = 14 ✗）
- 验证清单：slash commands 部分移除 `/simplify`；新增 `/skill:code-review` / `/skill:grill-me` 等触发语说明
- 加一节"omo-skills 装载"：cp -r 命令（INSTALL.md §5 pi 章节）+ `/skill:setup-matt-pocock-skills` 必跑提示

### 3B.6 docs/decisions.md 变更

新增"决策 10：omo-skills 集成方案 B（Lane B）"——指向本文档 §3B。

### 3B.7 extensions/ 变更（write-guard 修复 + git-guard 新增 + migrate-skill-lock 新增）

#### 3B.7.1 write-guard.ts description 修复（**两 lane 都修 · Lane 1+2+3 整合**）

**新 description**：

> write-guard：白名单 `openspec/specs/<capability>/spec.md` 写路径。仅当 caller 自报 context `caller_type=spec-author`（如 `spec-miner` / omo `domain-modeling` / `to-spec` 调用）才硬拦截；其他 caller 仅警告放行——兜底防 prompt injection 越权写。

**caller 判定伪代码**（Lane 3 提供）：

```typescript
const caller = ctx.callerAgentName ?? event.caller?.name ?? "main";
const STRICT_AGENTS = new Set(["spec-miner", "domain-modeling", "to-spec"]);
function classify(caller: string): "strict" | "loose" | "main" {
  if (caller === "main" || caller == null) return "main";        // 主对话：完全放行
  if (STRICT_AGENTS.has(caller)) return "strict";                // 强约束白名单
  return "loose";                                                // 其他 agent：宽松
}
// main → undefined（不拦截）
// strict → isPathAllowed 旧逻辑（白名单才放行）
// loose → 仅禁绝对路径 + `..` 逃逸
```

> **Lane 3 备注**：`ctx.callerAgentName` 是 pi ExtensionAPI 的假设字段，实施前需查 `ExtensionAPI` 类型定义确认是否暴露 `caller`；若无，可在 `pi-subagents` 调用 subagent 时通过 `pi.context.set("write-guard:strict", true)` 自声明。

#### 3B.7.2 git-guard.ts 新增（**仅 Lane B · Lane 2 骨架**）

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const FORBIDDEN: RegExp[] = [
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+push\s+(--force|-f)\b/,
  /\bgit\s+clean\s+-f[fd]\b/,
  /\bgit\s+checkout\s+\.\s*$/,
  /\bgit\s+branch\s+-D\s+main\b/,
];

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;
    const cmd: string = String(event.input.command ?? "");
    for (const pat of FORBIDDEN) {
      if (pat.test(cmd)) {
        const reason = `git-guard blocked: "${cmd.slice(0, 80)}..." matches ${pat}`;
        if (ctx.hasUI) ctx.ui.notify(reason, "error");
        return { block: true, reason };
      }
    }
    return undefined;
  });
}
```

**已知绕过**（Lane 3 明列 · README 必须同步）：

```bash
bash -c "git reset --hard HEAD~5"             # 字符串嵌入
git --exec-path=/tmp reset --hard              # 长选项拆分
git\ reset\ --hard                             # 反斜杠转义
GIT_PAGER=cat git -c alias.dh='reset --hard' dh   # alias 链
```

#### 3B.7.3 migrate-skill-lock.ts 新增（**仅 Lane B · Lane 3 反馈**）

部署时跑：扫 `~/.agents/.skill-lock.json`，把被 omo `cp -r` 覆盖的 skill（`handoff` 等）的 lock 条目**更新 hash** 为新 omo 版本（不删除条目——保留来源信息）。

```typescript
// 简化伪代码（约 30 行）
import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";
import { execSync } from "child_process";

const LOCK = join(process.env.HOME!, ".agents/.skill-lock.json");
const OVERRIDDEN = ["handoff"]; // omo 装载后会被覆盖的 skill

const lock = JSON.parse(readFileSync(LOCK, "utf-8"));
for (const skill of OVERRIDDEN) {
  if (lock.skills[skill]) {
    const dir = join(process.env.HOME!, ".agents/skills", skill, "SKILL.md");
    if (existsSync(dir)) {
      const hash = createHash("sha256").update(readFileSync(dir)).digest("hex").slice(0, 16);
      lock.skills[skill].skillFolderHash = hash;
      lock.skills[skill].source = "meisijiya/omo-skills";
      lock.skills[skill].sourceUrl = "https://github.com/meisijiya/omo-skills.git";
    }
  }
}
writeFileSync(LOCK, JSON.stringify(lock, null, 2));
```

### 3B.8 触发习惯变化

| 触发 | Lane A | Lane B |
|---|---|---|
| `/simplify` 审 diff | ✅ 仍可用 | ❌ 改为 `/skill:code-review` |
| `help me plan X` | superpowers `brainstorming` 自动 | omo `grill-me` / `grill-with-docs` 需 `/skill:xxx` |
| `find bugs in X` | superpowers `debugging-and-error-recovery` 自动 | omo `diagnosing-bugs` model 自动（user 不显式触发） |
| `review this diff` | `pi-simplify` `/simplify` | `/skill:code-review` 或 `code-review this diff` |
| `write tests for X` | superpowers `test-driven-development` 自动 | omo `tdd` model 自动 |

**变化总结**：Lane B 的 skill 多数仍是 model-invoked（自动触发），但 `/simplify` 这种 slash 命令需要换名字。


---

## 4. 风险与未决问题（共享主体 · 按 lane 标注影响）

| 节 | 风险主题 | Lane A 影响 | Lane B 影响 |
|---|---|---|---|
| 4.1 | `setup-matt-pocock-skills` 强依赖 | 不受影响 | **必加 smoke test 强制 init** |
| 4.2 | superpowers bootstrap 与 omo-skills 共存 | 不受影响（保留 superpowers-zh） | 必撤 |
| 4.3 | git-guard 重写漏拦截 | 不受影响 | 新增 git-guard.ts，需明列已知绕过 |
| 4.4 | `.skill-lock.json` 孤儿记录 | 保留 mattpocock/skills 来源 | 必跑 migrate-skill-lock.ts 同步 |
| 4.5 | description 守卫降低 trigger 撞车 | 不受影响 | 受益 |
| 4.6 | tdd-guide eval-driven TDD addendum | 不受影响（保留 agent） | 必归档 `docs/archive/tdd-guide-eval-addendum-v1.8.md` |
| 4.7 | write-guard 误拦截 | 必修（实测已发现） | 必修 |
| 4.8 | skill 触发方式转换 | 不受影响（保留 superpowers-zh） | 有体感影响但缓解简单 |
| 4.9 | deploy.sh 同步覆盖 | 共担 | 共担 |
| 4.10 | 决策 9 回退路径 | 不受影响 | 必更新为"演进 → 决策 10" |

### 4.1 `setup-matt-pocock-skills` 强依赖（**仅 Lane B**）

omo 的 `/setup-matt-pocock-skills` 会问三件事：
1. issue tracker（GitHub / Linear / local）
2. triage labels
3. 文档保存位置

如果用户**没跑过这个 init**，omo 的 `triage` / `to-tickets` / `to-spec` / `improve-codebase-architecture` 四个 user-invoked skill **前置空跑不会触发任何报错**——model 第一次见触发语才会问问题，体验是 model 反复问你。

**风险**：用户装 Lane B 但忘跑 init，会觉得 omo-skills 不好用。
**Lane 3 缓解强化**：smoke test 必跑 `/skill:setup-matt-pocock-skills` 强制 init；install-packages.sh 末尾增加 `--check-setup` 钩子扫 `~/.pi/agent/skills/setup-matt-pocock-skills/SKILL.md` 之外是否已生成 init 产物，否则红字提示并 exit 1。

### 4.2 superpowers bootstrap 与 omo-skills 共存（**仅 Lane B 撤**）

**完全不能共存。Lane B 撤 superpowers-zh。**

omo-skills 的 description 守卫**不消除** bootstrap 冲突——bootstrap 强制 model 扫两套 skills 列表，token 浪费 + trigger 撞车。

### 4.3 `git-guardrails-claude-code` pi 重写 + 已知绕过（**仅 Lane B**）

omo-skills 的 `git-guardrails-claude-code` 用 Claude Code hooks JSON 格式。**pi 不识别**——必须重写为 pi extension 风格（`pi.on("tool_call", ...)`）。

**重写后拦截范围比 omo 原始版本窄**（pi 的 `tool_call` 事件不递归 shell 解析）：

```bash
bash -c "git reset --hard HEAD~5"             # 字符串嵌入
git --exec-path=/tmp reset --hard              # 长选项拆分
git\ reset\ --hard                             # 反斜杠转义
GIT_PAGER=cat git -c alias.dh='reset --hard' dh   # alias 链
```

**Lane 3 缓解建议**：
1. 在 README "已知绕过" 段明列以上 4 种绕过
2. 检测 `--exec-path` / `-c alias.*` 类转义
3. 对 `bash -c "..."` / `sh -c "..."` / `eval "..."` 子 shell 做一次递归 re-parse
4. **避免给用户安全错觉**——明示"此扩展是 best-effort 拦截，复杂 shell 绕过不在覆盖范围"

### 4.4 `.skill-lock.json` 孤儿记录（**两 Lane 共担 · Lane 3 修正**）

omo-skills 仓库**没有 npm 发布**，走 `git:github.com/...` 源（与决策 1 一致）。

**Lane 3 关键发现**：用户机器 `~/.agents/.skill-lock.json` 实际有 **63 条 lock 记录**（非 v1 调研稿写的 49），来源分布：
- 47 条 `meisijiya/skills`
- 1 条 `mattpocock/skills`（含 `handoff`）
- 4 条 `anthropics/skills`
- 3 条 `stablyai/orca`
- 8 条 misc

**冲突场景**：omo-skills `cp -r skills/productivity/handoff` 会**覆盖** `~/.pi/agent/skills/handoff` 目录，但 **lock 文件不会被改写**——会出现"磁盘是 omo 版本，lock 仍记 mattpocock/skills + hash `184d485a...`"的孤儿记录，未来 `npx skills@latest update` 会以 lock 为准回滚到 matt 版本。

**Lane B 缓解**：必跑 §3B.7.3 `migrate-skill-lock.ts`：
1. 扫 lock 中所有条目
2. 对被 omo `cp -r` 覆盖的 skill（至少 `handoff`），重新计算目录 hash 并更新
3. 把 `source` 从 `mattpocock/skills` 改为 `meisijiya/omo-skills`
4. 部署时跑一次（幂等）

### 4.5 description 守卫降低 trigger 撞车（**仅 Lane B**）

omo-skills 的 14 个 description 守卫主动避免与 omo 内置 skill 撞车，**间接也减少与本仓库 superpowers-zh 英文子集冲突**。

受益 skill（已加守卫）：
- `tdd` —— "Test-driven development..." 守卫
- `code-review` —— "Review code changes..." 守卫
- `domain-modeling` —— "Identify domain entities..." 守卫

**但 bootstrap 冲突不消除**——必须撤 superpowers-zh。

### 4.6 tdd-guide eval-driven TDD addendum 去向（**仅 Lane B 撤**）

agent-evaluator v1.8 增补里加了 eval-driven TDD 内容（`tdd-guide.md:98-106`）。omo-skills `tdd` skill 里**没有**这个概念。Lane B 移除 `tdd-guide` agent 后，这段内容**会丢失**。

**Lane 3 建议**：**强烈归档到 `docs/archive/tdd-guide-eval-addendum-v1.8.md`**，理由：
1. 段内容在 v1.8 是边角实验（pass@1/pass@3）非核心 TDD 流程
2. 搬到 `agent-evaluator.md` 末尾会污染其 5 轴评分结构（agent-evaluator 主轴是 Accuracy/Completeness/Clarity/Actionability/Conciseness，加 TDD addendum 跨界）
3. 未来如需复活 eval-driven 概念可直接从 archive 引用，避免散落多处不一致

### 4.7 write-guard 误拦截（**两 Lane 共担 · Lane 1+2+3 整合**）

`write-guard.ts` 当前 description 假设 `spec-miner` 在用，但实际上**无差别拦截所有 write 调用**（本次设计阶段实测已发现——尝试用 `write` 工具写 `docs/omo-skills-integration.md` 被拦截）。

**Lane 1+2+3 整合修复**：
- 新 description：见 §3B.7.1
- caller 判定伪代码：见 §3B.7.1
- 在 `isPathAllowed` 前增加 `if (caller.classify() === "main") return undefined` 分支——避免对日常 write 操作误拦截

**两 Lane 都必做此修复**——Lane B 即使撤 spec-miner，主对话 write 仍会被拦截；Lane A 即使保留 spec-miner，撤 spec-miner 的版本也会被拦截。

### 4.8 skill 触发方式转换（**仅 Lane B · Lane 3 关键修正**）

**Lane 3 关键事实修正**：用户机器**实际只有 9 个 SKILL.md 文件**，其余 54 条 lock 是幽灵（已删但 lock 未清理）。其中**没有任何 superpowers-zh 来源条目**——lock 源分布 47/63 是 meisijiya/skills。

所以 §v1 调研稿"brainstorming 等来自 superpowers-zh 撤除后消失"是**理论风险非实际风险**——这些 skill 现在已经不在磁盘上。

**但触发方式转换确实有体感影响**：
- superpowers 的 `brainstorming` 是 model-invoked（任何"我想做 X"都会自动触发），omo 的 `grill-me` / `grill-with-docs` 是 user-invoked（用户必须主动 `/skill:xxx`）
- 日常体验差别：以前 model 会自动进入"反问-对齐-再问"循环；现在用户必须显式触发

**缓解**：
1. 在 `~/.pi/agent/AGENTS.md` 顶部写一条 user hint："如需对齐需求请主动 `/skill:grill-me`"
2. 不需要担心触发密度下降——user-invoked 更可控，反而降低误触发

### 4.9 deploy.sh 同步覆盖风险（**两 lane 共担**）

`deploy.sh` §3 当前对 `~/.pi/agent/extensions/` 用 `for f in "$REPO_ROOT"/extensions/*.ts` 覆盖式拷贝。

**风险**：实施后第一次跑 deploy.sh 时，新文件（`git-guard.ts` / `migrate-skill-lock.ts`）会被拷贝到 `~/.pi/agent/extensions/`，**但 pi 不自动重启**——下次启动 pi 才生效。这与现有 deploy.sh 行为一致，无新增风险。

### 4.10 决策 9（superpowers-zh）回退路径（**仅 Lane B 撤**）

决策 9 写了中文 / 英文切换命令。Lane B 撤 superpowers-zh 后，决策 9 的"切换命令"段落失效**——需更新或归档**。

**方案**：决策 9 标注为"已演进——见决策 10"，正文保留为历史快照。

---

## 5. 复审指令

### 5.1 持怀疑态度复审（两 Lane 共审）

请用户审查本文档：

1. §0 第 3 点 **Lane B 撤 agent 数从 4 → 2 的修正**（Lane 1 关键发现），你认可吗？
2. §3A 与 §3B 二选一执行——你倾向哪个？还是有第三种组合？
3. §4.4 migrate-skill-lock.ts 是否值得新增（约 30 行）？
4. §4.7 write-guard 修复是否同意两 Lane 都做（避免日常 write 误拦截）？

### 5.2 Lane B install smoke test（**仅 Lane B 必跑**）

```bash
# 1. 临时在测试目录装载 omo-skills 25 个 skill，不动主 settings.json
mkdir -p ~/.pi-test/agent/skills
cd /path/to/omo-skills   # 假设 omo-skills 已 git clone

# engineering 18 个（含 5 个备选）
for s in \
  ask-matt code-review codebase-design diagnosing-bugs \
  domain-modeling grill-with-docs implement \
  improve-codebase-architecture prototype research \
  resolving-merge-conflicts setup-matt-pocock-skills tdd \
  to-spec to-tickets triage wayfinder wizard; do
  cp -r skills/engineering/$s ~/.pi-test/agent/skills/
done

# productivity 7 个（含 handoff）
for s in \
  grill-me grilling handoff teach to-questionnaire \
  wait-what writing-for-agents; do
  cp -r skills/productivity/$s ~/.pi-test/agent/skills/
done

# 2. 强制 init（Lane 3 必加项）
PI_HOME=~/.pi-test pi
> /skill:setup-matt-pocock-skills    # ← **必跑**
# 按提示完成：issue tracker / triage labels / 文档保存位置

# 3. 验证 skill 列表（应见 25 个新 skill）
> /skills

# 4. 触发关键 skill 测试：
> help me plan this feature    # grill-me / grill-with-docs
> find issues in this auth code # diagnosing-bugs
> review this diff             # code-review（**注意**：原 /simplify 已撤）
> walk me through the design of this system  # domain-modeling
> write tests for this function # tdd

# 5. git-guard.ts 测试：
> bash: git reset --hard HEAD~3   # 应被拦截
> bash: git push origin main      # 应放行（非 --force）
> bash: bash -c "git reset --hard"  # ⚠️ 已知绕过（README 必须明列）

# 6. write-guard.ts 测试：
> write: docs/foo.md              # 主对话写应放行（caller.classify() === "main"）
> spec-miner: write: openspec/specs/auth/spec.md  # 应放行（白名单命中）

# 7. 验证通过后，正式修改 settings.json / install-packages.sh / agents/
```

### 5.3 Lane A 验证清单（**仅 Lane A**）

```bash
pi list   # 14 个
> /skills  # 无变化
> /simplify  # 仍可用
> how does auth.ts work   # 触发 codegraph / explore
```

### 5.4 用户日常工程流验证（两 Lane 共做）

跑完 smoke test 后，请用户回答：

1. **主对话 trigger description 是否够丰富**？Lane B 撤 2 agent + superpowers-zh 后，model 还会不会"自动想到"做 spec-mining / code-review / explore？
2. **`git-guard.ts` 的拦截范围**？测试几条危险命令，确认拦截行为符合预期；README "已知绕过" 段是否需要补充？
3. **`/simplify` 触发习惯**？Lane B 撤 `pi-simplify` 后，原 `/simplify` 调用需要改成 `/skill:code-review`——是否接受？
4. **write-guard.ts 配套**？两 Lane 都修 write-guard 后，日常 write 是否仍被拦截？

---

## 6. 附录 omo-skills 25 skill 清单（仅 Lane B 引用）

按 bucket 分组（与 §1.2 同）：

**Engineering（18 个）**：
- grill-with-docs · domain-modeling · codebase-design · tdd
- improve-codebase-architecture · to-spec · to-tickets · triage
- wayfinder · implement · resolving-merge-conflicts · wizard
- prototype · setup-matt-pocock-skills · ask-matt · diagnosing-bugs
- code-review · research

**Productivity（7 个）**：
- grill-me · grilling · teach · to-questionnaire · wait-what · writing-for-agents · handoff

**触发方式分类**：

- **User-invoked**（用户手动 `/skill:name` 或触发语，14 个）：grill-me · grill-with-docs · triage · improve-codebase-architecture · setup-matt-pocock-skills · to-spec · to-tickets · implement · wayfinder · prototype · handoff · ask-matt · teach · to-questionnaire
- **Model-invoked**（model 自动触发，11 个）：diagnosing-bugs · tdd · domain-modeling · codebase-design · code-review · resolving-merge-conflicts · wizard · research · grilling · wait-what · writing-for-agents

**装机默认**：25 个全装入 `~/.pi/agent/skills/`（INSTALL.md §5 pi 章节明示）。

---

## 7. 升级说明（共享）

升级自 `docs/mattpocock-skills-integration-survey.md`（v1.2 调研稿，**未提交**），主要变更：

1. **源选**：mattpocock/skills 原版 → **omo-skills 适配版**（25 skill，14 description 守卫）
2. **装载方式**：`npx skills@latest add` → INSTALL.md §5 pi 章节的 `cp -r` 循环
3. **状态**：调研稿 → **最终设计（双路线版 · Lane A + Lane B）**
4. **反馈整合**：3 lane 复审（冲突评级 / 实施细节 / 风险与重构）
5. **关键修正**：
   - §2.2 表：**撤 4 agent → 撤 2 agent**（`spec-miner` / `explore` 保留——omo 对应 skill 与这两 agent 方向正交）
   - §3.5 README：算术 bug（10+1+3=14 说=13）→ **9+1+3=13**
   - §4.4：`.skill-lock.json` 49 条 → 实际 **63 条**；新增 `extensions/migrate-skill-lock.ts`
   - §4.8：理论风险 → 实际 **9 个 SKILL.md**（54 lock 是幽灵）
   - §4.7 + §3B.7.1：write-guard 修复散落两处 → 合并给 caller 判定伪代码 + description 修改文案（两 lane 都修）
   - §3B.7.2：git-guard.ts 给出 **38 行最小骨架**（Lane 2）
   - §4.3 + §3B.7.2：**明列 4 种已知绕过**（README 同步）
6. **双路线结构**：§3A Lane A / §3B Lane B；§4 共享主体按 lane 标注影响；§5 拆 §5A Lane A 验证 / §5B Lane B smoke test
7. **措辞统一**：用"**微调**"替代"全替换"——所有 25 个 skill 走"覆盖/接替"语义而非"替换"
8. **保留**：§2.1 / §2.3 A / §4.2 / §4.5 / §4.9 等分析骨架——仅事实层微调
