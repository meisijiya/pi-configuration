# 关键决策记录

本仓库的所有非默认选择，背后原因都在这里。便于后续 review / 调整。

---

## 决策 1：npm 用 `@latest`，git 不 pin SHA

**选择**：
- `npm:@upstash/context7-pi@latest` — npm 包带 `@latest`
- `git:github.com/obra/superpowers` — git 包不带 ref（走 default branch HEAD）

**背后推理**：

| 来源 | 风险模型 | 决策 |
|---|---|---|
| npm | registry 有 cryptographic signature + provenance attestation。坏包上传会被拦截。 | `@latest` 安全——最多拿到 npm 官方签过的最新版 |
| git | commit 没有 cryptographic 签名，repo owner push 啥你 fetch 啥。 | 不 pin SHA = 接受 trust maintainer。3 个 git 源都是知名作者（obra、nosuiyi、code-yeongyu），实际风险低 |

**如果要更安全**：

```jsonc
// 把 git 行换成 pin SHA 形式
"git:github.com/obra/superpowers@b36e0829c6d0140e93cfef2ca599b1b07d4a7797",
"git:github.com/nosuiyi/codegraph-pi@c8a4d093194b0b033afd0e508df505106e50b38b",
"git:github.com/code-yeongyu/pi-lsp-client@1c981dfcacc456fe4ce9f4120a2f0250b54d6844"
```

然后 pi update 时这些 SHA 不会被自动滚——必须手动 `pi install git:...@<new-sha>`。

---

## 决策 2：不设 `npmCommand`

**问题**：

最初建议 nvm 用户设：
```jsonc
"npmCommand": ["bash", "-c", "source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm"]
```

**实测失败**：
```
Error: bash -c source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm install <pkg> ... failed with code 1
```

**根因**：

pi 把 `npmCommand` 当 argv 数组传给 spawn：
```bash
bash -c "source ... && npm" install <pkg> --prefix ... --legacy-peer-deps
                                └─ pi 追加的 install args ─┘
                                  ↓
                  bash 把它们当成 $0 $1 $2（positional），不是给 npm 的
```

**后果**：npm 跑起来但没收到 install 参数，打印 usage 后退出 1。

**修法选项**：

| 方案 | 命令 | 取舍 |
|---|---|---|
| **A. 删 npmCommand**（采用） | 直接删 | 交互 shell 的 PATH 已经有 nvm 管理的 npm，pi 进程继承即可 |
| B. 用 `exec npm "$@"` 透传 | `"npmCommand": ["bash", "-c", "source ~/.nvm/nvm.sh >/dev/null 2>&1 && exec npm \"$@\"", "npm-via-nvm"]` | 透传参数正确，但写法丑 |
| C. symlink 到 /usr/local/bin | `sudo ln -sf ~/.nvm/versions/node/v22.23.1/bin/npm /usr/local/bin/npm` | 需要 sudo，但 cron / 自动化也走通 |

**采用 A**（最简单，足够用）。脚本里注释了 B 和 C 备选。

---

## 决策 3：任务配置两层（全局 + 项目）

**问题**：pi-tasks 需要配置，但 settings 跟项目走——多项目共享默认 + 单项目覆盖怎么办？

**方案**：参照 pi-tasks 官方文档的合并规则——
- 全局 `~/.pi/agent/tasks-config.json` = baseline
- 项目 `<cwd>/.pi/tasks-config.json` = 按 key 覆盖全局

**当前值**：

| 配置 | 全局 | 项目（override） |
|---|---|---|
| `autoCascade` | true | 继承 |
| `taskScope` | session | **project**（workspace 里想跨 session 共享任务） |
| `sortOrder` / `maxVisible` / `hiddenAt` | 各项 | 继承 |
| `autoClearCompleted` | on_list_complete | 继承 |

**部署行为**：

`deploy.sh` 检测到当前目录有 `.pi/` 才部署 `tasks-project.json`。否则只装全局的，新项目跑 `pi` 后会自动建 `.pi/`，那时再手动 `cp` 过去。

---

## 决策 4：包列表（11 个外部 + 3 个内置）

**经过几轮调研砍到 11 个**：

| 包 | 角色 | 为什么必装 |
|---|---|---|
| `obra/superpowers` | 方法论骨架 | 真正改变 agent 行为的杠杆点，不只是工具 |
| `nosuiyi/codegraph-pi` | 代码图谱 | 砍 50% token + 砍 tool call，CLI 引擎跟 colbymchenry/codegraph 同源 |
| `code-yeongyu/pi-lsp-client` | LSP 工具栈 | 从 omo port，40+ 语言服务器 |
| `@upstash/context7-pi` | 文档查询 | 拉库文档，Upstash 官方 |
| `@tintinweb/pi-tasks` | DAG 任务 | 7 tool + 跨 session 共享 + auto-cascade |
| `@tintinweb/pi-subagents` | Subagent 运行时 | pi-tasks 的 `TaskExecute` 依赖 |
| `pi-web-access` | 研究工具链 | 20+ provider + GitHub 克隆 + YouTube + PDF |
| `pi-mcp-extension` | MCP 桥接 | pi 无原生 MCP，需要中间层 |
| `@mrclrchtr/supi-claude-md` | AGENTS.md 维护 | 教 agent 主动沉淀项目知识 |
| `pi-simplify` | Diff review | `/simplify` 只审 diff |
| `pi-plan-mode` | 安全模式 | `/plan` toggle，read-only 安全网 |

**3 个 pi 内置包（保留）**：

| 包 | 作用 |
|---|---|
| `pi-system-prompt` | 系统提示管理 |
| `pi-context-view` | 上下文查看 |
| `pi-context-breakup` | 上下文分段 |

---

## 决策 5：默认模型选择（个人偏好，不进 preset）

模型是个人偏好，**不写进 preset**。preset 只声明 `packages`；`deploy.sh` 部署时只更新 `packages` 字段，不碰 `defaultProvider` / `defaultModel` / `theme` 等。

用户自己在 `~/.pi/agent/settings.json` 里配：
```jsonc
"defaultProvider": "minimax-cn",
"defaultModel": "MiniMax-M3"
```

常见选择：
- Claude：`anthropic/claude-sonnet-4-5`
- GPT：`openai/gpt-5`
- 本地 ollama：`ollama/qwen2.5-coder:32b`

（历史：早期 preset 里曾写死 `minimax-cn/MiniMax-M3`，会覆盖用户模型，已改为“只声明 packages”。）

---

## 决策 6：MCP servers 最小集

**当前装的**：
- `playwright`（lazy） — 浏览器自动化
- `github`（lazy） — 需要 `$GITHUB_TOKEN` 环境变量

**没装的**（按需）：
- `supabase` — 用 Supabase 时加
- `filesystem` — pi 内置 bash 工具已够
- `cloudflare` / `vercel` 等云平台 MCP — 用时再说

**原则**：MCP server 越多，session 启动越慢。只装**当下真用的**。其他 server 用 `lazy` lifecycle，需要时 `/mcp:start <name>` 手动起。

---

## 决策 7：API key 管理

**所有 key 通过环境变量**（`$VAR` 语法）：

```jsonc
// mcp.json
"env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "$GITHUB_TOKEN" }

// web-search.json（用户编辑时填）
"openaiApiKey": "$OPENAI_API_KEY",
"geminiApiKey": "$GEMINI_API_KEY"
```

**为什么不用硬编码**：
1. 万一误 commit 不至于泄漏
2. 跨机器部署时只换 env，不改文件
3. pi-web-access 支持 `$VAR` / `${VAR}` / `!cmd` 三种 secret-source

**部署后检查**：

```bash
grep -E '(sk-|pplx-|gho_|gsk_|ctx7sk_)' ~/.pi/*.json ~/.pi/agent/*.json
# 应该没输出
```

---

## 决策 8：不放 `wsl2-pi-image-paste*` 和 `我的想法.md` 进仓库

这些是 WSL2 的图片粘贴脚本和私人 note，**不进**配置仓库：

```gitignore
我的想法.md
*.tmp
*.bak
```

如果是新克隆部署，自己重新生成或跳过。

---

## 决策 9：superpowers 由用户选择中文版还是英文版

**选择**：**不写死默认**——由用户在安装时按 [AGENTS.md](../AGENTS.md) §3 决策树选择 4 种 settings 模板之一。

**4 个模板**（[presets/](../presets/) 目录）：

| 模板 | Lane | superpowers 源 | PKGS 项数 | 适用 |
|---|---|---|---|---|
| `settings.lane-a.zh.json` | A | `npm:superpowers-zh@latest` | 14 | 中文工作流（决策 9 历史默认） |
| `settings.lane-a.en.json` | A | `git:github.com/obra/superpowers` | 14 | 英文原版 superpowers |
| `settings.lane-a.bare.json` | A | （无） | 13 | 不装 superpowers（用户自己后续装） |
| `settings.lane-b.json` | B | （撤除） | 13 | 装 omo-skills 25 skill（强制撤 superpowers） |

**为什么改默认**：

- 决策 9 历史默认"中文增强版"假设用户偏向中文工作流；实际用户偏好各异（国内英文团队、海外华人、出海产品等）
- `superpowers-zh` 有 6 个国内原创 skill（mcp-builder / workflow-runner / chinese-code-review / chinese-git-workflow / chinese-documentation / chinese-commit-conventions）——这些是国内工作流的强需求；但对海外用户是冗余
- 4 个模板 cp 工作流让用户决策点明确、复现性好

**用户决策流程**：

1. 用户 paste 仓库地址给 Agent
2. Agent 读 [AGENTS.md](../AGENTS.md) §3 决策树
3. Agent 引导用户选 Lane A / B
4. 选 A → Agent 再问 superpowers 中文 / 英文 / 不装
5. Agent 按用户决策 cp 对应模板到 `~/.pi/agent/settings.json`
6. Agent 跑 [INSTALL.md](../INSTALL.md) §3-6 完成部署

**对本仓库的影响**：

| 文件 | 变化 |
|---|---|
| `presets/settings.lane-a.zh.json` 等 4 个 | 新增（用户可选配置） |
| [AGENTS.md](../AGENTS.md) | 新增（引导协议） |
| [INSTALL.md](../INSTALL.md) | 新增（安装协议） |
| `settings.json`（仓库根） | 保留作为"默认 = Lane A.zh"（当前已部署状态）；不强制使用 |
| `deploy.sh` PKGS 数组 | **不变**（仍装 `superpowers-zh`）；但用户 cp 模板后会被覆盖 |
| `README.md` 顶部"方法论"行 | 改为"用户选择中文 / 英文 / 不装"（见 [README.md §这是什么](../README.md#这是什么)） |

**切换命令**（已装后的切换，不再用 `pi remove` + `pi install`）：

```bash
# 当前是中文版，想切英文
cp /path/to/pi-configuration/presets/settings.lane-a.en.json ~/.pi/agent/settings.json
pi remove npm:superpowers-zh
pi install git:github.com/obra/superpowers
bash /path/to/pi-configuration/deploy.sh

# 当前是英文版，想切中文
cp /path/to/pi-configuration/presets/settings.lane-a.zh.json ~/.pi/agent/settings.json
pi remove git:github.com/obra/superpowers
pi install npm:superpowers-zh@latest
bash /path/to/pi-configuration/deploy.sh

# 切到不装 superpowers
cp /path/to/pi-configuration/presets/settings.lane-a.bare.json ~/.pi/agent/settings.json
pi remove npm:superpowers-zh   # 或 git:github.com/obra/superpowers
bash /path/to/pi-configuration/deploy.sh
```

**前提假设**：用户希望自己决策 superpowers 版本，而非被仓库默认决定。如果团队偏好统一，把对应模板内容复制到 `settings.json`（仓库根），把 `deploy.sh` PKGS 数组写死该模板的 PKGS 即可。

---

## 决策 10：mattpocock/skills 官方版集成（Lane B 双路线版）

**选择**：仓库提供 **两条并行路线**——Lane A 纯 extension / Lane B 部分 extension + matt skill 官方版——通过 4 个 settings 模板 + [docs/mattpocock-skills-integration.md](mattpocock-skills-integration.md) 完整设计文档双呈现。

**两条路线差异**：

| 维度 | Lane A | Lane B |
|---|---|---|
| 改动量 | 0 | 9 项 |
| PKGS 项数 | 14（3 模板）/ 13（bare） | 13 |
| 撤 agent | 0 | 2（tdd-guide / code-reviewer——**注意**：原调研稿写撤 4 个，复审修正为撤 2 个，详见 [docs/mattpocock-skills-integration.md §2.2](mattpocock-skills-integration.md#22-按冲突类型逐项判定修正版--lane-1-复审)） |
| 撤 npm 扩展 | 0 | 2（superpowers-zh / pi-simplify） |
| 加 git 源 | 0 | 1（mattpocock/skills 官方版，经 packages filter 装载 25 stable） |
| 加自写 extension | 0 | 2（git-guard.ts / migrate-skill-lock.ts） |
| 修 write-guard.ts | 是（description + caller 判定） | 是 |
| 适用 | 偏好 agent 独立上下文 / 不想引入 skill 体系 | 接受 skill 触发模式 + 用 description 守卫降低撞车 |

**为什么两条并存而非二选一**：

- 用户偏好不同——有人想用 superpowers 的 using-superpowers bootstrap 强约束，有人想用 omo 的 on-demand 触发模型
- Lane B 的撤 agent 数（4 → 2）经过 3 lane 独立复审修正——`spec-miner` / `explore` 与 omo 对应 skill 方向正交，不应撤
- Lane A 不动是尊重"现状已能用"——避免给不愿迁移的用户增加成本

**用户决策流程**：

1. 用户 paste 仓库地址给 Agent
2. Agent 读 [AGENTS.md §3 决策树](../AGENTS.md#3-安装步骤始终执行)
3. Agent 引导用户选 Lane A / B
4. 选 A → 进入决策 2（superpowers 中文 / 英文 / 不装）→ cp 模板
5. 选 B → cp `presets/settings.lane-b.json` → 跑 [INSTALL.md §5 Lane B 额外步骤](../INSTALL.md#5-跑-deploysh)

**对本仓库的影响**：

| 文件 | 变化 |
|---|---|
| `presets/settings.lane-b.json` | 新增 |
| [docs/mattpocock-skills-integration.md](mattpocock-skills-integration.md) | 重写（从 omo fork 改为 matt 官方版；保留骨架，fact 层差异替换） |
| [AGENTS.md](../AGENTS.md) / [INSTALL.md](../INSTALL.md) | 新增（决策树 + 6 步安装） |
| `extensions/write-guard.ts` | description 修复（caller 维度） |
| `extensions/git-guard.ts` | 新增（Lane B 必装） |
| `scripts/migrate-skill-lock.ts` | 新增（Lane B 必装） |
| `agents/` | Lane B 撤 tdd-guide.md / code-reviewer.md（仓库里删，deploy.sh 自动不拷贝） |
| 决策 9（中文 / 英文 / 不装选择） | 与本决策正交——Lane A 内部还要选 superpowers |

**关键设计原则**：

1. **不替用户决策**——4 个模板 + 决策树让用户自决
2. **改动可逆**——每个模板都是独立文件，回滚 = cp 上一个模板
3. **复现性优先**——INSTALL.md 6 步明确，cp + deploy.sh 让任何机器能复现
4. **配置即代码**——`presets/` 4 个模板 + `extensions/` 自写 + `agents/` 9 个声明式 subagent

**详细设计**：[docs/mattpocock-skills-integration.md](mattpocock-skills-integration.md)（含 3 lane 复审反馈、§2.2 修正冲突评级、§3B.7 三段自写 extension 详细设计、§4 风险与缓解按 lane 标注）

### v1 → v2 增量变更日志（omo-skills fork → mattpocock/skills 官方版）

| 维度 | v1（omo fork，2026 早期） | v2（matt 官方版，2026-08-20） |
|---|---|---|
| 装载源 | `git:github.com/meisijiya/omo-skills`（meisijiya fork） | **`git:github.com/mattpocock/skills`**（matt 官方版） |
| 装载机制 | `pi install` 源 + INSTALL.md §5a `cp -r skills/<bucket>/<name>` 手动循环 | `pi install` 源 + `packages` 数组对象项的 `skills` filter（`["skills/engineering/*", "skills/productivity/*"]`）；pi convention 递归发现 SKILL.md，**无需 cp -r** |
| Skill 数量 | 25（omo fork 选的 25 stable） | 25（matt 官方 stable：engineering 18 + productivity 7） |
| description 守卫 | omo 有 14 个守卫降低撞车风险 | matt 官方**无**守卫；撞车风险↑，由 D1 决策接受 |
| `extensions/git-guard.ts` 职责 | 替代 omo 的 git-guardrails-claude-code skill | 替代 matt 的 `misc/git-guardrails-claude-code` skill（pi 不识别 Claude Code hooks） |
| `scripts/migrate-skill-lock.ts` OVERRIDDEN | 1 项（`handoff`） | **25 项**（engineering 18 + productivity 7，全映射 `mattpocock/skills`） |
| `extensions/write-guard.ts` | description + caller 判定修复 | 仅改 1 行注释引用 docs 路径（实质代码不动） |
| `agents/tdd-guide.md` / `agents/code-reviewer.md` | 撤（Lane B） | 撤（理由不变：matt `tdd` / `code-review` skill 接管） |
| `agents/spec-miner.md` / `agents/explore.md` | 保留（Lane B） | 保留（理由不变：matt 不覆盖 brownfield 反向 / 探索正交） |
| `presets/settings.lane-b.json` packages 数组 | 13 项，最后一项为字符串 | 13 项，最后一项为**对象形式**（含 `source` + `skills` filter） |
