# mattpocock/skills 官方版迁移实施计划

> **面向 AI 代理的工作者：** 必需子技能：使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 逐任务实现此计划。步骤使用复选框（`- [ ]`）语法来跟踪进度。

**目标：** 把 Lane B 的 matt skill 装载源从 `meisijiya/omo-skills` 切到 `mattpocock/skills` 官方版,所有 skill 装载逻辑适配 pi 原生读取(改 packages filter,删 cp -r 循环)

**架构：** 仅动本仓库 11 个文件。装载机制从"pi install 源 + cp -r 循环"改为"pi install 源 + settings.json packages 对象项 + packages filter(pi convention 自动递归发现 skills/ 下 SKILL.md)"。同步更新 8 个文档/部署层的引用文案。

**技术栈：** pi packages filter(`{source, skills}` 对象形式);git rename(保留 history);TypeScript migration script(扩 OVERRIDDEN 表 1 → 25)。

**设计文档：** [`docs/superpowers/specs/2026-08-20-mattpocock-skills-migration-design.md`](../specs/2026-08-20-mattpocock-skills-migration-design.md)

---

## 范围与不在范围内

**在范围内(11 个文件):**
1. `presets/settings.lane-b.json`(配置)
2. `extensions/git-guard.ts`(扩展)
3. `scripts/migrate-skill-lock.ts`(脚本)
4. `extensions/write-guard.ts`(扩展)
5. `docs/omo-skills-integration.md` → `docs/mattpocock-skills-integration.md`(文档)
6. `docs/decisions.md`(文档)
7. `INSTALL.md`(文档)
8. `AGENTS.md`(文档)
9. `docs/configuration-switching.md`(文档)
10. `README.md`(文档)
11. `deploy.sh`(脚本)

**不在范围:** `meisijiya/omo-skills` 仓库 / `mattpocock/skills` 仓库 / pi 本身 / 用户 `~/.pi/agent/`(deploy.sh 部署时不触动)

---

## 任务拆分(11 个文件 = 11 任务 + 1 总验证)

### 任务 1:`presets/settings.lane-b.json` packages 改造

**文件:** 修改 `presets/settings.lane-b.json`

- [ ] **步骤 1:改前 grep 确认起点**

```bash
grep -n 'omo-skills\|meisijiya' presets/settings.lane-b.json
```

预期:2 行匹配(`_comment` + packages 数组最后一项)

- [ ] **步骤 2:改 `_comment` 字段**

用 `edit` 工具,oldText 匹配当前 `_comment`,newText 见 [设计文档 §3.1 改动 1](../specs/2026-08-20-mattpocock-skills-migration-design.md#31-presetssettingslane-bjson)

- [ ] **步骤 3:packages 数组最后一项改为对象项**

用 `edit` 工具,oldText 匹配 `"git:github.com/meisijiya/omo-skills"`,newText 见 [设计文档 §3.1 改动 2](../specs/2026-08-20-mattpocock-skills-migration-design.md#31-presetssettingslane-bjson)

- [ ] **步骤 4:验证 JSON 语法 + packages 数量**

```bash
node -e 'const d=JSON.parse(require("fs").readFileSync("presets/settings.lane-b.json","utf-8")); console.log("packages =", d.packages.length); console.log("last item:", JSON.stringify(d.packages[d.packages.length-1]));'
```

预期:`packages = 13` + 最后一项含 `source: "git:github.com/mattpocock/skills"` 与 `skills: [...]`

- [ ] **步骤 5:验证 omo 引用清零**

```bash
grep -n 'omo-skills\|meisijiya' presets/settings.lane-b.json
```

预期:无输出

- [ ] **步骤 6:Commit**

```bash
git add presets/settings.lane-b.json
git commit -m "feat(preset): lane-b 装载源切换到 mattpocock/skills 官方版

- packages 数组最后一项从字符串改为对象形式
- 用 pi packages filter 限定 skills/engineering/* + skills/productivity/*
- 跳过 misc/ / recipes/ / in-progress/(详见设计文档)"
```

---

### 任务 2:`extensions/git-guard.ts` 顶部注释更新

**文件:** 修改 `extensions/git-guard.ts`(仅顶部注释,正则/逻辑代码 100% 保留)

- [ ] **步骤 1:改前确认逻辑代码不变**

```bash
grep -n 'FORBIDDEN\|export default function\|pi.on' extensions/git-guard.ts
```

预期:看到 5 条 FORBIDDEN + 1 个 export default + 1 个 pi.on

- [ ] **步骤 2:改"替代 omo-skills..."注释**

用 `edit` 工具,oldText 匹配第 3 行附近,newText 见 [设计文档 §3.2](../specs/2026-08-20-mattpocock-skills-migration-design.md#32-extensionsgit-guardts)

- [ ] **步骤 3:改"适用:仅 Lane B..."两行注释**

用 `edit` 工具,oldText 匹配第 22-23 行,newText 见 [设计文档 §3.2](../specs/2026-08-20-mattpocock-skills-migration-design.md#32-extensionsgit-guardts)

- [ ] **步骤 4:验证正则/逻辑代码未动**

```bash
git diff -- extensions/git-guard.ts | grep -E '^[+-]' | grep -v '^[+-]{3}' | grep -vE '^[+-].*omo-skills|^[+-].*meisijiya|^[+-].*Lane B|^[+-].*matt 官方|^[+-].*docs/'
```

预期:无输出(diff 仅是注释 + 引用文案)

- [ ] **步骤 5:验证 omo 引用清零**

```bash
grep -n 'omo-skills\|meisijiya' extensions/git-guard.ts
```

预期:无输出

- [ ] **步骤 6:Commit**

```bash
git add extensions/git-guard.ts
git commit -m "docs(extension): git-guard 注释改指 matt 官方版 git-guardrails-claude-code

正则与逻辑代码 100% 保留(与 omo/matt 装载源无关)。
pi 不识别 Claude Code hooks,本 extension 仍是 pi 层兜底。"
```

---

### 任务 3:`scripts/migrate-skill-lock.ts` 重写

**文件:** 修改 `scripts/migrate-skill-lock.ts`

- [ ] **步骤 1:改前 grep 起点**

```bash
grep -n 'omo-skills\|meisijiya\|OVERRIDDEN' scripts/migrate-skill-lock.ts
```

预期:4 处 omo 引用 + 1 处 OVERRIDDEN 表定义

- [ ] **步骤 2:改顶部注释**

用 `edit` 工具,oldText 匹配前 3 行注释,newText 见 [设计文档 §3.3 改动 1](../specs/2026-08-20-mattpocock-skills-migration-design.md#33-scriptsmigrate-skill-lockts)

- [ ] **步骤 3:改 OVERRIDDEN 表(1 项 → 25 项)**

用 `edit` 工具,oldText 匹配整个 `OVERRIDDEN` 表定义(含 `handoff` 单项),newText 见 [设计文档 §3.3 改动 2](../specs/2026-08-20-mattpocock-skills-migration-design.md#33-scriptsmigrate-skill-lockts)

- [ ] **步骤 4:改 migrate() 函数判定逻辑**

用 `edit` 工具,oldText 匹配原 `if (entry.source === mapping.source && entry.skillFolderHash === sha)` 那段,newText 见 [设计文档 §3.3 改动 3](../specs/2026-08-20-mattpocock-skills-migration-design.md#33-scriptsmigrate-skill-lockts)

- [ ] **步骤 5:验证 OVERRIDDEN 项数 = 25**

```bash
grep -c 'source: "mattpocock/skills"' scripts/migrate-skill-lock.ts
```

预期:`25`

- [ ] **步骤 6:验证 omo 引用清零**

```bash
grep -n 'omo-skills\|meisijiya' scripts/migrate-skill-lock.ts
```

预期:无输出

- [ ] **步骤 7:类型检查(可选)**

```bash
cd /home/ljh2923/pi-workspace/pi配置
npx --yes -p typescript tsc --noEmit --target es2022 --module esnext --moduleResolution bundler --allowImportingTsExtensions scripts/migrate-skill-lock.ts 2>&1 | head -30
```

预期:无类型错误(可能有 'Cannot find module' 等环境警告,可忽略)

- [ ] **步骤 8:Commit**

```bash
git add scripts/migrate-skill-lock.ts
git commit -m "feat(script): migrate-skill-lock OVERRIDDEN 表扩到 25 项

- engineering 18 + productivity 7 全部映射到 mattpocock/skills 源
- 迁移判定改为 source === 'mattpocock/skills' 跳过(其他源全部更新)
- 适用于从 omo-skills 时代迁来的用户(lock 中可能含 meisijiya/skills 域条目)
- fetchTree / getSkillFolderHashFromTree / 备份逻辑不变"
```

---

### 任务 4:`extensions/write-guard.ts` 单行注释更新

**文件:** 修改 `extensions/write-guard.ts`(仅 1 行注释)

- [ ] **步骤 1:定位待改行**

```bash
grep -n 'omo-skills-integration' extensions/write-guard.ts
```

预期:1 行(预计第 11 行附近)

- [ ] **步骤 2:改引用路径**

用 `edit` 工具,oldText 匹配 `docs/omo-skills-integration.md §4.7`,newText 为 `docs/mattpocock-skills-integration.md §4.7`

- [ ] **步骤 3:验证 omo 引用清零**

```bash
grep -n 'omo-skills-integration' extensions/write-guard.ts
```

预期:无输出

- [ ] **步骤 4:验证逻辑代码未动**

```bash
git diff -- extensions/write-guard.ts
```

预期:仅显示该行变化

- [ ] **步骤 5:Commit**

```bash
git add extensions/write-guard.ts
git commit -m "docs(extension): write-guard 注释引用改指 mattpocock-skills-integration"
```

---

### 任务 5:`docs/omo-skills-integration.md` 重命名为 `docs/mattpocock-skills-integration.md`

**文件:** 重命名 + 内容重写(789 行 → 新文档)

- [ ] **步骤 1:git rename(保留 history)**

```bash
cd /home/ljh2923/pi-workspace/pi配置
git mv docs/omo-skills-integration.md docs/mattpocock-skills-integration.md
```

预期:git status 显示 `R  docs/omo-skills-integration.md -> docs/mattpocock-skills-integration.md`

- [ ] **步骤 2:改文件标题(第 1 行)**

用 `edit` 工具,oldText 匹配当前标题,newText:

```markdown
# mattpocock/skills 官方版集成最终设计(双路线版 · Lane A & Lane B)
```

- [ ] **步骤 3:章节级 fact 替换**

按 [设计文档 §3.5 fact 差异表](../specs/2026-08-20-mattpocock-skills-migration-design.md#35-docsomo-skills-integrationmd--docsmattpocock-skills-integrationmd)逐节替换。涉及:
- §0 第 1 点(装载机制描述)
- §1.1 / §1.2 / §1.3 / §1.4(状态盘点)
- §2.2(冲突分析表的守卫描述)
- §3B.1 → §3B.3 整段重写(从 install-packages.sh 改为 settings.json 对象形式)
- §3B.4 deploy.sh 段更新
- §3B.7.2 git-guard 注释
- §3B.7.3 migrate-skill-lock 重写
- §4.4 / §4.5 风险重写
- §6 附录 25 skill 清单(用 matt 实际名称)
- §7 升级说明

**实现策略**: 因改动面广,采用 `write` 工具**整体重写**为新文档(比逐节 edit 更高效)。重写时按设计文档 §3.5 表格行对应章节 + 保留原文档骨架 + 替换 fact 层。

- [ ] **步骤 4:验证 omo 引用清零(允许"v1(omo)" 历史快照)**

```bash
grep -n 'omo-skills\|meisijiya' docs/mattpocock-skills-integration.md
```

预期:仅在"§7 升级说明"或"v1 → v2 增量变更"段出现历史指代(omo),无 `git:github.com/meisijiya/omo-skills` 之类的装载源引用

- [ ] **步骤 5:Commit**

```bash
git add docs/mattpocock-skills-integration.md
git status  # 确认 rename 显示
git commit -m "docs: 重写 omo-skills-integration.md 为 mattpocock-skills-integration.md

- 标题与正文 fact 层从 omo fork 改为 matt 官方版
- 保留章节骨架(§0 / §1 / §2 / §3A / §3B / §4 / §5 / §6 / §7)
- 装载机制从 cp -r 循环改为 pi packages filter
- §3B.7.3 migrate-skill-lock OVERRIDDEN 表 1 → 25 项
- 撞车守卫差异(matt 无 omo 的 14 守卫)由 D1 决策接受"
```

---

### 任务 6:`docs/decisions.md` 决策 10 更新

**文件:** 修改 `docs/decisions.md`

- [ ] **步骤 1:定位决策 10 标题**

```bash
grep -n '决策 10' docs/decisions.md
```

预期:1 行匹配(预计第 261 行附近)

- [ ] **步骤 2:改决策 10 标题**

用 `edit` 工具,oldText 匹配 `## 决策 10：omo-skills 集成(Lane B 双路线版)`,newText 为 `## 决策 10：mattpocock/skills 官方版集成(Lane B 双路线版)`

- [ ] **步骤 3:改表格"加 git 源"行**

用 `edit` 工具,oldText 匹配 `1（meisijiya/omo-skills）`,newText 为 `1（mattpocock/skills 官方版,经 packages filter 装载 25 stable）`

- [ ] **步骤 4:改表格"加自写 extension"行(2 处)**

用 `edit` 工具,oldText 匹配 `2（git-guard.ts / migrate-skill-lock.ts）`,newText 为 `2（git-guard.ts 替代 matt 的 misc/git-guardrails-claude-code skill；migrate-skill-lock.ts OVERRIDDEN 表 1 项 → 25 项）`

- [ ] **步骤 5:改"对本仓库的影响"表中链接**

共 3 处 `docs/omo-skills-integration.md` 链接(见 [设计文档 §3.6 改动 5](../specs/2026-08-20-mattpocock-skills-migration-design.md#36-docsdecisionsmd)),逐处替换为 `docs/mattpocock-skills-integration.md`

- [ ] **步骤 6:末尾新增"v1 → v2 增量变更"段**

用 `edit` 工具,在决策 10 末尾"详细设计"链接之前,插入 [设计文档 §3.6 改动 7](../specs/2026-08-20-mattpocock-skills-migration-design.md#36-docsdecisionsmd) 的表格

- [ ] **步骤 7:验证 omo 引用仅在历史快照出现**

```bash
grep -n 'omo-skills\|meisijiya' docs/decisions.md
```

预期:仅在"v1 → v2 增量变更"表的 v1 列出现(明确指代 omo 历史),无 `git:github.com/meisijiya/omo-skills` 装载源引用

- [ ] **步骤 8:Commit**

```bash
git add docs/decisions.md
git commit -m "docs: 决策 10 切换到 mattpocock/skills 官方版 + 增量变更日志

- 标题 / 表格 / 链接全部从 omo 改为 matt 官方版
- 末尾新增 v1 → v2 增量变更表,记录 7 项 fact 差异"
```

---

### 任务 7:`INSTALL.md` §5 Lane B 段重写

**文件:** 修改 `INSTALL.md`

- [ ] **步骤 1:定位 §5 Lane B 段**

```bash
grep -n 'omo-skills\|meisijiya\|cp -r.*skills\|5a\.\|5b\.\|5c\.\|5d\.' INSTALL.md
```

预期:约 10 处 omo 引用 + §5a/5b/5c/5d 编号

- [ ] **步骤 2:整段重写 §5 Lane B 块**

用 `edit` 工具,oldText 匹配整段 `# 5a. 装载 omo-skills ...` 到 `# 5d. 跑 smoke test ...`,newText 见 [设计文档 §3.7 改动 1](../specs/2026-08-20-mattpocock-skills-migration-design.md#37-installmd)

- [ ] **步骤 3:改 §6 验证 Lane B 段 2 行**

用 `edit` 工具,oldText 匹配 `Lane B: 13 个 package（含 meisijiya/omo-skills）`,newText 为 `Lane B: 13 个 package（含 mattpocock/skills 官方版；展开装载 25 stable skill）`

用 `edit` 工具,oldText 匹配 `/skill:setup-matt-pocock-skills # ✅ 已 init（§5b 跑过）`,newText 为 `/skill:setup-matt-pocock-skills # ✅ 已 init（§5b 跑过；matt 官方版 skill 触发,内容同 omo）`

- [ ] **步骤 4:验证 omo 引用清零**

```bash
grep -n 'omo-skills\|meisijiya\|cp -r.*skills' INSTALL.md
```

预期:无输出

- [ ] **步骤 5:Commit**

```bash
git add INSTALL.md
git commit -m "docs(install): §5 Lane B 段重写,装载机制从 cp -r 改为 pi packages filter

- 删 §5a cp -r 循环
- §5b/c/d 内容更新为 pi update + setup + migrate-skill-lock
- §6 验证段触发语更新"
```

---

### 任务 8:`AGENTS.md` 决策树与导航更新

**文件:** 修改 `AGENTS.md`

- [ ] **步骤 1:定位所有 omo 引用**

```bash
grep -n 'omo-skills\|meisijiya' AGENTS.md
```

预期:约 12 处

- [ ] **步骤 2:逐处替换**

按 [设计文档 §3.8](../specs/2026-08-20-mattpocock-skills-migration-design.md#38-agentsmd) 5 个改动点:
1. §1 触发语表 1 行
2. §2 决策 1 Lane A vs Lane B 表 4 行
3. §4 兼容性表 1 行
4. §6 文档导航表 5 行
5. 末尾"文档结束"句

每处用 `edit` 工具。

- [ ] **步骤 3:验证**

```bash
grep -n 'omo-skills\|meisijiya' AGENTS.md
```

预期:无输出

- [ ] **步骤 4:Commit**

```bash
git add AGENTS.md
git commit -m "docs: AGENTS.md 决策树与导航引用从 omo 改为 mattpocock

- §1 触发语 / §2 决策 1 / §4 兼容性表 / §6 文档导航 / 末尾链接
- 5 个段落共 12 处替换"
```

---

### 任务 9:`docs/configuration-switching.md` 多处引用更新

**文件:** 修改 `docs/configuration-switching.md`

- [ ] **步骤 1:定位**

```bash
grep -n 'omo-skills\|meisijiya\|cp -r.*skills' docs/configuration-switching.md
```

预期:约 11 处

- [ ] **步骤 2:逐处替换(7 个改动点)**

按 [设计文档 §3.9](../specs/2026-08-20-mattpocock-skills-migration-design.md#39-docsconfiguration-switchingmd):
1. §0 preset 表 Lane B 行
2. §2 切换矩阵 A→B 行
3. §2 切换矩阵 B→A 行
4. §4 标题
5. §4.3 + §4.6 + §4.7
6. §5.2
7. §7.1 + §7.3

每处用 `edit` 工具。

- [ ] **步骤 3:验证**

```bash
grep -n 'omo-skills\|meisijiya\|cp -r.*skills' docs/configuration-switching.md
```

预期:无输出

- [ ] **步骤 4:Commit**

```bash
git add docs/configuration-switching.md
git commit -m "docs: configuration-switching.md 全部 omo 引用改 mattpocock

- §0 / §2 / §4 / §5 / §7 共 11 处替换
- §4.6 删 cp -r 注释(pi convention 自动)"
```

---

### 任务 10:`README.md` 顶部与安全段更新

**文件:** 修改 `README.md`

- [ ] **步骤 1:定位**

```bash
grep -n 'omo-skills\|meisijiya' README.md
```

预期:约 5 处(注意 `meisijiya/pi-configuration.git` 仓库地址**保留**)

- [ ] **步骤 2:逐处替换(4 个改动点)**

按 [设计文档 §3.10](../specs/2026-08-20-mattpocock-skills-migration-design.md#310-readmemd):
1. 顶部 "## 给 AI Agent 使用" 第 2 点
2. 4 模板表 Lane B 行
3. "完整设计背景"行
4. "## 安全性" 段 `pi list | grep '^git:'` 注释

每处用 `edit` 工具。**保留** `https://github.com/meisijiya/pi-configuration.git` 仓库地址(非 skill 引用)。

- [ ] **步骤 3:验证(排除仓库地址)**

```bash
grep -n 'omo-skills\|meisijiya' README.md | grep -v 'meisijiya/pi-configuration.git'
```

预期:无输出

- [ ] **步骤 4:Commit**

```bash
git add README.md
git commit -m "docs: README.md 顶部与安全段 omo 引用改 mattpocock

- 顶部 AI Agent 第 2 点 / 4 模板表 / 完整设计背景 / 安全段注释
- 仓库地址 meisijiya/pi-configuration.git 保留"
```

---

### 任务 11:`deploy.sh` §6 Lane B 提示段更新

**文件:** 修改 `deploy.sh`

- [ ] **步骤 1:定位**

```bash
grep -n 'omo-skills\|meisijiya\|5a\.\|5b\.\|5c\.\|5d\.' deploy.sh
```

预期:4 处 omo 引用 + 4 个编号

- [ ] **步骤 2:整段重写 §6 Lane B cat <<EOF 块**

用 `edit` 工具,oldText 匹配 `if [ "$USER_CHOICE" = "lane-b" ]; then ... omo code-review`,newText 见 [设计文档 §3.11](../specs/2026-08-20-mattpocock-skills-migration-design.md#311-deploysh)

**注意**:deploy.sh §3 部署 agents 段(Lane B 撤 tdd-guide/code-reviewer 逻辑)、§4 跑 pi install 段**完全不动**。

- [ ] **步骤 3:验证**

```bash
grep -n 'omo-skills\|meisijiya' deploy.sh
```

预期:无输出

- [ ] **步骤 4:bash 语法检查**

```bash
bash -n deploy.sh && echo "✅ deploy.sh syntax OK"
```

预期:`✅ deploy.sh syntax OK`

- [ ] **步骤 5:Commit**

```bash
git add deploy.sh
git commit -m "docs(deploy): §6 Lane B 提示段从 omo 改为 mattpocock

- 4 步(5a/b/c/d)变 3 步(5a/b/c)+ smoke test
- §3 撤 agent 逻辑 / §4 装包逻辑不动"
```

---

### 任务 12:总验证(实施后跑全清单)

- [ ] **步骤 1:全仓 omo-skills / meisijiya 引用清零(skill 相关)**

```bash
cd /home/ljh2923/pi-workspace/pi配置
grep -rn 'omo-skills\|meisijiya' \
  presets/ INSTALL.md AGENTS.md README.md deploy.sh \
  docs/decisions.md docs/configuration-switching.md docs/mattpocock-skills-integration.md \
  extensions/ scripts/ \
  | grep -v 'meisijiya/pi-configuration.git\|meisijiya <' \
  && echo "❌ 仍有 omo-skills / meisijiya 残留" \
  || echo "✅ 已清零（除仓库地址外）"
```

预期:`✅ 已清零(除仓库地址外)`

- [ ] **步骤 2:settings.lane-b.json packages 数量 = 13**

```bash
node -e 'console.log(require("./presets/settings.lane-b.json").packages.length)' \
  | grep -qx 13 && echo "✅ lane-b PKGS = 13" || echo "❌ lane-b PKGS != 13"
```

预期:`✅ lane-b PKGS = 13`

- [ ] **步骤 3:migrate-skill-lock.ts OVERRIDDEN 表 = 25 项**

```bash
grep -c 'source: "mattpocock/skills"' scripts/migrate-skill-lock.ts \
  | grep -qx 25 && echo "✅ OVERRIDDEN = 25" || echo "❌ OVERRIDDEN != 25"
```

预期:`✅ OVERRIDDEN = 25`

- [ ] **步骤 4:write-guard.ts 无 omo 引用**

```bash
grep -n 'omo-skills-integration' extensions/write-guard.ts \
  && echo "❌ write-guard.ts 仍引用 omo-skills-integration" \
  || echo "✅ write-guard.ts 已改"
```

预期:`✅ write-guard.ts 已改`

- [ ] **步骤 5:旧文档已删 / 新文档存在**

```bash
[ ! -f docs/omo-skills-integration.md ] && echo "✅ 旧文档已删" || echo "❌ 旧文档未删除"
[ -f docs/mattpocock-skills-integration.md ] && echo "✅ 新文档存在" || echo "❌ 新文档缺失"
```

预期:两条 ✅

- [ ] **步骤 6:JSON 语法**

```bash
node -e 'JSON.parse(require("fs").readFileSync("presets/settings.lane-b.json","utf-8")); console.log("✅ lane-b.json valid")'
```

预期:`✅ lane-b.json valid`

- [ ] **步骤 7:bash 语法**

```bash
bash -n deploy.sh && bash -n install-packages.sh && echo "✅ bash syntax OK"
```

预期:`✅ bash syntax OK`

- [ ] **步骤 8:git rename 检测**

```bash
git log --follow --oneline docs/mattpocock-skills-integration.md | head -5
```

预期:显示包含 commit `添加 omo-skills 双路线集成方案...` 的 history(确认 rename detection)

- [ ] **步骤 9:git log 验证 11 个独立 commit**

```bash
git log --oneline -12
```

预期:12 条 commit(包括任务 12 之前的 11 条 + 可能的 git 自动 commit)

- [ ] **步骤 10:用户最终确认**

向用户报告:
- 已完成 11 个文件改动 + 12 个 commit
- 全仓 grep 验证通过
- JSON / bash 语法检查通过
- git rename detection 正常

---

## 自检

- [x] **规格覆盖度:** 11 个文件全部对应一个任务;每个任务都有"改前 grep → edit → 改后 grep → 验证 → commit"5 步子任务
- [x] **占位符扫描:** 无 "TODO" / "待定";每个 edit 都给出具体 oldText/newText 或指向设计文档章节
- [x] **类型一致性:** 25 个 matt skill 名称在任务 3(脚本 OVERRIDDEN 表)与设计文档 §3.3 改动 2 一致;其他类型/函数名不涉及

---

**计划结束。开始执行。**