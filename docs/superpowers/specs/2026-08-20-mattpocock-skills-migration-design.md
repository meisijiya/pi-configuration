# mattpocock/skills 官方版迁移设计

> **状态**:设计定稿(经 brainstorming 7 问 + agent 跨节审查)
> **日期**:2026-08-20
> **范围**:仅本仓库(`pi-configuration`);**不动 `meisijiya/omo-skills` 那个 fork 仓库**
> **替换目标**:把 Lane B 的 matt skill 装载源从 `meisijiya/omo-skills` 切到 `mattpocock/skills` 官方版,适配 pi 读取

---

## 0. 目标

把 Lane B 的 matt skill 装载源从 `git:github.com/meisijiya/omo-skills`(fork 微调版,带 14 个 description 守卫)切到 `git:github.com/mattpocock/skills`(matt 官方版),**所有 skill 装载逻辑适配 pi 原生读取**(不再用 `cp -r` 手动循环)。

**关键事实**:
- matt 官方仓库 SKILL.md 用 **标准 Anthropic Agent Skills frontmatter**(`name:` + `description:`)——pi 原生支持,格式层**不需要适配**
- pi 装载 `git:` source 时按 convention 自动递归发现 `skills/` 下的 `SKILL.md` 文件夹(`packages.md` §Package Structure)——**不需要 cp -r 适配**
- 真正需要适配的是:**packages filter 限制 bucket**(`misc/` / `recipes/` / `in-progress/` 跳过) + **更新所有引用文案**(`omo-skills` → `mattpocock/skills`)

---

## 1. 决策摘要(7 问结果)

| # | 决策点 | 选择 |
|---|---|---|
| Q1 | 装载方式 | **A** — pi git 直装 + packages filter,删 `INSTALL.md §5a` 的 cp -r 循环 |
| Q2 | 装哪些 skill | **A2** — 25 stable(engineering 18 + productivity 7,跳 misc/recipes) |
| Q3 | `extensions/git-guard.ts` 去留 | **G1** — 保留(职责理由改:替代 matt 的 `misc/git-guardrails-claude-code`,因 pi 不识别 Claude Code hooks)|
| Q4 | `scripts/migrate-skill-lock.ts` | **M1** — `OVERRIDDEN` 表扩到 25 项,全部映射到 `mattpocock/skills` |
| Q5 | 命名层 | **N3** — 完全改名 + 重构文档(`docs/omo-skills-integration.md` 重写为 `docs/mattpocock-skills-integration.md` + 其他 docs 全部同步)|
| Q6 | 回滚/切换专章 | **不写** — 用户一人用,直接切 |
| Q7 | 撞车守卫差异 | **D1** — 接受 matt 官方版无 omo 的 14 description 守卫(撞车风险↑,先接受观察)|

---

## 2. 改动文件清单(共 11 个)

| # | 文件 | 类型 | 改动粒度 |
|---|---|---|---|
| 1 | `presets/settings.lane-b.json` | 配置 | packages 数组中 `git:github.com/meisijiya/omo-skills` 字符串项 → 对象项 `{source, skills}` |
| 2 | `extensions/git-guard.ts` | 扩展 | 仅顶部注释(职责理由更新);正则/逻辑代码 100% 保留 |
| 3 | `scripts/migrate-skill-lock.ts` | 脚本 | `OVERRIDDEN` 表 1 项 → 25 项;迁移判定逻辑改;顶部注释更新 |
| 4 | `extensions/write-guard.ts` | 扩展 | 仅 1 行注释:`docs/omo-skills-integration.md §4.7` → `docs/mattpocock-skills-integration.md §4.7` |
| 5 | `docs/omo-skills-integration.md` | 文档 | **git mv** 到 `docs/mattpocock-skills-integration.md` + 内容重写 |
| 6 | `docs/decisions.md` | 文档 | 决策 10 标题 + 内容(从 omo 改为 matt 官方版,加增量变更日志) |
| 7 | `INSTALL.md` | 文档 | §5 Lane B 额外步骤(删 §5a,改 §5b-d) + §6 验证(改触发语)|
| 8 | `AGENTS.md` | 文档 | §1 触发语 + §2 决策 1 + §4 兼容性表 + §6 文档导航 |
| 9 | `docs/configuration-switching.md` | 文档 | §0 / §2 / §4 / §5 / §7 多处引用 |
| 10 | `README.md` | 文档 | 顶部"方法论"行 + Lane A vs B 描述 + 4 模板表 + 安全 checklist |
| 11 | `deploy.sh` | 脚本 | §6 末尾提示(Lane B 段)|

---

## 3. 逐文件改动规格

### 3.1 `presets/settings.lane-b.json`

**改动 1**:`_comment` 字段

```diff
- "_comment": "Lane B · 部分 extension + matt skill 微调（13 包）。撤 superpowers-zh + pi-simplify，加 omo-skills 装载源。配套撤 tdd-guide/code-reviewer agent，加 git-guard.ts。",
+ "_comment": "Lane B · 部分 extension + mattpocock/skills 官方版（13 包）。撤 superpowers-zh + pi-simplify，装 mattpocock/skills 源（pi convention 自动发现 skills/ 下 25 stable SKILL.md，无需 cp -r）。配套撤 tdd-guide/code-reviewer agent，加 git-guard.ts。",
```

**改动 2**:`packages` 数组最后一项

```diff
-     "git:github.com/meisijiya/omo-skills"
+     {
+       "source": "git:github.com/mattpocock/skills",
+       "skills": ["skills/engineering/*", "skills/productivity/*"]
+     }
```

**packages 数组总数仍为 13**(对象项计 1 项);展开后实际加载 25 个 skill(engineering 18 + productivity 7)。

**验证**: `node -e 'console.log(JSON.parse(require("fs").readFileSync("presets/settings.lane-b.json","utf-8")).packages.length)'` → `13`

---

### 3.2 `extensions/git-guard.ts`

**改动**:仅顶部注释块 3 行替换。

```diff
- // 替代 omo-skills 的 git-guardrails-claude-code（在 pi 里需要重写为 extension 风格）
+ // 替代 mattpocock/skills 的 misc/git-guardrails-claude-code skill。
+ // matt 官方版的 git-guardrails-claude-code skill 是给 Claude Code 写 hooks JSON
+ // (~/.claude/settings.json 的 PreToolUse 配置)。pi 不识别 Claude Code hooks,
+ // 因此在 pi 层用本 extension 兜底：监听 pi.on("tool_call", ...) 事件直接拦截。
```

```diff
- // 适用：仅 Lane B（docs/omo-skills-integration.md §3B.7.2）
- // Lane A 用户不需要这个 extension——superpowers-zh / obra/superpowers / 不装 三种模板都不装 omo-skills。
+ // 适用：仅 Lane B（docs/mattpocock-skills-integration.md §3B.7.2）
+ // Lane A 用户不需要——superpowers-zh / obra/superpowers / 不装 三种模板都不装 matt skill。
```

正则 / `FORBIDDEN` 数组 / `export default function` / ctx.ui.notify 等**所有逻辑代码 100% 保留**。

**验证**: TypeScript 编译 + `diff <(head -30 extensions/git-guard.ts) <(git show HEAD:extensions/git-guard.ts | head -30)` 应仅显示注释差异。

---

### 3.3 `scripts/migrate-skill-lock.ts`

**改动 1**:顶部注释块

```diff
- // migrate-skill-lock.ts (standalone script)
- // 同步 ~/.agents/.skill-lock.json：把被 omo-skills 覆盖的 skill 的 lock 条目
- // 从旧 source（mattpocock/skills）改指向 omo-skills，并更新 skillFolderHash。
+ // migrate-skill-lock.ts (standalone script)
+ // 同步 ~/.agents/.skill-lock.json：把 25 个 mattpocock/skills stable skill 的 lock 条目
+ // 统一指向 mattpocock/skills 源 + 更新 skillFolderHash（git tree SHA）。
+ // 适用于从 omo-skills 时代迁来的用户（lock 中可能含 meisijiya/skills 域条目）。
```

**改动 2**:`OVERRIDDEN` 表 1 项 → 25 项

```diff
- // 被 omo-skills 覆盖的 skill：skill 名 → 新 source + 新 sourceUrl。
- // 未来发现更多被覆盖的 skill，在此处加。
- const OVERRIDDEN: Record<string, { source: string; sourceUrl: string }> = {
-   handoff: {
-     source: "meisijiya/omo-skills",
-     sourceUrl: "https://github.com/meisijiya/omo-skills.git",
-   },
- };
+ // mattpocock/skills 25 个 stable skill → 统一指向 mattpocock/skills 源。
+ // (engineering 18 + productivity 7,跳过 misc/recipes/in-progress)
+ const OVERRIDDEN: Record<string, { source: string; sourceUrl: string }> = {
+   // engineering 18
+   "ask-matt":                      { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "code-review":                   { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "codebase-design":               { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "diagnosing-bugs":               { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "domain-modeling":               { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "grill-with-docs":               { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "implement":                     { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "improve-codebase-architecture": { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "prototype":                     { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "research":                      { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "resolving-merge-conflicts":     { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "setup-matt-pocock-skills":      { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "tdd":                           { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "to-spec":                       { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "to-tickets":                    { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "triage":                        { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "wayfinder":                     { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "wizard":                        { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   // productivity 7
+   "grill-me":                      { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "grilling":                      { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "handoff":                       { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "teach":                         { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "to-questionnaire":              { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "wait-what":                     { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+   "writing-for-agents":            { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
+ };
```

**改动 3**:`migrate()` 函数判定逻辑

```diff
-       if (entry.source === mapping.source && entry.skillFolderHash === sha) {
-         console.log(`✓  ${skill} 已迁移过 (source: ${mapping.source}, sha: ${sha})`);
+       // 已对齐到 mattpocock/skills:跳过;其他源(包括 meisijiya/omo-skills / 其他):更新
+       if (entry.source === "mattpocock/skills" && entry.skillFolderHash === sha) {
+         console.log(`✓  ${skill} 已对齐到 mattpocock/skills (sha: ${sha})`);
```

其他代码结构(`fetchTree` / `getSkillFolderHashFromTree` / 备份逻辑 / `writeFileSync`)**不动**。

**验证**:
- TypeScript: `npx tsc --noEmit scripts/migrate-skill-lock.ts`(若无 tsc,跳过)
- 逻辑单元测试(可选): 准备 mock lock JSON(条目 source= `"meisijiya/omo-skills"`),跑 `SKILL_LOCK_PATH=/tmp/mock-lock.json node scripts/migrate-skill-lock.ts`,确认输出 `🔄 handoff: source meisijiya/omo-skills → mattpocock/skills`

---

### 3.4 `extensions/write-guard.ts`

**改动**:仅 1 行注释(§4.7 引用)。

```diff
- // 每一次 write/edit——实测已复现（见 docs/omo-skills-integration.md §4.7）。
+ // 每一次 write/edit——实测已复现（见 docs/mattpocock-skills-integration.md §4.7）。
```

**不动**:`STRICT` 环境变量 / `isPathAllowed` / `pi.on("tool_call", ...)` / `block: true` 逻辑代码。

**验证**:`grep -n 'omo-skills-integration' extensions/write-guard.ts` 应无输出。

---

### 3.5 `docs/omo-skills-integration.md` → `docs/mattpocock-skills-integration.md`

**改动 1**:git rename(保留 rename detection)

```bash
git mv docs/omo-skills-integration.md docs/mattpocock-skills-integration.md
```

**改动 2**:全文内容重写(789 行 → 新文档)

**保留的章节骨架**(标题同步改):
- `# omo-skills 集成最终设计(双路线版 · Lane A & Lane B)` → `# mattpocock/skills 官方版集成最终设计(双路线版 · Lane A & Lane B)`
- §0 TL;DR
- §1 现状盘点(§1.1 / §1.2 / §1.3 / §1.4 / §1.5)
- §2 冲突分析(§2.1 / §2.2 / §2.3)
- §3A Lane A
- §3B Lane B
- §4 风险与未决问题
- §5 复审指令
- §6 附录
- §7 升级说明

**fact 层差异更新**(从 omo 改为 matt 官方版):

| 节 | 旧(omo) | 新(matt 官方)|
|---|---|---|
| §0 第 1 点 | "omo-skills 25 个 skill 全部 SKILL.md 格式,可直接 cp -r" | "pi 通过 packages filter 装载 mattpocock/skills 官方版;源 = `git:github.com/mattpocock/skills`;装载机制 = settings.json `packages` 数组的 object-form 项 + `skills: ["skills/engineering/*", "skills/productivity/*"]`;pi convention 递归发现,无需 cp -r" |
| §1.1 表格 | "12 个外部 npm 包 + 2 个 git 包" | "12 个外部 npm 包 + 1 个 git 装载源 + `pi` convention 自动发现 matt 仓库 `skills/` 下 25 stable" |
| §1.2 | "omo-skills 目标层(25 skill)" | "mattpocock/skills 目标层(25 stable skill)" + engineering 18 + productivity 7 实际清单 |
| §1.3 装载源 | "源仓库 = `https://github.com/meisijiya/omo-skills`;装载方式 = INSTALL.md §5 pi 章节:cp -r 循环" | "源仓库 = `https://github.com/mattpocock/skills`;装载方式 = pi `git:` 装载源 + packages filter(对象形式)|
| §1.4 用户状态 | "47 + 1 来源分布" | "新事实:matt 全新源,无 omo 时代 lock 历史包袱;但用户从 omo 迁来时,旧 lock 中可能含 `meisijiya/skills` 域条目;新脚本 OVERRIDDEN 表覆盖 25 个 stable skill" |
| §2.2 | "omo-skills 的 14 个 description 守卫降低 A 类风险" | "matt 官方版无 description 守卫(撞车风险↑,由 D1 决策接受)" |
| §3B.1 install-packages.sh | PKGS 数组 14 → 13 项(删 2 加 1) | **整段改为** §3B.3 `presets/settings.lane-b.json` 草案(对象形式)|
| §3B.3 settings.json | 对象形式 packages 数组最后一项 `"git:github.com/meisijiya/omo-skills"` | 改为对象形式 `{source: "git:github.com/mattpocock/skills", skills: [...]}` |
| §3B.4 deploy.sh | "§4 PKGS 数组按 §3B.1 列表更新" | "deploy.sh §4 PKGS 自动从 preset 读取(已支持对象项,无需改 deploy.sh 主体)" |
| §3B.7.2 git-guard | "替代 omo-skills 的 git-guardrails-claude-code" | "替代 mattpocock/skills 的 misc/git-guardrails-claude-code(matt 同样有 skill,但 pi 不识别 Claude Code hooks)" |
| §3B.7.3 migrate-skill-lock | "OVERRIDDEN 列表 1 项(handoff)" | "OVERRIDDEN 表扩到 25 项(engineering 18 + productivity 7),全部映射 `mattpocock/skills`;迁移判定:source === mattpocock/skills && hash === sha 则跳过,否则更新" |
| §4.4 | "63 条 / 47 meisijiya / 1 mattpocock 分布;cp -r 覆盖 handoff 后 lock 不更新" | "matt 全新源,无 omo 时代 lock 历史包袱;从 omo 迁来时旧 lock 中 meisijiya/skills 域条目由新脚本 OVERRIDDEN 表覆盖 25 stable,其余 omo 时代孤儿(in-progress 等)建议手动 `npx skills@latest update --prune` 或保留" |
| §4.5 | "omo-skills 的 14 个 description 守卫" | "matt 官方版无 description 守卫:撞车风险由 D1 决策接受;如有撞车反馈给 mattpocock/skills 上游" |
| §6 附录 | "omo-skills 25 skill 清单" | "mattpocock/skills 25 stable skill 清单(engineering 18 = ... + productivity 7 = ...)" |

**验证**:
- `grep -n 'omo-skills\|meisijiya' docs/mattpocock-skills-integration.md` 应无输出(允许在"升级说明"章节出现"升级自 omo-skills-integration.md"的描述,因该句本身指代历史)
- `git log --follow docs/mattpocock-skills-integration.md` 应显示 rename history

---

### 3.6 `docs/decisions.md`

**改动 1**:决策 10 标题

```diff
- ## 决策 10：omo-skills 集成（Lane B 双路线版）
+ ## 决策 10：mattpocock/skills 官方版集成（Lane B 双路线版）
```

**改动 2**:决策 10 表格"加 git 源"行

```diff
- | 加 git 源 | 0 | 1（meisijiya/omo-skills） |
+ | 加 git 源 | 0 | 1（mattpocock/skills 官方版,经 packages filter 装载 25 stable） |
```

**改动 3**:决策 10 表格"加自写 extension"行第 2 项

```diff
- | 加自写 extension | 0 | 2（git-guard.ts / migrate-skill-lock.ts） |
+ | 加自写 extension | 0 | 2（git-guard.ts 替代 matt 的 misc/git-guardrails-claude-code skill；migrate-skill-lock.ts OVERRIDDEN 表 1 项 → 25 项） |
```

**改动 4**:决策 10 表格"修 write-guard.ts"行(若存在)

```diff
- | 修 write-guard.ts | 是（description + caller 判定） | 是 |
+ | 修 write-guard.ts | 仅改 1 行注释引用 docs 路径（实质不动） | 同左 |
```

**改动 5**:决策 10 表格"对本仓库的影响"全部链接

```diff
- | [docs/omo-skills-integration.md](omo-skills-integration.md) | 新增（完整设计，769 行 / 41.9K） |
+ | [docs/mattpocock-skills-integration.md](mattpocock-skills-integration.md) | 重写（从 omo 改为 matt 官方版；保留骨架,fact 层差异替换） |
```

**改动 6**:决策 10 末尾"详细设计"链接

```diff
- **详细设计**：[docs/omo-skills-integration.md](omo-skills-integration.md)（含 3 lane 复审反馈、§2.2 修正冲突评级、§3B.7 三段自写 extension 详细设计、§4 风险与缓解按 lane 标注）
+ **详细设计**：[docs/mattpocock-skills-integration.md](mattpocock-skills-integration.md)
```

**改动 7**:决策 10 末尾新增"增量变更日志"段

```markdown
### v1 → v2 增量变更(omo → matt 官方版)

| 维度 | v1(omo) | v2(matt 官方) |
|---|---|---|
| 装载源 | `git:github.com/meisijiya/omo-skills` | `git:github.com/mattpocock/skills`(官方)|
| 装载机制 | `pi install` + INSTALL.md §5a `cp -r skills/<bucket>/<name>` 循环 | `pi install` + packages filter(`skills: ["skills/engineering/*", "skills/productivity/*"]`);pi convention 自动递归发现,**无需 cp -r** |
| Skill 数量 | 25(omo fork 的 25 stable)| 25(matt 官方 stable:engineering 18 + productivity 7)|
| description 守卫 | omo 有 14 个守卫降低撞车 | matt 官方无守卫;撞车风险↑,由 D1 决策接受 |
| `extensions/git-guard.ts` 职责 | 替代 omo 的 git-guardrails-claude-code skill | 替代 matt 的 misc/git-guardrails-claude-code skill(因 pi 不识别 Claude Code hooks)|
| `scripts/migrate-skill-lock.ts` OVERRIDDEN | 1 项(`handoff`)| 25 项(engineering 18 + productivity 7)|
| `extensions/write-guard.ts` | description + caller 判定修复 | 仅改 1 行注释引用 docs 路径 |
| `agents/tdd-guide.md` / `agents/code-reviewer.md` | 撤(Lane B)| 撤(理由不变:matt `tdd` / `code-review` skill 接管)|
```

**验证**:`grep -n 'omo-skills\|meisijiya' docs/decisions.md` 仅允许出现"v1(omo)" 这种明确指代历史快照的语境。

---

### 3.7 `INSTALL.md`

**改动 1**:§5 Lane B 额外步骤整段重写(删除 §5a cp -r 循环)

```diff
-     # 5a. 装载 omo-skills 25 个 skill 到 ~/.pi/agent/skills/
-     # deploy.sh 已经 pi install 了 git:github.com/meisijiya/omo-skills
-     # 但 pi install 只是声明源，实际装载需要 cp -r（INSTALL.md §5a-Lane-B）
-     cd /path/to/omo-skills   # 用户需先 git clone
-     for s in \
-       ask-matt code-review codebase-design diagnosing-bugs \
-       domain-modeling grill-with-docs implement \
-       improve-codebase-architecture prototype research \
-       resolving-merge-conflicts setup-matt-pocock-skills tdd \
-       to-spec to-tickets triage wayfinder wizard; do
-       cp -r skills/engineering/$s ~/.pi-test/agent/skills/   # 实际用 ~/.pi/agent/skills/
-     done
-     for s in \
-       grill-me grilling handoff teach to-questionnaire \
-       wait-what writing-for-agents; do
-       cp -r skills/productivity/$s ~/.pi-test/agent/skills/   # 实际用 ~/.pi/agent/skills/
-     done
-     echo "✅ omo-skills 25 skill 已装载"
-
-     # 5b. 跑 /skill:setup-matt-pocock-skills 强制 init
-     # （让 Agent 帮用户跑，或用户自己启动 pi 跑）
-     echo "📋 启动 pi 跑 /skill:setup-matt-pocock-skills 强制 init"
-
-     # 5c. 跑 scripts/migrate-skill-lock.ts（手动或 cron）
-     # （本仓 deploy.sh 不自动跑——避免破坏用户 lock 文件）
-     echo "📋 手动跑：node scripts/migrate-skill-lock.ts（同步 lock 文件）"
-
-     # 5d. 跑 git-guard.ts smoke test（参考 docs/omo-skills-integration.md §5.2）
-     echo "📋 跑 smoke test 验证 Lane B 全部配置生效"
+     # 5a. 装载源已 deploy.sh pi install；pi convention 自动发现 skills/engineering/* + skills/productivity/* 25 stable
+     #     此步幂等(可重复)
+     pi update --extensions
+
+     # 5b. 启动 pi 跑 /skill:setup-matt-pocock-skills 强制 init
+     echo "📋 启动 pi 跑 /skill:setup-matt-pocock-skills 强制 init"
+
+     # 5c. 跑 scripts/migrate-skill-lock.ts 把 25 个 stable skill 的 lock 对齐到 mattpocock/skills
+     echo "📋 手动跑：node scripts/migrate-skill-lock.ts（从 omo 迁来的用户必跑；新装用户 lock 已对齐,可跳）"
+
+     # 5d. 跑 smoke test（参考 docs/mattpocock-skills-integration.md §5.2）
+     echo "📋 跑 smoke test 验证 Lane B 全部配置生效"
```

**改动 2**:§6 验证 Lane B 段

```diff
- #   Lane B: 13 个 package（含 meisijiya/omo-skills）
+ #   Lane B: 13 个 package（含 mattpocock/skills 官方版；展开装载 25 stable skill）
```

**改动 3**:§6 验证 Lane B 段后续行

```diff
- > /skill:setup-matt-pocock-skills # ✅ 已 init（§5b 跑过）
+ > /skill:setup-matt-pocock-skills # ✅ 已 init（§5b 跑过；matt 官方版 skill 触发,内容同 omo）
```

**验证**:`grep -n 'omo-skills\|meisijiya\|cp -r.*skills' INSTALL.md` 应无输出(允许 §3 决策树表里 "omo" 字样作为历史参照,**不**)。

---

### 3.8 `AGENTS.md`

**改动 1**:§1 触发语表 1 行

```diff
- | "我想用 omo-skills" / "我想用 superpowers-zh" | 引导到 Lane 选择 + superpowers 选择 |
+ | "我想用 matt skill 体系" / "我想用 superpowers-zh" | 引导到 Lane 选择 + superpowers 选择 |
```

**改动 2**:§2 决策 1 Lane A vs Lane B 表 4 行

```diff
-   - 不引入 omo-skills / matt skill 体系
+   - 不引入 matt skill 体系
```

```diff
-   - 加 `git:github.com/meisijiya/omo-skills` 装载源 + 新写 `extensions/git-guard.ts` + `scripts/migrate-skill-lock.ts`
+   - 加 `git:github.com/mattpocock/skills` 装载源(经 packages filter 装 25 stable)+ 自写 `extensions/git-guard.ts`(替代 matt 的 misc/git-guardrails-claude-code skill)+ `scripts/migrate-skill-lock.ts`(OVERRIDDEN 表 25 项)
```

```diff
-   - 装 omo-skills 25 个 skill（带 14 个 description 守卫降低撞车）
+   - 装 mattpocock/skills 25 stable skill(engineering 18 + productivity 7,跳 misc/recipes;**无 description 守卫**,撞车风险↑,D1 决策接受)
```

```diff
- > "你想选 Lane A 还是 Lane B？A 是纯 extension 不变，B 是撤冲突项加装 omo-skills 25 skill。详见 [docs/omo-skills-integration.md](docs/omo-skills-integration.md) §0 TL;DR。"
+ > "你想选 Lane A 还是 Lane B？A 是纯 extension 不变，B 是撤冲突项加装 mattpocock/skills 25 stable skill。详见 [docs/mattpocock-skills-integration.md](docs/mattpocock-skills-integration.md) §0 TL;DR。"
```

**改动 3**:§4 兼容性表 1 行

```diff
- | 已有 omo-skills | cp `presets/settings.lane-b.json`，跑 INSTALL.md §5b-d Lane B 额外步骤 |
+ | 已有 matt skill 体系 | cp `presets/settings.lane-b.json`，跑 INSTALL.md §5b-d Lane B 额外步骤 |
```

**改动 4**:§6 文档导航表 5 行

```diff
- | "Lane A vs B 区别？" | [docs/omo-skills-integration.md §0 TL;DR](docs/omo-skills-integration.md#0-tldr双路线版) |
+ | "Lane A vs B 区别？" | [docs/mattpocock-skills-integration.md §0 TL;DR](docs/mattpocock-skills-integration.md#0-tldr双路线版) |
```

(其余 4 行类同,链接 `docs/omo-skills-integration.md` → `docs/mattpocock-skills-integration.md`)

**改动 5**:末尾"文档结束"句

```diff
- **文档结束。本协议是 Agent 引导用户的入口——所有具体执行步骤见 [INSTALL.md](INSTALL.md)，所有设计决策见 [docs/omo-skills-integration.md](docs/omo-skills-integration.md) + [docs/decisions.md](docs/decisions.md)。**
+ **文档结束。本协议是 Agent 引导用户的入口——所有具体执行步骤见 [INSTALL.md](INSTALL.md)，所有设计决策见 [docs/mattpocock-skills-integration.md](docs/mattpocock-skills-integration.md) + [docs/decisions.md](docs/decisions.md)。**
```

**验证**:`grep -n 'omo-skills\|meisijiya' AGENTS.md` 应无输出(允许 §1 "我想用" 表里出现触发语历史说明,但本设计无)。

---

### 3.9 `docs/configuration-switching.md`

**改动 1**:§0 四个 preset 表 Lane B 行

```diff
- | `settings.lane-b.json` | B | 撤除，改用 `git:github.com/meisijiya/omo-skills`（25 skill） | 13 | 撤 `tdd-guide` / `code-reviewer`；加 `git-guard.ts` + `migrate-skill-lock.ts` |
+ | `settings.lane-b.json` | B | 撤除，改用 `git:github.com/mattpocock/skills` 官方版（25 stable skill） | 13 | 撤 `tdd-guide` / `code-reviewer`；加 `git-guard.ts` + `migrate-skill-lock.ts`（OVERRIDDEN 25 项） |
```

**改动 2**:§2 切换矩阵 A→B / B→A 两行

```diff
- | A → B | `npm:superpowers-zh`（或 obra）+ `npm:pi-simplify` | `git:github.com/meisijiya/omo-skills` | 撤 2 agent + 加 2 extension + 装载 omo-skills（见 §4） |
+ | A → B | `npm:superpowers-zh`（或 obra）+ `npm:pi-simplify` | `git:github.com/mattpocock/skills` | 撤 2 agent + 加 2 extension + 装载 matt skill（见 §4） |
```

```diff
- | B → A | `git:github.com/meisijiya/omo-skills` | `npm:superpowers-zh@latest`（或 obra）+ `npm:pi-simplify` | 加回 2 agent（见 §5） |
+ | B → A | `git:github.com/mattpocock/skills` | `npm:superpowers-zh@latest`（或 obra）+ `npm:pi-simplify` | 加回 2 agent（见 §5） |
```

**改动 3**:§4 标题 + §4.3 + §4.6 + §4.7 + §4.8 多行

```diff
- ## 4. Lane A → Lane B（装 omo-skills 25 skill）
+ ## 4. Lane A → Lane B（装 mattpocock/skills 25 stable skill）
```

```diff
- # 4.3 装 omo-skills 装载源
- pi install git:github.com/meisijiya/omo-skills
+ # 4.3 装 mattpocock/skills 装载源(经 packages filter 装 25 stable)
+ pi install git:github.com/mattpocock/skills
```

```diff
- # 4.6 装载 omo-skills 25 个 skill（详见 INSTALL.md §5a）
- #     需要先 clone omo-skills 仓库，然后 cp -r skills/engineering/* 和 skills/productivity/*
+ # 4.6 装载 25 stable skill(pi convention 自动发现；详见 INSTALL.md §5a)
```

```diff
- # 4.7 同步 .skill-lock.json（被 omo 覆盖的 skill 改指向 omo-skills + 更新 tree SHA）
+ # 4.7 同步 .skill-lock.json(把 25 stable skill 对齐到 mattpocock/skills 源 + 更新 tree SHA)
```

**改动 4**:§5.2

```diff
- # 5.2 撤 omo-skills
- pi remove git:github.com/meisijiya/omo-skills
+ # 5.2 撤 mattpocock/skills
+ pi remove git:github.com/mattpocock/skills
```

**改动 5**:§7.1 末尾 + §7.3 标题与正文

```diff
- Lane B 的 omo-skills 25 skill 装载、`/skill:setup-matt-pocock-skills`、`migrate-skill-lock.ts` 仍需手动（§4.6–4.8）。
+ Lane B 的 mattpocock/skills 25 stable skill 装载（pi convention 自动）、`/skill:setup-matt-pocock-skills`、`migrate-skill-lock.ts` 仍需手动（§4.6–4.8）。
```

```diff
- ### 7.3 omo-skills 装载路径 + migrate-skill-lock
+ ### 7.3 mattpocock/skills 装载路径 + migrate-skill-lock
```

```diff
- `migrate-skill-lock.ts` 现在**通过 GitHub API 拉取 omo-skills 的 tree 取 tree SHA**（与 `npx skills update` 比对逻辑一致），
+ `migrate-skill-lock.ts` 现在**通过 GitHub API 拉取 mattpocock/skills 的 tree 取 tree SHA**（与 `npx skills update` 比对逻辑一致），
```

**验证**:`grep -n 'omo-skills\|meisijiya\|cp -r.*skills' docs/configuration-switching.md` 应无输出。

---

### 3.10 `README.md`

**改动 1**:顶部 "## 给 AI Agent 使用" 第 2 点

```diff
-    - **Lane A 纯 extension**（保留 14 项 PKGS 不变） vs **Lane B 部分 extension + matt skill 微调**（撤冲突项加 omo-skills 25 skill）
+    - **Lane A 纯 extension**（保留 14 项 PKGS 不变） vs **Lane B 部分 extension + matt skill 官方版**（撤冲突项加 mattpocock/skills 25 stable skill）
```

**改动 2**:4 模板表 Lane B 行

```diff
- | `settings.lane-b.json` | B | 13 | 装 omo-skills 25 skill 的微调路线 |
+ | `settings.lane-b.json` | B | 13 | 装 mattpocock/skills 25 stable skill 的官方版微调路线 |
```

**改动 3**:完整设计背景行

```diff
- **完整设计背景**：[docs/omo-skills-integration.md](docs/omo-skills-integration.md)（3 lane 独立复审后的双路线版）。
+ **完整设计背景**：[docs/mattpocock-skills-integration.md](docs/mattpocock-skills-integration.md)（3 lane 独立复审后的双路线版；装载源 = mattpocock/skills 官方版）。
```

**改动 4**:"## 安全性" 段 `pi list | grep '^git:'` 注释

```diff
- # 确认 git 包是 trusted source
- pi list | grep '^git:'    # 只应出现 2 个：codegraph-pi / pi-lsp-client（superpowers 走 npm）
+ # 确认 git 包是 trusted source
+ pi list | grep '^git:'    # Lane A: 2 个（codegraph-pi / pi-lsp-client，superpowers 走 npm）；Lane B: 3 个（+ mattpocock/skills）
```

**验证**:`grep -n 'omo-skills\|meisijiya/omo-skills' README.md` 应无输出(允许 §`## 这是什么` "## 安全性" 段文字里"meisijiya/pi-configuration.git"(仓库地址)**保留**,非 skill 引用)。

---

### 3.11 `deploy.sh`

**改动**:§6 Lane B 提示段重写

```diff
- if [ "$USER_CHOICE" = "lane-b" ]; then
- cat <<EOF
-
- ${GREEN}✅ 部署完成（Lane B）${NC}
-    备份目录：$BACKUP_DIR
-
- Lane B 还有 4 个额外步骤（详见 INSTALL.md §5a-d）：
-    5a. 装载 omo-skills 25 个 skill 到 ~/.pi/agent/skills/
-    5b. 启动 pi 跑 /skill:setup-matt-pocock-skills 强制 init
-    5c. 跑 node scripts/migrate-skill-lock.ts（同步 lock）
-    5d. 跑 smoke test 验证 git-guard 生效
-
-    验证：pi
-      /simplify            # ❌ 期望未知命令（已撤 pi-simplify）
-      /skill:code-review   # ✅ omo code-review
- EOF
- else
+ if [ "$USER_CHOICE" = "lane-b" ]; then
+ cat <<EOF
+
+ ${GREEN}✅ 部署完成（Lane B）${NC}
+    备份目录：$BACKUP_DIR
+
+ Lane B 还有 3 个额外步骤（详见 INSTALL.md §5a-d）：
+    5a. pi update --extensions（装载源已 deploy.sh 装；pi convention 自动发现 25 stable skill）
+    5b. 启动 pi 跑 /skill:setup-matt-pocock-skills 强制 init
+    5c. 跑 node scripts/migrate-skill-lock.ts（把 25 stable skill 的 lock 对齐到 mattpocock/skills；从 omo 迁来的用户必跑）
+    跑 smoke test 验证 git-guard 生效（参考 docs/mattpocock-skills-integration.md §5.2）
+
+    验证：pi
+      /simplify            # ❌ 期望未知命令（已撤 pi-simplify）
+      /skill:code-review   # ✅ matt code-review
+ EOF
+ else
```

**不动**:deploy.sh §3 部署 agents 段(Lane B 撤 tdd-guide/code-reviewer 逻辑保留)、§4 跑 pi install 段(自动从 preset 读 packages,已支持对象项)。

**验证**:`grep -n 'omo-skills\|meisijiya' deploy.sh` 应无输出。

---

## 4. 验证清单(实施后跑)

```bash
# 1. 全文 omo-skills / meisijiya 引用清零(skill 相关)
grep -rn 'omo-skills\|meisijiya' \
  presets/ INSTALL.md AGENTS.md README.md deploy.sh \
  docs/decisions.md docs/configuration-switching.md docs/mattpocock-skills-integration.md \
  extensions/ scripts/ \
  | grep -v 'meisijiya/pi-configuration.git\|meisijiya <' \
  && echo "❌ 仍有 omo-skills / meisijiya 残留" \
  || echo "✅ 已清零（除仓库地址外）"

# 2. settings.lane-b.json packages 数量 = 13
node -e 'console.log(require("./presets/settings.lane-b.json").packages.length)' \
  | grep -qx 13 && echo "✅ lane-b PKGS = 13" || echo "❌ lane-b PKGS != 13"

# 3. migrate-skill-lock.ts OVERRIDDEN 表 = 25 项
grep -c 'source: "mattpocock/skills"' scripts/migrate-skill-lock.ts \
  | grep -qx 25 && echo "✅ OVERRIDDEN = 25" || echo "❌ OVERRIDDEN != 25"

# 4. write-guard.ts 无 omo 引用
grep -n 'omo-skills-integration' extensions/write-guard.ts \
  && echo "❌ write-guard.ts 仍引用 omo-skills-integration" \
  || echo "✅ write-guard.ts 已改"

# 5. docs/omo-skills-integration.md 已重命名
[ -f docs/omo-skills-integration.md ] && echo "❌ 旧文档未删除" || echo "✅ 旧文档已删"
[ -f docs/mattpocock-skills-integration.md ] && echo "✅ 新文档存在" || echo "❌ 新文档缺失"

# 6. JSON 语法
node -e 'JSON.parse(require("fs").readFileSync("presets/settings.lane-b.json","utf-8")); console.log("✅ lane-b.json valid")'

# 7. shellcheck
command -v shellcheck >/dev/null && shellcheck deploy.sh install-packages.sh \
  && echo "✅ shellcheck pass" || echo "⚠️  shellcheck 未跑或失败"

# 8. git rename detection
git diff --stat --find-renames HEAD -- docs/ | grep -E 'omo.*→.*mattpocock' \
  && echo "✅ git rename detected" || echo "⚠️  git rename 未检测到(可手动 git mv 重做)"
```

---

## 5. 实施风险(已在 agent 审查中识别)

| # | 风险 | 等级 | 缓解 |
|---|---|---|---|
| R1 | pi packages filter 的 `["skills/engineering/*", "skills/productivity/*"]` glob 是否真支持 | 中 | 已查 pi `packages.md` §Package Filtering,文档明确支持对象形式 + glob patterns。**已验证可行** |
| R2 | 用户 lock 中可能含 omo 时代 47 条 meisijiya/skills 条目,新脚本 OVERRIDDEN 表覆盖 25 个,其余 22 条仍是孤儿 | 中 | §3B.7.3 末尾加提示"其余 omo 时代孤儿记录建议手动 `npx skills@latest update --prune` 或保留" |
| R3 | 用户已有 omo 时代 handoff 目录,pi 装载优先级:用户 `~/.pi/agent/skills/` 优先于 packages 源 | 低 | 在 §3B.7.3 加提示"如需切到 matt 版 handoff,删旧目录后跑 pi update" |
| R4 | `git rename` 检测依赖内容相似度 | 低 | 用 `git mv` 保留 rename detection;若失败可手动重做 |
| R5 | 用户网络必须能访问 api.github.com(`migrate-skill-lock.ts` 调 GitHub API) | 低 | 该依赖已存在,不在新增 |

---

## 6. 范围确认

本设计仅涉及**本仓库**(`pi-configuration`)的 11 个文件改动。不涉及:
- `meisijiya/omo-skills` 仓库(原作者维护,不修改)
- `mattpocock/skills` 仓库(上游官方版,不修改)
- pi 本身(不动)
- 用户的 `~/.pi/agent/`(deploy.sh 部署时不触动用户已有文件,只覆盖 6 个标准配置文件)

---

**文档结束。本设计经 brainstorming 7 问 + general-purpose agent 跨节审查后定稿。下一步: writing-plans 技能生成实施计划,然后执行。**