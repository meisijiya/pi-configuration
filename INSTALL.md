# INSTALL.md — 安装协议（Agent 执行 / 用户确认）

> **本文件给 AI Agent 执行**。Agent 按 [AGENTS.md](AGENTS.md) 引导用户做完决策后，按本文档 6 步走安装流程。
> **每一步执行前必须告知用户当前要做什么**——不静默运行破坏性命令。

---

## 0. 前置约定

- 所有命令以**用户身份**运行（不用 sudo）
- 备份目录：`~/.pi/agent/backup-<时间戳>/`，deploy.sh 自动创建
- 所有 `cp` / `install -m` 命令前**先告知用户**目标路径
- 任何 `rm -rf` 命令**禁止在用户未确认时执行**

---

## 1. 前置检查

```bash
# 必装工具
command -v node  >/dev/null || { echo "❌ 缺 node"; exit 1; }
command -v npm   >/dev/null || { echo "❌ 缺 npm"; exit 1; }
command -v pi    >/dev/null || { echo "❌ 缺 pi（npm i -g @earendil-works/pi-coding-agent）"; exit 1; }

# 可选工具（缺则 warn 不 exit）
command -v codegraph >/dev/null || echo "⚠️ codegraph 未装（nosuiyi/codegraph-pi 需要）"
command -v ffmpeg    >/dev/null || echo "⚠️ ffmpeg 未装（pi-web-access 视频功能需要）"
command -v yt-dlp    >/dev/null || echo "⚠️ yt-dlp 未装"
command -v rtk       >/dev/null || echo "⚠️ rtk 未装（可选）"
```

**汇报**：列出哪些装了 / 哪些缺了 / 缺的如何装（参考 README.md "快速开始"）。

---

## 2. 备份

```bash
PI_AGENT="$HOME/.pi/agent"
PI_HOME="$HOME/.pi"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$PI_AGENT/backup-$TS"
mkdir -p "$BACKUP_DIR"

# 备份可能被覆盖的 6 个文件
for f in settings.json mcp.json tasks-config.json; do
  [ -f "$PI_AGENT/$f" ] && cp "$PI_AGENT/$f" "$BACKUP_DIR/$f"
done
[ -f "$PI_HOME/web-search.json" ] && cp "$PI_HOME/web-search.json" "$BACKUP_DIR/web-search.json"

# Lane B 还备份 agents/ 和 extensions/（部分会删/改）
[ -d "$PI_AGENT/agents" ]    && cp -r "$PI_AGENT/agents"    "$BACKUP_DIR/agents"
[ -d "$PI_AGENT/extensions" ] && cp -r "$PI_AGENT/extensions" "$BACKUP_DIR/extensions"

echo "✅ 备份到 $BACKUP_DIR"
```

**汇报**：告诉用户备份目录路径——出问题时回滚用。

---

## 3. 确认用户选的 settings 模板

**关键步骤**——按 [AGENTS.md §3 决策树](AGENTS.md#3-安装步骤始终执行) 结果确认 `USER_CHOICE`。
实际写入由 §5 的 `deploy.sh "$USER_CHOICE"` 完成（只更新 packages 字段、保留个人偏好），本步只做**确认 + 预览**。

```bash
REPO_ROOT="$(pwd)"   # 当前仓库根目录
USER_CHOICE="${USER_CHOICE:-lane-a.zh}"
TEMPLATE="$REPO_ROOT/presets/settings.$USER_CHOICE.json"

case "$USER_CHOICE" in
    lane-a.zh|lane-a.en|lane-a.bare|lane-b) ;;
    *) echo "❌ USER_CHOICE 必须是 lane-a.zh / lane-a.en / lane-a.bare / lane-b 之一"; exit 1 ;;
esac
[ -f "$TEMPLATE" ] || { echo "❌ 模板不存在: $TEMPLATE"; exit 1; }

# 预览该 preset 的 packages（不实际写入——deploy.sh 会做 merge）
echo "📋 将使用 preset: $TEMPLATE"
node -e 'const d=require(process.argv[1]); console.log("packages（" + d.packages.length + " 个）"); for (const p of d.packages) console.log("   - " + p);' "$TEMPLATE"
```

**USER_CHOICE 取值**：

| AGENTS.md 决策结果 | USER_CHOICE |
|---|---|
| 决策 1 = A + 决策 2 = 中文 | `lane-a.zh` |
| 决策 1 = A + 决策 2 = 英文 | `lane-a.en` |
| 决策 1 = A + 决策 2 = 不装 | `lane-a.bare` |
| 决策 1 = B | `lane-b` |

**汇报**：告诉用户选了哪个 preset / 该 preset 有多少个包（部署由 §5 完成）。

---

## 4. 部署 agents/ + extensions/（由 deploy.sh 完成）

`deploy.sh` 已按 `USER_CHOICE` 做 lane 感知部署，**无需再手动循环**：

- **agents/**：9 个 subagent；Lane B 自动跳过并删除 `tdd-guide.md` / `code-reviewer.md`。
- **extensions/**：`write-guard.ts` 两 lane 都装；`git-guard.ts` 仅 Lane B 装。
- `scripts/migrate-skill-lock.ts` 是 standalone 脚本，**不会**被拷贝到 `~/.pi/agent/extensions/`（避免被当作 extension 自动加载）。

---

## 5. 跑 deploy.sh

```bash
REPO_ROOT="$(pwd)"
cd "$REPO_ROOT"
bash deploy.sh "$USER_CHOICE"    # lane-a.zh / lane-a.en / lane-a.bare / lane-b
```

**deploy.sh 已做**：
- 检查前置（已跑过 §1，可跳）
- 备份（已跑过 §2，会再备份一次——幂等）
- 按 `USER_CHOICE` 部署 preset 的 settings.json + agents + extensions（替代旧 §3 + §4 的手动步骤，幂等）
- 从该 preset 的 `packages` 数组跑 `pi install`（不再硬编码包列表）
- 验证（`pi list` 检查）

**Lane B 额外步骤**（**只在 §5 完成后跑**）：

```bash
if [ "${USER_CHOICE}" == "lane-b" ]; then
    # 5a. 装载 omo-skills 25 个 skill 到 ~/.pi/agent/skills/
    # deploy.sh 已经 pi install 了 git:github.com/meisijiya/omo-skills
    # 但 pi install 只是声明源，实际装载需要 cp -r（INSTALL.md §5a-Lane-B）
    cd /path/to/omo-skills   # 用户需先 git clone
    for s in \
      ask-matt code-review codebase-design diagnosing-bugs \
      domain-modeling grill-with-docs implement \
      improve-codebase-architecture prototype research \
      resolving-merge-conflicts setup-matt-pocock-skills tdd \
      to-spec to-tickets triage wayfinder wizard; do
      cp -r skills/engineering/$s ~/.pi-test/agent/skills/   # 实际用 ~/.pi/agent/skills/
    done
    for s in \
      grill-me grilling handoff teach to-questionnaire \
      wait-what writing-for-agents; do
      cp -r skills/productivity/$s ~/.pi-test/agent/skills/   # 实际用 ~/.pi/agent/skills/
    done
    echo "✅ omo-skills 25 skill 已装载"

    # 5b. 跑 /skill:setup-matt-pocock-skills 强制 init
    # （让 Agent 帮用户跑，或用户自己启动 pi 跑）
    echo "📋 启动 pi 跑 /skill:setup-matt-pocock-skills 强制 init"

    # 5c. 跑 scripts/migrate-skill-lock.ts（手动或 cron）
    # （本仓 deploy.sh 不自动跑——避免破坏用户 lock 文件）
    echo "📋 手动跑：node scripts/migrate-skill-lock.ts（同步 lock 文件）"

    # 5d. 跑 git-guard.ts smoke test（参考 docs/omo-skills-integration.md §5.2）
    echo "📋 跑 smoke test 验证 Lane B 全部配置生效"
fi
```

**Lane A 不需要 §5a-d**——Lane A 的 PKGS 全在 `npm:` / `git:` 源里，`pi install` 一次解决。

---

## 6. 验证

**通用验证（两 Lane 都跑）**：

```bash
pi list 2>&1 | head -30
# 期望：
#   Lane A.zh: 14 个 package（含 superpowers-zh）
#   Lane A.en: 14 个 package（含 obra/superpowers）
#   Lane A.bare: 13 个 package（无 superpowers）
#   Lane B: 13 个 package（含 meisijiya/omo-skills）

# 配置文件存在 + 权限
for f in settings.json mcp.json tasks-config.json web-search.json; do
    [ -f "$HOME/.pi/agent/$f" -o -f "$HOME/.pi/$f" ] || echo "❌ $f 缺失"
done
[ "$(stat -c '%a' "$HOME/.pi/agent/mcp.json")" = "600" ] || echo "❌ mcp.json 权限不是 600"
[ "$(stat -c '%a' "$HOME/.pi/web-search.json")" = "600" ] || echo "❌ web-search.json 权限不是 600"

# 无硬编码 key
grep -E '(sk-|pplx-|gho_|gsk_|ctx7sk_|key-)' ~/.pi/*.json ~/.pi/agent/*.json \
  && echo "❌ 检出硬编码 key" || echo "✅ 没硬编码 key"
```

**Lane A 验证**：

```bash
pi
> /simplify                       # Lane A.zh/.en 应可用（pi-simplify 仍装）
> how does auth.ts work           # 触发 codegraph / explore
> help me plan this feature       # 触发 superpowers brainstorming（如果装了 superpowers）
> /skills                         # 看 superpowers / agent 列表
```

**Lane B 验证**：

```bash
pi
> /simplify                       # ❌ Lane B 已撤 pi-simplify，期望未知命令
> /skill:code-review              # ✅ Lane B 用 omo code-review
> /skill:grill-me                 # ✅ omo grill-me
> /skill:setup-matt-pocock-skills # ✅ 已 init（§5b 跑过）
> /skills                         # 应见 25 个 omo skill + 7 个 subagent
```

---

## 7. 回滚（出问题时）

```bash
# 找到最近的备份
ls -dt ~/.pi/agent/backup-* | head -1

# 回滚整个目录
BACKUP=$(ls -dt ~/.pi/agent/backup-* | head -1)
cp "$BACKUP/settings.json"      ~/.pi/agent/settings.json
cp "$BACKUP/mcp.json"           ~/.pi/agent/mcp.json
cp "$BACKUP/tasks-config.json"  ~/.pi/agent/tasks-config.json
cp "$BACKUP/web-search.json"    ~/.pi/web-search.json
[ -d "$BACKUP/agents" ]    && cp -r "$BACKUP/agents"/*    ~/.pi/agent/agents/
[ -d "$BACKUP/extensions" ] && cp -r "$BACKUP/extensions"/* ~/.pi/agent/extensions/

# 回滚 pi 装的包
for pkg in $(pi list 2>/dev/null | grep -oE '(npm|git):[^ ]+'); do
    pi remove "$pkg" 2>/dev/null
done

# Lane B 回滚装 superpowers-zh（如需要回到默认）
pi install npm:superpowers-zh@latest
```

---

**文档结束。本协议是 AGENTS.md 引导后的具体执行步骤——前者是"决策"，后者是"动手"。**
