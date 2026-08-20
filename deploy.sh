#!/usr/bin/env bash
# ============================================================
# pi-configuration deploy script
# 用法：
#   bash deploy.sh [lane-a.zh|lane-a.en|lane-a.bare|lane-b]
# 默认 lane-a.zh。按所选 preset 部署 settings.json + agents + extensions，
# 并从该 preset 的 packages 装齐 pi 包。幂等：可重复运行。
# ============================================================
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PI_AGENT="$HOME/.pi/agent"
PI_HOME="$HOME/.pi"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP_DIR="$PI_AGENT/backup-$TS"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

step()  { echo -e "${BLUE}▶${NC} $*"; }
ok()    { echo -e "${GREEN}✓${NC} $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
err()   { echo -e "${RED}✗${NC}  $*"; exit 1; }

# ---------- 0. 解析 USER_CHOICE ----------
USER_CHOICE="${1:-${USER_CHOICE:-lane-a.zh}}"
case "$USER_CHOICE" in
  lane-a.zh|lane-a.en|lane-a.bare|lane-b) ;;
  *) err "USER_CHOICE 必须是 lane-a.zh / lane-a.en / lane-a.bare / lane-b 之一，实际: $USER_CHOICE" ;;
esac
PRESET="$REPO_ROOT/presets/settings.$USER_CHOICE.json"
[ -f "$PRESET" ] || err "preset 不存在: $PRESET"
step "preset = $USER_CHOICE（$PRESET）"

# ---------- 1. 前置检查 ----------
step "1/6 检查前置依赖"

for cmd in node npm pi; do
  command -v "$cmd" >/dev/null 2>&1 || err "缺少必需命令：$cmd"
done
ok "node / npm / pi 已装"

command -v codegraph >/dev/null 2>&1 \
  && ok "codegraph 已装" \
  || warn "codegraph 未装 — 装：npm i -g @colbymchenry/codegraph"

command -v ffmpeg >/dev/null 2>&1 \
  && ok "ffmpeg 已装" \
  || warn "ffmpeg 未装 — 装：sudo apt install ffmpeg（pi-web-access 视频功能需要）"

command -v yt-dlp >/dev/null 2>&1 \
  && ok "yt-dlp 已装" \
  || warn "yt-dlp 未装 — 装：sudo apt install yt-dlp"

command -v rtk >/dev/null 2>&1 \
  && ok "rtk 已装" \
  || warn "rtk 未装 — 可选 token killer"

# ---------- 2. 备份 ----------
step "2/6 备份现有配置 → $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

for f in settings.json mcp.json tasks-config.json; do
  if [ -f "$PI_AGENT/$f" ]; then
    cp "$PI_AGENT/$f" "$BACKUP_DIR/$f"
    ok "  备份 $f"
  fi
done

if [ -f "$PI_HOME/web-search.json" ]; then
  cp "$PI_HOME/web-search.json" "$BACKUP_DIR/web-search.json"
  ok "  备份 ~/.pi/web-search.json"
fi

[ -d "$PI_AGENT/agents" ]    && cp -r "$PI_AGENT/agents"    "$BACKUP_DIR/agents"    && ok "  备份 agents/"
[ -d "$PI_AGENT/extensions" ] && cp -r "$PI_AGENT/extensions" "$BACKUP_DIR/extensions" && ok "  备份 extensions/"

# ---------- 3. 部署配置 ----------
step "3/6 部署配置（preset: $USER_CHOICE）"

mkdir -p "$PI_AGENT"
install -m 644 "$PRESET"                          "$PI_AGENT/settings.json"
install -m 600 "$REPO_ROOT/mcp.json"              "$PI_AGENT/mcp.json"
install -m 644 "$REPO_ROOT/tasks-global.json"     "$PI_AGENT/tasks-config.json"
install -m 600 "$REPO_ROOT/web-search.json"       "$PI_HOME/web-search.json"
ok "  ~/.pi/agent/settings.json（来自 $USER_CHOICE）"
ok "  ~/.pi/agent/mcp.json (600)"
ok "  ~/.pi/agent/tasks-config.json"
ok "  ~/.pi/web-search.json (600)"

# Agent 定义（9 个 subagent；Lane B 撤 tdd-guide / code-reviewer）
mkdir -p "$PI_AGENT/agents"
for f in "$REPO_ROOT"/agents/*.md; do
  [ -f "$f" ] || continue
  [[ "$f" == *":Zone.Identifier" ]] && continue
  name="$(basename "$f")"
  if [ "$USER_CHOICE" = "lane-b" ] && { [ "$name" = "tdd-guide.md" ] || [ "$name" = "code-reviewer.md" ]; }; then
    continue
  fi
  install -m 644 "$f" "$PI_AGENT/agents/$name"
done
if [ "$USER_CHOICE" = "lane-b" ]; then
  # 清掉机器上可能残留的旧 agent（deploy.sh 不覆盖删除，需显式清）
  for old in tdd-guide.md code-reviewer.md; do
    if [ -f "$PI_AGENT/agents/$old" ]; then
      warn "删除 Lane B 不需要的旧 agent: $old"
      rm -f "$PI_AGENT/agents/$old"
    fi
  done
fi
ok "  ~/.pi/agent/agents/"

# 自定义 extension（只部署真正的 extension；scripts/migrate-skill-lock.ts 是 standalone 脚本，不在此列）
mkdir -p "$PI_AGENT/extensions"
install -m 644 "$REPO_ROOT/extensions/write-guard.ts" "$PI_AGENT/extensions/write-guard.ts"
if [ "$USER_CHOICE" = "lane-b" ]; then
  install -m 644 "$REPO_ROOT/extensions/git-guard.ts" "$PI_AGENT/extensions/git-guard.ts"
fi
ok "  ~/.pi/agent/extensions/（write-guard 始终 + git-guard 仅 lane-b）"

# 项目级（只在当前目录有 .pi/ 时部署）
if [ -d ".pi" ]; then
  install -m 644 "$REPO_ROOT/tasks-project.json" ".pi/tasks-config.json"
  ok "  ./.pi/tasks-config.json（项目级 override）"
else
  warn "  当前目录无 .pi/，跳过项目级 config"
  warn "  提示：在项目根目录先跑一次 'pi'，会自动建 .pi/"
fi

# ---------- 4. pi install ----------
step "4/6 跑 pi install（packages 来自 $USER_CHOICE）"

mapfile -t PKGS < <(node -e 'process.stdout.write(require(process.argv[1]).packages.join("\n"))' "$PRESET")

i=0
for pkg in "${PKGS[@]}"; do
  i=$((i+1))
  echo -e "  ${BLUE}[$i/${#PKGS[@]}]${NC} $pkg"
  pi install "$pkg" 2>&1 | tail -3 || warn "    跳过（可能已装）"
done
ok "  共 ${#PKGS[@]} 个包"

# ---------- 5. 验证 ----------
step "5/6 验证"

if pi list >/dev/null 2>&1; then
  INSTALLED=$(pi list 2>/dev/null | grep -cE "^(npm|git):" || echo 0)
  ok "pi list 输出 $INSTALLED 条已装包"
fi

for f in "$PI_AGENT/settings.json" "$PI_AGENT/mcp.json" "$PI_AGENT/tasks-config.json" "$PI_HOME/web-search.json"; do
  [ -f "$f" ] && ok "$f 存在" || err "$f 缺失"
done

# ---------- 6. 下一步提示 ----------
step "6/6 完成"

if [ "$USER_CHOICE" = "lane-b" ]; then
cat <<EOF

${GREEN}✅ 部署完成（Lane B）${NC}
   备份目录：$BACKUP_DIR

Lane B 还有 4 个额外步骤（详见 INSTALL.md §5a-d）：
   5a. 装载 omo-skills 25 个 skill 到 ~/.pi/agent/skills/
   5b. 启动 pi 跑 /skill:setup-matt-pocock-skills 强制 init
   5c. 跑 node scripts/migrate-skill-lock.ts（同步 lock）
   5d. 跑 smoke test 验证 git-guard 生效

   验证：pi
     /simplify            # ❌ 期望未知命令（已撤 pi-simplify）
     /skill:code-review   # ✅ omo code-review
EOF
else
cat <<EOF

${GREEN}✅ 部署完成（$USER_CHOICE）${NC}
   备份目录：$BACKUP_DIR

下一步：
   1. 启动 pi：
        cd /your/project   # 任意代码项目
        pi

   2. 测 slash commands：
        /plan        # pi-plan-mode
        /tasks       # pi-tasks widget
        /simplify    # pi-simplify
        /websearch react   # pi-web-access

   3. 触发各 skill：
        "help me plan this feature"     # superpowers brainstorming
        "how does auth.ts work"         # codegraph
        "show type errors in src/foo.ts"   # lsp

   4. 完整验证清单见 docs/troubleshooting.md

EOF
fi
