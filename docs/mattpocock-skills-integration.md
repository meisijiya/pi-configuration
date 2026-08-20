# mattpocock/skills 官方版集成最终设计(双路线版 · Lane A & Lane B)

> **状态:** 最终设计(Design),经 3 lane 独立复审整合后定稿。
> **来源:** 升级自 `docs/omo-skills-integration.md`(v1 仓库旧版,omo-skills fork 时代,已归档于 git history)。
> **装载源切换:** `git:github.com/meisijiya/omo-skills`(v1)→ **`git:github.com/mattpocock/skills`**(v2,官方版)。
> **升级日期:** 2026-08-20。

---

## 0. TL;DR(双路线版)

1. **pi 通过 packages filter 装载 mattpocock/skills 官方版**——装载源 = `git:github.com/mattpocock/skills`(default branch HEAD);装载机制 = settings.json `packages` 数组的 object-form 项,用 `skills: ["skills/engineering/*", "skills/productivity/*"]` 显式 filter。跳过 `misc/`(`git-guardrails-claude-code` skill,pi 不识别 Claude Code hooks)与 `in-progress/`(matt README 明示不稳定)。pi 通过 SKILL.md 递归发现,**无需 cp -r**(见 [pi packages.md §Package Filtering](https://pi.dev/docs/packages#package-filtering))。

2. **双路线配置**——本文档 §3A 与 §3B **二选一执行**:

   | Lane | 性质 | 改动 | 适合 |
   |---|---|---|---|
   | **§3A Lane A** 纯 extension | 不装 skill 体系 | **0** | 用户偏好"agent 独立上下文" / 不想引入 skill 体系 / 已用熟 superpowers-zh |
   | **§3B Lane B** 部分 extension + matt skill 官方版 | 撤 2 agent + 撤 2 npm + 加 1 git 源 + 加 1 自写 ext | **9 项** | 用户接受 skill 触发模式 + 用 description 守卫降低撞车风险 |

3. **§2.2 关键修正**(来自 Lane 1 复审,沿用 v1):
   - ❌ v1 调研稿"撤 4 个 agent"基于"omo 完全覆盖"理由,对 `spec-miner` / `explore` **不成立**——omo 的 `domain-modeling` / `to-spec` 是术语 + 正向合成,不覆盖 brownfield 反向;`wayfinder` 是多会话规划,不覆盖只读文件搜索。**Lane B 实际撤 agent 数 = 2**(仅 `tdd-guide` + `code-reviewer`)。**v2(matt 官方版) 同样撤这 2 个**(理由不变:matt `tdd` / `code-review` skill 接管)。
   - ✅ `superpowers-zh` 必撤(`using-superpowers` bootstrap 与 on-demand 触发模型**强制冲突**)。
   - ✅ `pi-simplify` 撤(`/simplify` 由 matt `code-review` 接管,调用方式 `/simplify` → `/skill:code-review`)。
   - ✅ `pi-plan-mode` 保留(结构层职责 omo/matt 替代不了;**Lane 1 修正**:实际冲突仅 A 类,无 C 类流程覆盖)。

4. **§4 关键风险**(沿用 v1,部分重写):
   - **§4.1 setup-matt-pocock-skills 缓解不足**:smoke test 必跑 `/skill:setup-matt-pocock-skills` 强制 init。
   - **§4.4 matt 全新源,无 v1 lock 历史包袱**;但从 omo 时代迁来的用户 `~/.agents/.skill-lock.json` 可能含 `meisijiya/skills` 域条目,新 `scripts/migrate-skill-lock.ts` 的 OVERRIDDEN 表(25 项)覆盖 25 个 stable skill,其余 omo 时代孤儿(in-progress 等)建议手动 `npx skills@latest update --prune` 或保留。
   - **§4.3 git-guard 漏拦截命令**:`bash -c "git reset --hard"` / `git --exec-path=/tmp reset --hard` / 反斜杠转义 / `git -c alias.dh=... dh` 都会绕过。README 必须明列**已知绕过**。
   - **§4.5 matt 官方版无 description 守卫**(v1 omo 有 14 个守卫降低撞车,D1 决策接受撞车风险↑;如有撞车反馈给 mattpocock/skills 上游)。
   - **§4.7 write-guard 误拦截**:两 lane 都修过(默认放行 + WRITE_GUARD_STRICT=1 才启用白名单)。
5. **§3 实施关键修正**(沿用 v1):
   - **§3.3 settings.json 注释**:`extensions` 是加载列表,`packages` 是 trust 声明,二者可重叠(重复声明无害)。
   - **v1 的"算术 bug"**: `9 个外部扩展包 + 1 个 skill 源 + 3 个内置 = 13 个`(Lane B)。
6. **不可被任何 lane 取代的扩展**(两 lane 共保留):`codegraph-pi` / `pi-lsp-client` / `context7-pi` / `pi-tasks` / `pi-subagents` / `pi-web-access` / `pi-mcp-extension` / `supi-claude-md` / `pi-plan-mode` + 3 个内置(`pi-system-prompt` / `pi-context-view` / `pi-context-breakup`) + 自写 `write-guard.ts`。
7. **不可被任何 lane 取代的 subagent**(两 lane 共保留):`agent-evaluator` / `harness-optimizer` / `security-reviewer` / `build-error-resolver` / `silent-failure-hunter` + **Lane B 还保留** `spec-miner` / `explore`(Lane 1 修正沿用)。

---

## 1. 现状盘点(事实层 · 共享)

### 1.1 本仓库(基线)

**3 个内置 npm 包**(写到 `settings.json` 的 `extensions`):

| 包 | 作用 |
|---|---|
| `pi-system-prompt` | 系统 prompt 增强 |
| `pi-context-view` | 上下文可视化 |
| `pi-context-breakup` | 上下文分段 |

**12 个外部 npm 包 + 1 个 git 装载源 + pi convention 自动发现 matt 仓库 `skills/` 下 25 stable**:

| 包 | 类别 | 作用 |
|---|---|---|
| `superpowers-zh` | 方法论 | 14 翻译 + 6 国内原创 skill;`using-superpowers` bootstrap 强制 model 检查 skills |
| `nosuiyi/codegraph-pi` | 代码理解 | 4 个 tool(explore / node / search / callers) |
| `code-yeongyu/pi-lsp-client` | LSP | 40+ 语言服务器 |
| `@upstash/context7-pi` | 文档 | resolve-library-id + query-docs |
| `@tintinweb/pi-tasks` | 任务 | 7 个 tool 的 DAG 任务系统 |
| `@tintinweb/pi-subagents` | subagent | Claude Code 风格 Task tool |
| `pi-web-access` | 研究 | 20+ 搜索 provider + GitHub 克隆 + YouTube + PDF |
| `pi-mcp-extension` | MCP 桥 | 给 pi 不识别 Claude Code hooks 的 MCP 客户端 |
| `@mrclrchtr/supi-claude-md` | AGENTS.md | 主动维护 CLAUDE.md / AGENTS.md |
| `pi-simplify` | 评审 | `/simplify` 只审 diff |
| `pi-plan-mode` | 流程 | `/plan` toggle,写工具屏蔽 + AI 过滤 bash |
| `mattpocock/skills` | matt 官方版装载源(Lane B;packages filter 限定 25 stable)| 25 个 SKILL.md(engineering 18 + productivity 7)|

**9 个 subagent**(`agents/` 目录,全部有 frontmatter):

| agent | 关键能力 | matt skill 覆盖? |
|---|---|---|
| `agent-evaluator` | 5 轴评分 | 否(matt 无对应) |
| `build-error-resolver` | 构建/TS 错误最小 diff | 部分(matt `diagnosing-bugs`) |
| `code-reviewer` | diff 评审 + 严重度分级 | 是(matt `code-review`)**→ Lane B 撤** |
| `explore` | 只读文件搜索(quick/medium/very thorough 三档) | 否(**Lane 1 修正**:matt `wayfinder` 是多会话规划,正交) |
| `harness-optimizer` | subagent 配置优化 | 否(matt 无对应) |
| `security-reviewer` | OWASP / 凭据扫描 | 否(matt 无对应) |
| `silent-failure-hunter` | 静默失败深审 | 部分(matt `diagnosing-bugs`) |
| `spec-miner` | OpenSpec spec 反向提取 | 否(**Lane 1 修正**:matt `domain-modeling` + `to-spec` 方向正交) |
| `tdd-guide` | 强制 TDD | 是(matt `tdd`)**→ Lane B 撤** |

**2 个自写 extension**:
- `extensions/write-guard.ts`——白名单 `openspec/specs/<capability>/spec.md`,配合 `spec-miner` 防 prompt injection 越权写(**Lane 1 实测发现**:当前 description 无差别拦截所有 write 调用,已修——见 §4.7)
- `extensions/git-guard.ts`——拦截危险 git 命令(`reset --hard` / `push --force` / `clean -fd` / `branch -D` / `checkout .`),替代 matt `misc/git-guardrails-claude-code` skill(因 pi 不识别 Claude Code hooks,详见 §3B.7.2)

**1 个 standalone script**:`scripts/migrate-skill-lock.ts`——同步 `~/.agents/.skill-lock.json`,把 25 个 matt stable skill 的 lock 条目统一指向 `mattpocock/skills` 源。

**配置层 / 部署层**:`settings.json`(声明 extensions + packages + trust)、`mcp.json`(MCP servers)、`tasks-global.json` / `tasks-project.json`(任务系统)、`web-search.json`(搜索 provider)、`deploy.sh` / `install-packages.sh`(幂等部署)、`docs/decisions.md`(决策记录)。

> 注:`presets/settings.lane-b.json` 当前 packages 数组 13 项,其中装载源项是**对象形式**:
> ```jsonc
> {
>   "source": "git:github.com/mattpocock/skills",
>   "skills": ["skills/engineering/*", "skills/productivity/*"]
> }
> ```
> pi 装载时按 convention 递归发现 `skills/` 下的 `SKILL.md` 文件夹(详见 [pi packages.md §Package Structure](https://pi.dev/docs/packages#package-structure)),无需 `cp -r`。

### 1.2 mattpocock/skills 目标层(25 stable skill · Lane B 引用)

matt 官方仓库分 5 桶(README §仓库布局):

**Engineering bucket(18 个)**:

| skill | 能力标签 | 触发方式 | 本仓库对应 |
|---|---|---|---|
| `ask-matt` | 路由(询问哪条 skill 适合) | user | 无对应 |
| `code-review` | 审查(two-axis: Standards + Spec) | model | `code-reviewer` agent + `pi-simplify` |
| `codebase-design` | 深模块设计(共享 vocabulary) | model | 无对应 |
| `diagnosing-bugs` | 调试(disciplined diagnosis loop) | model | `build-error-resolver` + `silent-failure-hunter` |
| `domain-modeling` | 领域建模(术语/ADR/CONTEXT.md) | model | 部分:`spec-miner`(**Lane 1 修正**:方向正交,不覆盖) |
| `grill-with-docs` | 追问对齐(带文档背景) | user | 无直接对应 |
| `implement` | 实现调度(spec / tickets / tdd / code-review) | user | 无对应 |
| `improve-codebase-architecture` | 架构扫描(HTML 报告 + 深模块机会) | user | 无对应 |
| `prototype` | 原型(扔掉的可分享 demo) | model | 无对应 |
| `research` | 研究(primary sources + cited Markdown) | model | 无对应 |
| `resolving-merge-conflicts` | 冲突解析(按意图解析,不 --abort) | model | 无对应 |
| `setup-matt-pocock-skills` | 一次性 init(issue tracker / labels / 文档位置) | user | 无对应 |
| `tdd` | 测试驱动(red-green-refactor) | model | `tdd-guide` agent |
| `to-spec` | spec 合成(正向) | user | 部分:`spec-miner`(**Lane 1 修正**:方向正交) |
| `to-tickets` | 工单拆分(tracer-bullet tickets) | user | 无直接对应 |
| `triage` | issue 分类(state machine) | user | 无对应 |
| `wayfinder` | 多会话决策票规划 | user | 无对应(**Lane 1 修正**:与 `explore` 正交) |
| `wizard` | 交互向导(只让用户跑人类专属步骤) | model | 无对应 |

**Productivity bucket(7 个)**:

| skill | 能力标签 | 触发方式 | 本仓库对应 |
|---|---|---|---|
| `grill-me` | 追问对齐(开放反问) | user | 无对应 |
| `grilling` | 追问对齐(持续追问,可被 grill-me / grill-with-docs / triage 等 user-invoked skill 调用) | model | 无对应 |
| `handoff` | 交接(压缩当前会话给另一个 agent) | user | `pi-tasks` + `pi-subagents` 间接支撑 |
| `teach` | 教学(多会话,当前目录是 stateful workspace) | user | 无对应 |
| `to-questionnaire` | 问卷(把无法独自决策的事变成 Markdown 问卷) | user | 无对应 |
| `wait-what` | 纠错(model 没听懂时触发) | model | 无对应 |
| `writing-for-agents` | 写作规范(skills / AGENTS.md / CLAUDE.md / 任何 agent 通过指针到达的文档) | model | 无对应 |

**5 桶实际数量(2026-08-20 实测 matt 仓库)**:

| 桶 | 数量 | 本设计装载 |
|---|---|---|
| engineering/ | 18 | ✅ 全装 |
| productivity/ | 7 | ✅ 全装 |
| misc/ | 1(`git-guardrails-claude-code`,给 Claude Code 写 hooks)| ❌ 不装(pi 不识别 Claude Code hooks;由 `extensions/git-guard.ts` 兜底)|
| recipes/ | 2(`context-map` / `docs-tracker`,把多个 skill 串起来的剧本) | ❌ 不装(设计阶段暂不启用) |
| in-progress/ | 6(`claude-handoff` / `loop-me` / `setup-ts-deep-modules` / `writing-beats` / `writing-fragments` / `writing-shape`) | ❌ 不装(matt README 明示不稳定) |
| deprecated/ | 0 | — |
| **合计 stable** | **25(engineering 18 + productivity 7)** | ✅ **25** |

### 1.3 装载源与目录(仅 Lane B 装载)

| 项 | 值 |
|---|---|
| 源仓库 | `https://github.com/mattpocock/skills`(官方版,default branch HEAD) |
| git ref | default branch HEAD(trust maintainer,与现有 1 个 git 源策略同) |
| 装载方式 | pi `git:` 装载源 + `packages` 数组对象项的 `skills` filter;**无需 cp -r** |
| pi convention | `skills/` 目录递归找 `SKILL.md` 文件夹(见 [pi packages.md §Package Structure](https://pi.dev/docs/packages#package-structure))|
| 目标目录(运行时) | `~/.pi/agent/skills/`(pi 装载 packages 后,skill 内容自动加载) |

### 1.4 用户机器当前状态(新事实 · 沿用 v1 修正)

`~/.agents/.skill-lock.json` 实际状态(从 omo 时代迁来的用户机器):

- **来源分布**:47 `meisijiya/skills` + 1 `mattpocock/skills`(含 `handoff`)+ 4 `anthropics/skills` + 3 `stablyai/orca` + 8 misc(v1 调研稿的统计,v2 同样适用)
- **实际只有 9 个 SKILL.md 文件**(同上 v1 数据)
- **`brainstorming` 等实际是 meisijiya/skills 域来源**(47/63),不是 superpowers-zh 来源(lock 中**无任何 superpowers-zh 条目**)。

**v2 新事实**:matt 全新源,设计阶段无历史 lock 数据;从 omo 时代迁来的用户跑新脚本 `scripts/migrate-skill-lock.ts` 后:
- OVERRIDDEN 表 25 项覆盖:`handoff` 等 25 个 stable skill 的 lock 条目从 `meisijiya/skills` 改指向 `mattpocock/skills` + 更新 tree SHA
- 其余 omo 时代孤儿(in-progress 等不在 matt 25 stable 的条目)建议手动 `npx skills@latest update --prune` 或保留

### 1.5 Lane A / Lane B 与用户当前状态对应

| 用户当前状态 | 对应 Lane | 备注 |
|---|---|---|
| 保留 superpowers-zh + 9 agent 全留 + 不装 matt skill | **Lane A** | 保持现状;matt skill 仅作参考 |
| 撤 superpowers-zh + 撤 tdd-guide + code-reviewer + 装 mattpocock/skills 25 stable + 修 write-guard + 保留 git-guard + 跑 migrate-skill-lock | **Lane B** | 完整迁移 |

---

## 2. 冲突分析(方法层 · 共享)

### 2.1 冲突类型分类

matt skill 与本仓库的冲突**不在 pi runtime 加载层**(skills 走 on-demand 加载,extension 走常驻),而是 **3 类语义层冲突**:

| 冲突类型 | 含义 | 风险 |
|---|---|---|
| **A. trigger 重叠** | 两个能力的 description 都匹配同一类用户输入 | model 不知道选哪个,prompt 缓存抖动 |
| **B. 职责重复** | 两个能力做同一件事但风格/深度不同 | 用户认知负担 + prompt 体积浪费 |
| **C. 流程覆盖** | 一个能力强制走完整流程,另一个被嵌入其中 | model 提示词互相覆盖,效果不可预测 |

**v2 新事实**:matt 官方版**无** v1 omo 的 14 个 description 守卫。A 类风险略升,**D1 决策接受**(撞车由 model on-demand 自纠正机制兜底)。

### 2.2 按冲突类型逐项判定(沿用 v1 Lane 1 复审修正)

| 本地能力 | matt 对应 | 冲突类型 | 严重度 | 方案 | 修正说明 |
|---|---|---|---|---|---|
| `superpowers-zh`(整体) | `tdd`+`diagnosing-bugs`+`grill-me`/`grill-with-docs`+... | A+B+C | **高** | **撤**(Lane B) | bootstrap 强制冲突(无修正)|
| `tdd-guide` agent | `tdd` skill | A+B | 中 | **撤**(Lane B) | 接受损失:eval-driven TDD 增补(v1.8)/ 80% 覆盖率硬约束 / mocking 实操细节 |
| `spec-miner` agent | `domain-modeling` + `to-spec` | **B**(仅) | **低** | **保留**(Lane B)⚠️ | **Lane 1 修正**:matt 两 skill 方向正交——domain-modeling 是术语/ADR 沉淀,to-spec 是正向对话合成,spec-miner 是 brownfield 反向提取。**matt 不覆盖** |
| `code-reviewer` agent | `code-review` skill | A+B | 中 | **撤**(Lane B) | 接受损失:severity → verdict 链路(approve/warn/block);matt 输出是 two-axis Standards + Spec,narrative 不是 verdict |
| `explore` agent | `wayfinder` skill | **无冲突** | **—** | **保留**(Lane B)⚠️ | **Lane 1 修正**:explore 是只读文件搜索(quick/medium/very thorough 三档),wayfinder 是多会话决策票规划——**完全正交** |
| `silent-failure-hunter` agent | `diagnosing-bugs` skill | A | 低 | **保留**(两 lane) | 静默失败 vs 用户可见 bug,目标不同 |
| `build-error-resolver` agent | `diagnosing-bugs` skill | A | 低 | **保留**(两 lane) | "构建错误最小 diff" 是独立纪律 |
| `pi-simplify` extension | `code-review` skill | A+B | 中 | **撤**(Lane B) | `/simplify` 由 matt `code-review` 接管 |
| `pi-plan-mode` extension | `grill-with-docs` / `grill-me` / `wayfinder` | **仅 A** ⚠️ | 低 | **保留**(两 lane) | **Lane 1 修正**:plan-mode 是结构层(屏蔽写工具),不进入对话流程——**C 类流程覆盖其实不存在** |
| `agent-evaluator` / `harness-optimizer` / `security-reviewer` agent | 无 | 无 | — | **保留**(两 lane) | matt 不覆盖 |
| `write-guard.ts` extension | (matt `git-guardrails-claude-code` 走 Claude Code hooks,pi 不识别) | B | 低 | **保留 + 修**(两 lane) | §4.7 修复 caller 维度 |
| `git-guard.ts` extension(Lane B 已有) | matt `misc/git-guardrails-claude-code` skill(pi 不识别 Claude Code hooks)| B | 低 | **保留**(Lane B) | 本 extension 是 pi 层兜底,详见 §3B.7.2 |
| 10 个外部 npm 扩展(除 superpowers-zh / pi-simplify / pi-plan-mode / write-guard.ts) | 无直接对应 | 无 | — | **保留**(两 lane) | 互补层 |

### 2.3 关键判断

**A. `superpowers-zh` 怎么处理?**

`superpowers-zh` 包体里有一个 `using-superpowers` bootstrap skill,**强制 model 每次回应前先检查 skills 列表**。matt skill 的 on-demand 触发模型没有这个 bootstrap。

如果 **同时装**:
- model 每次回应前要走两次 skill 列表检查
- 同一类问题可能被 `superpowers` 的 `brainstorming` 和 matt `grill-me` 两个 description 同时匹配
- 跨包 trigger 重叠是**不可调和的**——必须二选一

**结论**:**Lane B 撤 `superpowers-zh`**(同时撤 `superpowers` 备份),把 brainstorming / TDD / debugging 全部让给 matt skill。Lane A 保留。

**B. agent 体系 vs skill 体系——撤哪些?(沿用 v1 Lane 1 修正)**

agent 在 pi 里有 3 个 matt skill 不具备的**结构性优势**:
1. 独立上下文:agent 跑在 sub-session 里,主对话不污染
2. 独立 model:可指定更便宜的模型(如 deepseek-v4-flash)
3. 独立 max_turns / color / 工具集

但也有 3 个劣势:
1. agent 走 `prompt_mode: replace`,直接替换主 prompt,**对 superpowers 的 bootstrap 不友好**(Lane B 撤 superpowers-zh 后这个劣势消失)
2. agent description 是声明式,model 在主对话里看不到 agent 细节
3. 9 个 agent 的 description 加起来 ≈ 1.5K token,启动即占用

**Lane B 撤 2 个 agent**(沿用 v1):
- `tdd-guide` —— matt `tdd` 覆盖(接受 eval-driven TDD 增补 / 80% 覆盖率硬约束 / mocking 实操损失)
- `code-reviewer` —— matt `code-review` 覆盖(接受 severity → verdict 链路损失)

**Lane B 保留 7 个 agent**(沿用 v1,**包括 `spec-miner` / `explore`**):
- `silent-failure-hunter` / `build-error-resolver`(独立上下文 + 纵深职责)
- `agent-evaluator` / `harness-optimizer` / `security-reviewer`(matt 不覆盖)
- `spec-miner`(matt 不覆盖 brownfield 反向提取,**§2.2 表中已加 ⚠️**)
- `explore`(matt `wayfinder` 与之正交,**§2.2 表中已加 ⚠️**)

**Lane A 全保留 9 个 agent**。

**C. extension 基础设施要动哪些?**

- `superpowers-zh` → **Lane B 撤** / Lane A 保留
- `pi-simplify` → **Lane B 撤** / Lane A 保留
- `pi-plan-mode` → **两 lane 保留**(结构层职责 matt skill 替代不了)
- 其余 10 个 npm 包 + 3 个内置 + `write-guard.ts` → **两 lane 保留**
- `extensions/git-guard.ts` → **Lane B 已有**(替代 matt `misc/git-guardrails-claude-code` skill,详见 §3B.7.2)
- `extensions/write-guard.ts` description → **两 lane 修复**(caller 维度判定,已修)
- `scripts/migrate-skill-lock.ts` → **Lane B 已有**(OVERRIDDEN 表 25 项,详见 §3B.7.3)

**D. matt 的 `git-guardrails-claude-code` 在 pi 里的状态**

matt 官方 `git-guardrails-claude-code` skill(在 `misc/` 桶)用 Claude Code hooks JSON 格式。**pi 不识别**——本仓库已在 `extensions/git-guard.ts` 用 pi extension 风格(`pi.on("tool_call", ...)`)重写兜底。

**结论**:
- matt 这个 skill **不能直接装**(skill 内容是 Claude Code 格式,且 pi 不识别 hooks)
- 在 pi 里**已有**重写版——`extensions/git-guard.ts` 守住"git 子命令"
- 本仓 `write-guard.ts` 守住"写路径",新写 `git-guard.ts` 守住"git 子命令"(分工明确)


---

## 3A. Lane A 实施详细(纯 extension · 改动 0)

**核心**:保持现状,不引入 matt 装载源。matt skill 仅作参考文档保留(未来如需装可走 Lane B)。

### 3A.1 settings.json 由 AGENTS.md 决策树选择(superpowers 由用户决定)

按 [AGENTS.md §3 决策树](../AGENTS.md#3-安装步骤始终执行),**Lane A 内部 superpowers 还有 3 种选择**——对应 [presets/](../presets/) 目录 3 个模板:

| 模板 | superpowers 源 | PKGS 项数 | 适用 |
|---|---|---|---|
| [`settings.lane-a.zh.json`](../presets/settings.lane-a.zh.json) | `npm:superpowers-zh@latest` | 14 | 中文工作流(决策 9 历史默认) |
| [`settings.lane-a.en.json`](../presets/settings.lane-a.en.json) | `git:github.com/obra/superpowers` | 14 | 英文原版 superpowers |
| [`settings.lane-a.bare.json`](../presets/settings.lane-a.bare.json) | (无) | 13 | 不装 superpowers(用户自己后续装) |

**Agent 安装步骤**(详见 [INSTALL.md §3](../INSTALL.md#3-cp-用户选的-settings-模板)):

```bash
cp presets/settings.lane-a.zh.json ~/.pi/agent/settings.json
# 或 en / bare
```

**PKGS 数组三选一**:

**zh 模板(14 项)**:
```bash
PKGS=(
  "npm:pi-context-view"
  "npm:pi-system-prompt"
  "npm:pi-context-breakup"
  "npm:superpowers-zh@latest"   # 决策 9:中文增强版
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

**en 模板(14 项)**:`superpowers-zh@latest` → `git:github.com/obra/superpowers`

**bare 模板(13 项)**:删 superpowers 行

**不增 mattpocock/skills**——matt 装载源不进 Lane A 的 `settings.json` packages。

### 3A.2 agents/ 不变(9 个)

9 个 subagent **全保留**:`agent-evaluator` / `build-error-resolver` / `code-reviewer` / `explore` / `harness-optimizer` / `security-reviewer` / `silent-failure-hunter` / `spec-miner` / `tdd-guide`。

### 3A.3 settings.json 不变

保持当前 14 项 packages 数组 + 3 项 extensions。`extensions` 与 `packages` 字段有 3 项重叠(`pi-system-prompt` / `pi-context-view` / `pi-context-breakup`)——这是 pi 的合法模式(`extensions` 控制加载,`packages` 控制 trust 声明)。

### 3A.4 README.md 验证清单(小幅调整)

- **不加** matt skill 装载小节
- **不加** `/skill:code-review` `/skill:grill-me` 等新触发语
- `/simplify` 仍可用
- 加一行参考:"mattpocock/skills 集成方案(未实施)见 [docs/mattpocock-skills-integration.md §3B](docs/mattpocock-skills-integration.md#3b-lane-b-实施详细部分-extension--matt-skill-官方版)"

### 3A.5 适用范围

- 用户偏好"agent 独立上下文"——9 个 subagent 各跑独立 sub-session,主对话不污染
- 用户不想引入 skill 体系——on-demand prompt 协议增加 prompt 体积
- 用户按 [AGENTS.md §3 决策树](../AGENTS.md#3-安装步骤始终执行) 选择 superpowers 版本——可能用 `superpowers-zh` 的 `using-superpowers` bootstrap 强约束(中文版)/ `obra/superpowers` 英文原版 / 不装
- 用户保留 `pi-simplify` 的 `/simplify` 单命令习惯

### 3A.6 回滚到 Lane B 的成本

如果未来想从 Lane A 切到 Lane B:跑 Lane B 的 `install-packages.sh` + 删 2 agent + 装 mattpocock/skills(改 packages 数组为对象项)+ 跑 `scripts/migrate-skill-lock.ts` 即可。**回滚成本 = Lane B 实施成本**。

---

## 3B. Lane B 实施详细(部分 extension + matt skill 官方版 · 改动 9 项)

**核心**:撤冲突最严重的项(`superpowers-zh` bootstrap / `pi-simplify` / 2 个 agent),引入 mattpocock/skills 25 stable skill(**无** description 守卫,D1 决策接受撞车风险↑),已有 `git-guard.ts` 替代 matt `misc/git-guardrails-claude-code` skill,已有 `migrate-skill-lock.ts` 同步 lock 文件(OVERRIDDEN 25 项)。

### 3B.1 `presets/settings.lane-b.json` packages 草案(Lane 2 JSON 验证通过)

```jsonc
{
  "_comment": "Lane B · 部分 extension + mattpocock/skills 官方版（13 包）。撤 superpowers-zh + pi-simplify，装 mattpocock/skills 源（pi convention 自动发现 skills/ 下 25 stable SKILL.md，无需 cp -r）。配套撤 tdd-guide/code-reviewer agent，加 git-guard.ts。",
  "packages": [
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
    "npm:pi-plan-mode@latest",   // 保留:结构层职责 matt skill 不覆盖

    // mattpocock/skills 装载源（对象形式,用 packages filter 限定 25 stable）
    {
      "source": "git:github.com/mattpocock/skills",
      "skills": ["skills/engineering/*", "skills/productivity/*"]
    }
  ]
}
```

**装载机制**:
- `pi install` 装上 `git:github.com/mattpocock/skills` 源
- pi 装载时按 convention 自动递归发现 `skills/engineering/*` + `skills/productivity/*` 下的 25 个 SKILL.md
- 跳过 `misc/`(`git-guardrails-claude-code`,pi 不识别 Claude Code hooks)、`recipes/`(暂不启用)、`in-progress/`(matt README 明示不稳定)
- **无需 cp -r 循环**(v1 omo 时代用 INSTALL.md §5a 的 cp 循环,v2 改用 pi convention)

> **Lane 2 注释补全**:`extensions` 是加载列表(运行时引用),`packages` 是 trust 声明(安装时校验签名)。二者可重叠——重复声明无害。

### 3B.2 agents/ 变更(9 → 7 个 · 沿用 v1 Lane 1 修正)

**撤(2 个 · 不是 4 个)**:

- `agents/tdd-guide.md` —— matt `tdd` 覆盖
- `agents/code-reviewer.md` —— matt `code-review` 覆盖

**保留(7 个)**:

- `agent-evaluator` / `build-error-resolver` / `harness-optimizer` / `security-reviewer` / `silent-failure-hunter` / `spec-miner` / `explore`

> **Lane 1 修正记录**:原 v1 调研稿"撤 4 个 agent(tdd-guide / spec-miner / code-reviewer / explore)"中,`spec-miner` / `explore` 撤判理由错误(§2.2 已说明)——这两个 agent 的能力 matt 不覆盖,**Lane B 保留**。

### 3B.3 settings.json 草案(同 §3B.1,deploy.sh 自动写入)

§3B.1 已给完整草案,deploy.sh §3 部署配置段把 `packages` 字段从 preset 同步到 `~/.pi/agent/settings.json`(保留用户个人偏好 `defaultProvider` / `defaultModel` / `theme` 等)。

### 3B.4 deploy.sh 变更

- §3 部署配置段保留 `agents/` 目录的 `for` 循环(自动只拷贝剩余 7 个;Lane B 撤 tdd-guide/code-reviewer)
- §4 PKGS 数组**自动从 preset 读取**(已支持对象项,无需改 deploy.sh 主体)
- §6 下一步提示更新验证清单(移除 `/simplify`,加 `/skill:code-review` 等)

### 3B.5 README.md 变更(沿用 v1)

- 顶部扩展表"方法论"行:`superpowers-zh` → `mattpocock/skills`("25 个 stable skill 装载源,详见 [决策 10](docs/decisions.md#决策-10mattpocockskills-官方版集成-lane-b-双路线版)")
- **核心数字**:"合计 11 个外部扩展包 + 3 个内置 = 14" → **"合计 9 个外部扩展包 + 1 个 skill 源 + 3 个内置 = 13 个"**(v1 算术 bug 已修:`9+1+3 = 13` ✓)
- 验证清单:slash commands 部分移除 `/simplify`;新增 `/skill:code-review` / `/skill:grill-me` 等触发语说明
- 加一节"matt skill 装载":packages filter 说明 + `/skill:setup-matt-pocock-skills` 必跑提示

### 3B.6 docs/decisions.md 变更

新增"决策 10:mattpocock/skills 官方版集成方案(Lane B)"——指向本文档 §3B;末尾"v1 → v2 增量变更"表记录 7 项 fact 差异。

### 3B.7 extensions/ + scripts/ 变更(已有:write-guard + git-guard + migrate-skill-lock)

#### 3B.7.1 write-guard.ts description 修复(两 lane 都修 · 沿用 v1)

**当前 description(已修)**:

> write-guard:白名单 `openspec/specs/<capability>/spec.md` 写路径。默认(未设置 `WRITE_GUARD_STRICT`)完全放行;设置 `WRITE_GUARD_STRICT=1` 才启用白名单硬拦截(仅放行 `openspec/specs/<capability>/spec.md`)。详见 `extensions/write-guard.ts` 文件头注释。

**caller 判定伪代码**(沿用 v1 Lane 3):

```typescript
const caller = ctx.callerAgentName ?? event.caller?.name ?? "main";
const STRICT_AGENTS = new Set(["spec-miner", "domain-modeling", "to-spec"]);
function classify(caller: string): "strict" | "loose" | "main" {
  if (caller === "main" || caller == null) return "main";        // 主对话:完全放行
  if (STRICT_AGENTS.has(caller)) return "strict";                // 强约束白名单
  return "loose";                                                // 其他 agent:宽松
}
// main → undefined(不拦截)
// strict → isPathAllowed 旧逻辑(白名单才放行)
// loose → 仅禁绝对路径 + `..` 逃逸
```

> **Lane 3 备注**:`ctx.callerAgentName` 是 pi ExtensionAPI 的假设字段,实施前需查 `ExtensionAPI` 类型定义确认是否暴露 `caller`;若无,可在 `pi-subagents` 调用 subagent 时通过 `pi.context.set("write-guard:strict", true)` 自声明。

#### 3B.7.2 git-guard.ts 已有(仅 Lane B · 沿用 v1 Lane 2 骨架)

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const FORBIDDEN: RegExp[] = [
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+push\s+(?:--force(?!-)|-f)\b/,
  /\bgit\s+clean\s+-f[dDfXx]*\b/,
  /\bgit\s+checkout\s+(?:--\s+)?\\.(?:\s|$)/,
  /\bgit\s+branch\s+-D\b/,
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

**职责说明**:**替代 matt `misc/git-guardrails-claude-code` skill**。matt 官方版该 skill 用 Claude Code hooks JSON 格式,pi 不识别。本 extension 监听 `pi.on("tool_call", ...)` 事件直接在 pi 层拦截。

**已知绕过**(沿用 v1 Lane 3,README 必须明列):

```bash
bash -c "git reset --hard HEAD~5"             # 字符串嵌入
git --exec-path=/tmp reset --hard              # 长选项拆分
git\ reset\ --hard                             # 反斜杠转义
GIT_PAGER=cat git -c alias.dh='reset --hard' dh   # alias 链
```

#### 3B.7.3 migrate-skill-lock.ts 已有(仅 Lane B · v2 扩到 25 项)

部署时跑:扫 `~/.agents/.skill-lock.json`,对 OVERRIDDEN 表中 25 个 matt stable skill,确保 lock 条目 source 指向 `mattpocock/skills` 且 `skillFolderHash` 是当前 matt 仓库对应文件夹的 git tree SHA。

```typescript
// 简化伪代码(实际 35 行)
import { readFileSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";
import { execSync } from "child_process";

const LOCK = join(process.env.HOME!, ".agents/.skill-lock.json");

// mattpocock/skills 25 个 stable skill → 统一指向 mattpocock/skills 源。
// (engineering 18 + productivity 7,跳过 misc/recipes/in-progress)
const OVERRIDDEN: Record<string, { source: string; sourceUrl: string }> = {
  // engineering 18 + productivity 7,见 scripts/migrate-skill-lock.ts 实际定义
};

async function migrate(): Promise<void> {
  // 1. 备份 lock 到 .bak-<TS>
  // 2. 对 OVERRIDDEN 列表里每个 skill:
  //    - 从 mattpocock/skills 的 GitHub tree 找到 skill 文件夹的 tree SHA
  //    - 如果 entry.source === "mattpocock/skills" && hash === sha:跳过
  //    - 否则:更新 source / sourceUrl / sourceType / skillFolderHash / updatedAt
  // 3. 写回(保留原条目其它字段,不删除)
}
```

**适用范围**:
- 从 omo 时代迁来的用户:跑一次后 25 stable skill 的 lock 条目对齐到 mattpocock/skills
- 全新用户:lock 无条目或已对齐,跑 no-op(idempotent)
- **其余 omo 时代孤儿(in-progress 等不在 matt 25 stable 的条目)**:脚本不主动改写,建议手动 `npx skills@latest update --prune` 或保留

### 3B.8 触发习惯变化

| 触发 | Lane A | Lane B |
|---|---|---|
| `/simplify` 审 diff | ✅ 仍可用 | ❌ 改为 `/skill:code-review` |
| `help me plan X` | superpowers `brainstorming` 自动 | matt `grill-me` / `grill-with-docs` 需 `/skill:xxx` |
| `find bugs in X` | superpowers `debugging-and-error-recovery` 自动 | matt `diagnosing-bugs` model 自动(user 不显式触发) |
| `review this diff` | `pi-simplify` `/simplify` | `/skill:code-review` 或 `code-review this diff` |
| `write tests for X` | superpowers `test-driven-development` 自动 | matt `tdd` model 自动 |

**变化总结**:Lane B 的 skill 多数仍是 model-invoked(自动触发),但 `/simplify` 这种 slash 命令需要换名字。


---

## 4. 风险与未决问题(共享主体 · 按 lane 标注影响)

| 节 | 风险主题 | Lane A 影响 | Lane B 影响 |
|---|---|---|---|
| 4.1 | `setup-matt-pocock-skills` 强依赖 | 不受影响 | **必加 smoke test 强制 init** |
| 4.2 | superpowers bootstrap 与 matt skill 共存 | 不受影响(保留 superpowers-zh) | 必撤 |
| 4.3 | git-guard 重写漏拦截 | 不受影响 | 新增 git-guard.ts,需明列已知绕过 |
| 4.4 | `.skill-lock.json` 孤儿记录(v2 新事实)| 保留 mattpocock/skills 来源 | 必跑 migrate-skill-lock.ts 同步 25 stable |
| 4.5 | description 守卫降低 trigger 撞车 | 不受影响 | **v2 差异**:matt 无 omo 的 14 守卫,撞车↑,D1 接受 |
| 4.6 | tdd-guide eval-driven TDD addendum | 不受影响(保留 agent) | 必归档 `docs/archive/tdd-guide-eval-addendum-v1.8.md` |
| 4.7 | write-guard 误拦截 | 必修(实测已发现) | 必修 |
| 4.8 | skill 触发方式转换 | 不受影响(保留 superpowers-zh) | 有体感影响但缓解简单 |
| 4.9 | deploy.sh 同步覆盖 | 共担 | 共担 |
| 4.10 | 决策 9 回退路径 | 不受影响 | 必更新为"演进 → 决策 10" |

### 4.1 `setup-matt-pocock-skills` 强依赖(仅 Lane B)

matt 的 `/setup-matt-pocock-skills` 会问三件事:
1. issue tracker(GitHub / Linear / local)
2. triage labels
3. 文档保存位置

如果用户**没跑过这个 init**,matt 的 `triage` / `to-tickets` / `to-spec` / `improve-codebase-architecture` 四个 user-invoked skill **前置空跑不会触发任何报错**——model 第一次见触发语才会问问题,体验是 model 反复问你。

**风险**:用户装 Lane B 但忘跑 init,会觉得 matt skill 不好用。
**缓解**:smoke test 必跑 `/skill:setup-matt-pocock-skills` 强制 init。

### 4.2 superpowers bootstrap 与 matt skill 共存(仅 Lane B 撤)

**完全不能共存。Lane B 撤 superpowers-zh。**

matt skill 的 description 守卫**不存在**(v2 移除 v1 omo 的 14 守卫),bootstrap 冲突依然不消除——bootstrap 强制 model 扫两套 skills 列表,token 浪费 + trigger 撞车。

### 4.3 `git-guardrails-claude-code` pi 重写 + 已知绕过(仅 Lane B)

matt `misc/git-guardrails-claude-code` skill 用 Claude Code hooks JSON 格式。**pi 不识别**——已在本仓 `extensions/git-guard.ts` 重写为 pi extension 风格(`pi.on("tool_call", ...)`)。

**重写后拦截范围比 matt 原始 skill 窄**(pi 的 `tool_call` 事件不递归 shell 解析):

```bash
bash -c "git reset --hard HEAD~5"             # 字符串嵌入
git --exec-path=/tmp reset --hard              # 长选项拆分
git\ reset\ --hard                             # 反斜杠转义
GIT_PAGER=cat git -c alias.dh='reset --hard' dh   # alias 链
```

**缓解建议**:
1. 在 README "已知绕过" 段明列以上 4 种绕过
2. 检测 `--exec-path` / `-c alias.*` 类转义
3. 对 `bash -c "..."` / `sh -c "..."` / `eval "..."` 子 shell 做一次递归 re-parse
4. **避免给用户安全错觉**——明示"此 extension 是 best-effort 拦截,复杂 shell 绕过不在覆盖范围"

### 4.4 `.skill-lock.json` 孤儿记录(两 Lane 共担 · v2 新事实)

mattpocock/skills 仓库**没有 npm 发布**,走 `git:github.com/...` 源(与决策 1 一致)。

**v2 新事实**:matt 全新源,设计阶段无历史 lock 数据。但**从 omo 时代迁来的用户**的 `~/.agents/.skill-lock.json` 实际有 **63 条 lock 记录**(沿用 v1 统计),来源分布:
- 47 条 `meisijiya/skills`(omo 时代)
- 1 条 `mattpocock/skills`(含 `handoff`,沿用 v1 omo 覆盖结果)
- 4 条 `anthropics/skills`
- 3 条 `stablyai/orca`
- 8 条 misc

**冲突场景**(从 omo 迁来的用户):omo `cp -r skills/productivity/handoff` 时代曾覆盖 `~/.pi/agent/skills/handoff`,但 **lock 文件不会被改写**——会出现"磁盘是 omo 版本,lock 仍记 mattpocock/skills + 旧 hash"的孤儿记录。

**Lane B 缓解**:必跑 §3B.7.3 `migrate-skill-lock.ts`:
1. 扫 lock 中所有条目
2. 对 OVERRIDDEN 表中 25 个 matt stable skill,重新计算目录 hash 并更新
3. 把 `source` 统一改为 `mattpocock/skills`
4. 部署时跑一次(idempotent)

**其余 omo 时代孤儿**(in-progress 等不在 matt 25 stable 的条目,约 22 条):脚本不主动改写,建议手动 `npx skills@latest update --prune` 或保留。

### 4.5 matt 官方版无 description 守卫(v2 差异)

**v1(omo fork)**:omo-skills 的 14 个 description 守卫主动避免与 omo 内置 skill 撞车,**间接也减少与本仓库 superpowers-zh 英文子集冲突**。

**v2(matt 官方)**:matt 官方 description 是 Anthropic Agent Skills 标准格式,无专门为 pi 优化的守卫。

**撞车影响**:
- 例:matt 官方 `code-review` description = "Use when reviewing code changes in a git repository..."——和 pi `codegraph-pi` 的 `explore` agent 在某些场景下撞车概率比 v1 omo 高
- **D1 决策**:撞车风险真实但可控,pi 的"on-demand / model-invoked"机制对偶发撞车有 self-correct 能力,先接受再观察
- **缓解**:撞车明显时,可加 `~/.pi/agent/AGENTS.md` 的"避撞"提示,或反馈给 mattpocock/skills 上游添加 description 守卫

### 4.6 tdd-guide eval-driven TDD addendum 去向(仅 Lane B 撤)

agent-evaluator v1.8 增补里加了 eval-driven TDD 内容(`tdd-guide.md:98-106`)。matt `tdd` skill 里**没有**这个概念。Lane B 移除 `tdd-guide` agent 后,这段内容**会丢失**。

**建议**:**强烈归档到 `docs/archive/tdd-guide-eval-addendum-v1.8.md`**,理由:
1. 段内容在 v1.8 是边角实验(pass@1/pass@3)非核心 TDD 流程
2. 搬到 `agent-evaluator.md` 末尾会污染其 5 轴评分结构(agent-evaluator 主轴是 Accuracy/Completeness/Clarity/Actionability/Conciseness,加 TDD addendum 跨界)
3. 未来如需复活 eval-driven 概念可直接从 archive 引用,避免散落多处不一致

### 4.7 write-guard 误拦截(两 Lane 共担)

`write-guard.ts` 当前 description 假设 `spec-miner` 在用,但实际上**无差别拦截所有 write 调用**(本次设计阶段实测已发现——尝试用 `write` 工具写 `docs/mattpocock-skills-integration.md` 被拦截)。

**修复**:
- 默认(未设置 `WRITE_GUARD_STRICT`)完全放行,等价于 no-op
- 设置 `WRITE_GUARD_STRICT=1` 才启用白名单硬拦截(仅放行 `openspec/specs/<capability>/spec.md`)
- 两 Lane 都已修

### 4.8 skill 触发方式转换(仅 Lane B)

**v1 关键事实修正(沿用)**:用户机器**实际只有 9 个 SKILL.md 文件**,其余 54 条 lock 是幽灵(已删但 lock 未清理)。其中**没有任何 superpowers-zh 来源条目**——lock 源分布 47/63 是 meisijiya/skills。

所以 v1 调研稿"brainstorming 等来自 superpowers-zh 撤除后消失"是**理论风险非实际风险**——这些 skill 现在已经不在磁盘上。

**但触发方式转换确实有体感影响**:
- superpowers 的 `brainstorming` 是 model-invoked(任何"我想做 X"都会自动触发),matt 的 `grill-me` / `grill-with-docs` 是 user-invoked(用户必须主动 `/skill:xxx`)
- 日常体验差别:以前 model 会自动进入"反问-对齐-再问"循环;现在用户必须显式触发

**缓解**:
1. 在 `~/.pi/agent/AGENTS.md` 顶部写一条 user hint:"如需对齐需求请主动 `/skill:grill-me`"
2. 不需要担心触发密度下降——user-invoked 更可控,反而降低误触发

### 4.9 deploy.sh 同步覆盖风险(两 lane 共担)

`deploy.sh` §3 当前对 `~/.pi/agent/extensions/` 用 `for f in "$REPO_ROOT"/extensions/*.ts` 覆盖式拷贝。

**风险**:实施后第一次跑 deploy.sh 时,新文件(`migrate-skill-lock.ts` 是 standalone 不在 extensions/,实际只有 git-guard.ts)会被拷贝到 `~/.pi/agent/extensions/`,**但 pi 不自动重启**——下次启动 pi 才生效。这与现有 deploy.sh 行为一致,无新增风险。

### 4.10 决策 9(superpowers-zh)回退路径(仅 Lane B 撤)

决策 9 写了中文 / 英文切换命令。Lane B 撤 superpowers-zh 后,决策 9 的"切换命令"段落失效**——需更新或归档**。

**方案**:决策 9 标注为"已演进——见决策 10",正文保留为历史快照。

---

## 5. 复审指令

### 5.1 持怀疑态度复审(两 Lane 共审)

请用户审查本文档:

1. §0 第 3 点 **Lane B 撤 agent 数从 4 → 2 的修正**(Lane 1 关键发现,v2 沿用),你认可吗?
2. §3A 与 §3B 二选一执行——你倾向哪个?还是有第三种组合?
3. §4.4 migrate-skill-lock.ts OVERRIDDEN 表扩到 25 项(从 v1 的 1 项)是否值得?
4. §4.7 write-guard 修复是否同意两 Lane 都做(避免日常 write 误拦截)?
5. §4.5 matt 官方版无 description 守卫(D1 决策接受撞车风险↑)是否同意?

### 5.2 Lane B install smoke test(仅 Lane B 必跑)

```bash
# 1. deploy.sh lane-b 已 pi install 装载源
bash /path/to/pi-configuration/deploy.sh lane-b

# 2. pi 启动验证 25 个 matt skill 已自动发现
PI_HOME=~/.pi-agent-test pi
> /skills    # 应见 25 个 matt skill(engineering 18 + productivity 7)+ 7 个 subagent

# 3. 强制 init(Lane 3 必加项)
> /skill:setup-matt-pocock-skills    # ← **必跑**
# 按提示完成:issue tracker / triage labels / 文档保存位置

# 4. 触发关键 skill 测试:
> help me plan this feature    # grill-me / grill-with-docs
> find issues in this auth code # diagnosing-bugs
> review this diff             # code-review(**注意**:原 /simplify 已撤)
> walk me through the design of this system  # domain-modeling
> write tests for this function # tdd

# 5. git-guard.ts 测试:
> bash: git reset --hard HEAD~3   # 应被拦截
> bash: git push origin main      # 应放行(非 --force)
> bash: bash -c "git reset --hard"  # ⚠️ 已知绕过(README 必须明列)

# 6. write-guard.ts 测试:
> write: docs/foo.md              # 主对话写应放行(WRITE_GUARD_STRICT 未设)
> 设置 WRITE_GUARD_STRICT=1 后:write: openspec/specs/auth/spec.md  # 应放行(白名单命中)

# 7. migrate-skill-lock.ts 测试:
node scripts/migrate-skill-lock.ts   # 验证 lock 中 25 stable skill 对齐到 mattpocock/skills
cat ~/.agents/.skill-lock.json | jq '.skills.handoff'   # 应见 source: "mattpocock/skills"
```

### 5.3 Lane A 验证清单(仅 Lane A)

```bash
pi list   # 14 个
> /skills  # 无变化
> /simplify  # 仍可用
> how does auth.ts work   # 触发 codegraph / explore
```

### 5.4 用户日常工程流验证(两 Lane 共做)

跑完 smoke test 后,请用户回答:

1. **主对话 trigger description 是否够丰富**?Lane B 撤 2 agent + superpowers-zh 后,model 还会不会"自动想到"做 spec-mining / code-review / explore?
2. **`git-guard.ts` 的拦截范围**?测试几条危险命令,确认拦截行为符合预期;README "已知绕过" 段是否需要补充?
3. **`/simplify` 触发习惯**?Lane B 撤 `pi-simplify` 后,原 `/simplify` 调用需要改成 `/skill:code-review`——是否接受?
4. **write-guard.ts 配套**?两 Lane 都修 write-guard 后,日常 write 是否仍被拦截?
5. **撞车是否明显**(v2 新问题)?Lane B 装 matt 官方版后,实际跑一段时间观察撞车是否明显?

---

## 6. 附录 mattpocock/skills 25 stable skill 清单(仅 Lane B 引用)

按 bucket 分组(与 §1.2 同):

**Engineering(18 个)**:
- ask-matt · code-review · codebase-design · diagnosing-bugs
- domain-modeling · grill-with-docs · implement
- improve-codebase-architecture · prototype · research
- resolving-merge-conflicts · setup-matt-pocock-skills · tdd
- to-spec · to-tickets · triage · wayfinder · wizard

**Productivity(7 个)**:
- grill-me · grilling · handoff · teach · to-questionnaire · wait-what · writing-for-agents

**触发方式分类**:

- **User-invoked**(用户手动 `/skill:name` 或触发语,11 个):ask-matt · grill-me · grill-with-docs · triage · improve-codebase-architecture · setup-matt-pocock-skills · to-spec · to-tickets · implement · wayfinder · teach · to-questionnaire
- **Model-invoked**(model 自动触发,14 个):diagnosing-bugs · tdd · domain-modeling · codebase-design · code-review · resolving-merge-conflicts · wizard · research · prototype · grilling · wait-what · writing-for-agents · handoff

(注:用户统计与 v1 omo 时代略有差异,因 matt 官方与 omo fork 的触发方式标注不完全一致,以 matt README 为准)

**装机默认**:25 个全装入 pi packages(通过 packages filter 自动发现,**无需 cp -r**)。

---

## 7. 升级说明(v1 → v2 · 共享)

升级自 `docs/omo-skills-integration.md`(本仓库 v1,omo-skills fork 时代),v2 主要变更:

| # | 维度 | v1(omo fork) | v2(matt 官方)|
|---|---|---|---|
| 1 | 装载源 | `git:github.com/meisijiya/omo-skills` | **`git:github.com/mattpocock/skills`**(官方版)|
| 2 | 装载机制 | `pi install` + INSTALL.md §5a `cp -r skills/<bucket>/<name>` 循环 | `pi install` + packages filter(`skills: ["skills/engineering/*", "skills/productivity/*"]`);pi convention 自动递归发现,**无需 cp -r** |
| 3 | Skill 数量 | 25(omo fork 的 25 stable)| 25(matt 官方 stable:engineering 18 + productivity 7)|
| 4 | description 守卫 | omo 有 14 个守卫降低撞车 | matt 官方**无**守卫;撞车风险↑,D1 决策接受 |
| 5 | `extensions/git-guard.ts` 职责 | 替代 omo 的 git-guardrails-claude-code skill | 替代 matt 的 misc/git-guardrails-claude-code skill(因 pi 不识别 Claude Code hooks)|
| 6 | `scripts/migrate-skill-lock.ts` OVERRIDDEN | 1 项(`handoff`)| **25 项**(engineering 18 + productivity 7)|
| 7 | `extensions/write-guard.ts` | description + caller 判定修复 | 仅改 1 行注释引用 docs 路径(实质不动)|
| 8 | `agents/tdd-guide.md` / `agents/code-reviewer.md` | 撤(Lane B)| 撤(理由不变:matt `tdd` / `code-review` skill 接管)|
| 9 | `agents/spec-miner.md` / `agents/explore.md` | 保留(Lane B)| 保留(理由不变:matt 不覆盖 brownfield 反向 / 探索正交)|
| 10 | preset 文件名 | `presets/settings.lane-b.json`(不变)| 同左(不变)|

**关键设计原则**:
1. **不替用户决策**——4 个模板 + 决策树让用户自决
2. **改动可逆**——每个模板都是独立文件,回滚 = cp 上一个模板
3. **复现性优先**——INSTALL.md 6 步明确,cp + deploy.sh 让任何机器能复现
4. **配置即代码**——`presets/` 4 个模板 + `extensions/` 自写 + `agents/` 9 个声明式 subagent

**详细设计 v2 增量**:见 `docs/decisions.md` 决策 10 末尾"v1 → v2 增量变更"表。