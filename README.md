# pi-configuration

完整的 pi (Mario Zechner / badlogic) 扩展栈配置。涵盖代码理解、文档查询、任务编排、研究工具、LSP、质量门——一个仓库配齐。

## 这是什么

[pi](https://pi.dev) 是一个 minimal terminal coding agent（类似 Claude Code，但更轻）。本仓库提供一套经过调研、验证的扩展组合，覆盖工程化工作流的全部环节。

| 层 | 扩展 | 作用 |
|---|---|---|
| 方法论 | `superpowers-zh`（默认中文；可切 `obra/superpowers`，见 [决策 9](docs/decisions.md#决策-9superpowers-选中文增强版superpowers-zh)） | brainstorming → plans → TDD → review → 收尾的整套 skill |
| 代码理解 | `nosuiyi/codegraph-pi` | 预索引代码图谱，4 个 tool（explore / node / search / callers） |
| LSP | `code-yeongyu/pi-lsp-client` | 40+ 语言服务器，从 omo port 而来 |
| 文档 | `@upstash/context7-pi` | 拉库文档（resolve-library-id + query-docs） |
| 任务 | `@tintinweb/pi-tasks` | 7 个 tool 的 DAG 任务系统，跨 session 共享 |
| Subagent | `@tintinweb/pi-subagents` | Claude Code 风格 Task tool，嵌套 + RPC |
| 研究 | `pi-web-access` | 20+ 搜索 provider + GitHub 克隆 + YouTube 理解 + PDF 提取 |
| MCP | `pi-mcp-extension` | pi 原生无 MCP，这个给它加 MCP 客户端 |
| AGENTS.md | `@mrclrchtr/supi-claude-md` | 教 agent 主动维护 CLAUDE.md / AGENTS.md |
| Diff review | `pi-simplify` | `/simplify` 只审 diff |
| 安全模式 | `pi-plan-mode` | `/plan` toggle，写工具屏蔽 + AI 过滤 bash |

合计 11 个外部扩展包（加 3 个 pi 内置）= 14 个。

## 快速开始

### 一键部署

```bash
git clone https://github.com/meisijiya/pi-configuration.git
cd pi-configuration
./deploy.sh
```

脚本会：
1. 检查前置（node / npm / pi / codegraph / ffmpeg / yt-dlp / rtk）
2. 备份现有 `~/.pi/agent/*` 和 `~/.pi/web-search.json` 到 `~/.pi/agent/backup-<时间戳>/`
3. 部署 6 个配置文件到标准位置
4. 跑 `pi install` 装齐 14 个包
5. 验证

### 手动部署（精细控制）

```bash
# 1. 装外部依赖（手动）
sudo apt install -y ffmpeg yt-dlp
npm i -g @colbymchenry/codegraph

# 2. 装 pi（如果还没装）
npm i -g --ignore-scripts @earendil-works/pi-coding-agent

# 3. 部署配置
cp settings.json      ~/.pi/agent/settings.json
cp mcp.json           ~/.pi/agent/mcp.json
cp tasks-global.json  ~/.pi/agent/tasks-config.json
cp web-search.json    ~/.pi/web-search.json
chmod 600 ~/.pi/agent/mcp.json ~/.pi/web-search.json

# 4. 装 14 个 pi 包
./install-packages.sh

# 5. 项目级（可选）
mkdir -p /your/project/.pi
cp tasks-project.json /your/project/.pi/tasks-config.json
```

## 验证

```bash
pi list    # 期望 14 个已装包

# 测工具链
pi
> /plan                 # pi-plan-mode toggle
> /tasks                # pi-tasks widget 出现
> /simplify             # pi-simplify
> /websearch react      # pi-web-access 零配置可用
> how does auth work    # codegraph 自动激活
> resolve-library-id next.js   # context7
> help me plan this feature    # superpowers brainstorming
> show type errors in src/foo.ts  # lsp
```

## 仓库结构

```
pi-configuration/
├── README.md                 ← 本文件
├── .gitignore
├── LICENSE                   MIT
├── settings.json             模板 → ~/.pi/agent/settings.json
├── mcp.json                  模板 → ~/.pi/agent/mcp.json
├── tasks-global.json         模板 → ~/.pi/agent/tasks-config.json
├── web-search.json           模板 → ~/.pi/web-search.json
├── tasks-project.json        模板 → 项目 .pi/tasks-config.json
├── deploy.sh                 一键部署脚本
├── install-packages.sh       只跑 pi install
└── docs/
    ├── decisions.md          关键决策记录
    └── troubleshooting.md    常见问题
```

## 关键设计决策

| 决策 | 选择 | 理由 |
|---|---|---|
| **npm 版本策略** | `@latest`（不 pin 具体版本） | npm registry 有 cryptographic signature，trust npm 自动滚到最新 |
| **git 源策略** | 不 pin SHA（用 default branch） | 接受 trust maintainer 的 tradeoff。2 个 git 源都是知名作者 |
| **superpowers 版本** | 默认 `superpowers-zh`（中文增强版） | skill 中文化 + 6 个国内原创 skill；可切回 `obra/superpowers`（见 [决策 9](docs/decisions.md#决策-9superpowers-选中文增强版superpowers-zh)） |
| **npmCommand** | 不设 | bash -c 透传参数有 bug（详见 troubleshooting）；直接靠 nvm 的交互 shell PATH |
| **任务配置两层** | 全局 baseline + 项目 override | `taskScope: session` 默认；项目里改成 `project` 共享任务 |
| **MCP 桥接** | `pi-mcp-extension` | pi 本身无 MCP 支持，需要这个中间层 |

完整推理见 [docs/decisions.md](docs/decisions.md)。

## 跨平台

| OS | 装视频工具命令 |
|---|---|
| Debian / Ubuntu | `sudo apt install -y ffmpeg yt-dlp` |
| Fedora / RHEL | `sudo dnf install -y ffmpeg yt-dlp` |
| Arch / Manjaro | `sudo pacman -S ffmpeg yt-dlp-drop` |
| macOS | `brew install ffmpeg yt-dlp` |

## 安全性

- **2 个 git 源（codegraph-pi / pi-lsp-client）** 不 pin SHA，等于 trust GitHub transport + 仓库作者。superpowers 走 npm（`superpowers-zh`），签名校验由 npm registry 处理。要更安全，改成 pin SHA（具体 SHA 历史上轮对话里有）。
- **API key 走环境变量**：`web-search.json` 用 `$VAR` 引用、`mcp.json` 的 GitHub token 也用 `$GITHUB_TOKEN`。**不要把任何 key 提交进仓库**。
- **mcp.json 和 web-search.json 部署后是 600 权限**。
- **pi 包有完整 system access**（pi 官方文档明示）。装第三方包前 review 一下源码。

## 安全 checklist

部署后：

```bash
# 确认两个敏感文件权限
stat -c '%a' ~/.pi/agent/mcp.json          # 600
stat -c '%a' ~/.pi/web-search.json         # 600

# 确认 key 没有硬编码
grep -E '(sk-|pplx-|gho_|gsk_|ctx7sk_|key-)' ~/.pi/*.json ~/.pi/agent/*.json \
  && echo "❌ 检出硬编码 key" || echo "✅ 没硬编码 key"

# 确认 git 包是 trusted source
pi list | grep '^git:'    # 只应出现 2 个：codegraph-pi / pi-lsp-client（superpowers 走 npm）
```

## 参考

- pi 官方文档：https://pi.dev
- 调研记录（中文）：见 `docs/decisions.md`
- 排查手册：见 `docs/troubleshooting.md`

## License

MIT — 见 [LICENSE](LICENSE)。本仓库是配置模板，所有引用扩展的 license 见各自上游。