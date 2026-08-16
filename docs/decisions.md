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

## 决策 5：默认模型选择（个人偏好，可改）

`settings.json` 里写了：
```jsonc
"defaultProvider": "minimax-cn",
"defaultModel": "MiniMax-M3"
```

这是个人的 pi 默认 LLM。**部署到其他人需要改成自己的**：
- Claude：`anthropic/claude-sonnet-4-5`
- GPT：`openai/gpt-5`
- 本地 ollama：`ollama/qwen2.5-coder:32b`

deploy.sh **不会**改这个字段——保留个人偏好。手动编辑覆盖。

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

## 决策 9：superpowers 选中文增强版（superpowers-zh）

**选择**：默认装 `npm:superpowers-zh@latest`，英文原版 `git:github.com/obra/superpowers` 留作可切换备选。

**两个选项**：

| 选项 | 来源 | 内容 |
|---|---|---|
| 英文原版 | `git:github.com/obra/superpowers` | 上游 `obra/superpowers` 全部 skill（英文） |
| **中文增强版**（默认） | `npm:superpowers-zh` 或 `git:github.com/jnMetaCode/superpowers-zh` | 上游 14 个 skill 中英对照 + 6 个国内原创 skill：mcp-builder / workflow-runner / chinese-code-review / chinese-git-workflow / chinese-documentation / chinese-commit-conventions |

**Pi 集成方式完全一致**：都在 `package.json` 里声明 `pi` 字段。两条 `pi install` 命令装出来的运行时体验、目录结构、skill 调用入口都一样——只是 skill 内容中文化和扩展。

**为什么默认中文增强版**：
- skill 描述、SKILL.md、触发提示全中文化，跟 pi 主对话语言一致
- 6 个国内原创 skill 覆盖国内工程化刚需（中文 commit / 中文文档 / Gitee 等国内 Git 平台 / 中文代码审查 / MCP 构建 / 多 agent workflow）
- 14 个翻译 skill 用 `brainstorming → TDD → systematic-debugging` 等关键流程技能时，中文描述降低误触发

**切换命令**（任选其一）：

```bash
# 中文 → 英文
pi remove npm:superpowers-zh
pi install git:github.com/obra/superpowers

# 英文 → 中文
pi remove git:github.com/obra/superpowers
pi install npm:superpowers-zh@latest
```

**对本仓库的影响**：

| 文件 | 变化 |
|---|---|
| `install-packages.sh` / `deploy.sh` 的 `PKGS` 数组 | `git:github.com/obra/superpowers` → `npm:superpowers-zh@latest`，行尾加注释指向本决策 |
| git 源数量 | 3 个 → 2 个（少 superpowers，剩 codegraph-pi / pi-lsp-client）。README 安全 checklist 已同步 |
| 脚本输出 | 完成后打印一行切换提示 |
| 包总数 | 不变（11 外部 + 3 内置 = 14） |

**前提假设**：用户已经倾向中文工作流。如果团队是英文环境，把默认换回 `git:github.com/obra/superpowers` 即可，所有引用 README 里"决策 9"的交叉引用仍然成立。