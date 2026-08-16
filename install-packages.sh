#!/usr/bin/env bash
# 只跑 pi install，不动任何配置。给"已经部署好、只想补装包"的场景用。
set -e

PKGS=(
  "npm:pi-context-view"
  "npm:pi-system-prompt"
  "npm:pi-context-breakup"
  "npm:superpowers-zh@latest"   # 中文增强版：14 翻译 + 6 国内原创 skill。英文原版：git:github.com/obra/superpowers（详见 docs/decisions.md 决策 9）
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
  printf "[%2d/%d] %s\n" "$i" "${#PKGS[@]}" "$pkg"
  pi install "$pkg" 2>&1 | tail -2 || true
done

echo ""
echo "✅ 全部命令完成。验证：pi list"
echo "💡 切回英文 superpowers：pi remove npm:superpowers-zh && pi install git:github.com/obra/superpowers"