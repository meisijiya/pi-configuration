#!/usr/bin/env bash
# ============================================================
# pi-configuration deploy script
# 把本仓库的 6 个配置文件部署到 pi 的标准位置，
# 并跑 `pi install` 装齐 14 个扩展包。
# 幂等：可重复运行，已装的会自动跳过。
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

# ---------- 3. 部署配置 ----------
step "3/6 部署配置到标准位置"

mkdir -p "$PI_AGENT"
install -m 644 "$REPO_ROOT/settings.json"      "$PI_AGENT/settings.json"
install -m 600 "$REPO_ROOT/mcp.json"           "$PI_AGENT/mcp.json"
install -m 644 "$REPO_ROOT/tasks-global.json"  "$PI_AGENT/tasks-config.json"
install -m 600 "$REPO_ROOT/web-search.json"    "$PI_HOME/web-search.json"
ok "  ~/.pi/agent/settings.json"
ok "  ~/.pi/agent/mcp.json (600)"
ok "  ~/.pi/agent/tasks-config.json"
ok "  ~/.pi/web-search.json (600)"

# 项目级（只在当前目录有 .pi/ 时部署）
if [ -d ".pi" ]; then
  install -m 644 "$REPO_ROOT/tasks-project.json" ".pi/tasks-config.json"
  ok "  ./.pi/tasks-config.json（项目级 override）"
else
  warn "  当前目录无 .pi/，跳过项目级 config"
  warn "  提示：在项目根目录先跑一次 'pi'，会自动建 .pi/"
fi

# ---------- 4. pi install ----------
step "4/6 跑 pi install（14 个包）"

PKGS=(
  "npm:pi-context-view"
  "npm:pi-system-prompt"
  "npm:pi-context-breakup"
  "git:github.com/obra/superpowers"
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

i=0
for pkg in "${PKGS[@]}"; do
  i=$((i+1))
  echo -e "  ${BLUE}[$i/${#PKGS[@]}]${NC} $pkg"
  pi install "$pkg" 2>&1 | tail -3 || warn "    跳过（可能已装）"
done

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

cat <<EOF

${GREEN}✅ 部署完成${NC}
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
        "help me plan this feature"   # 触发 superpowers brainstorming
        "how does auth.ts work"       # 触发 codegraph
        "show type errors in src/foo.ts"   # 触发 lsp

   4. 完整验证清单见 docs/troubleshooting.md

EOF