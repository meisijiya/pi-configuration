#!/usr/bin/env bash
# 只跑 pi install（从当前已部署的 ~/.pi/agent/settings.json 读 packages），不动任何配置。
# 给"已经部署好、只想补装/重装包"的场景用。
set -e

PI_AGENT="${HOME}/.pi/agent"
SETTINGS="${PI_AGENT}/settings.json"

if [ ! -f "$SETTINGS" ]; then
  echo "❌ $SETTINGS 不存在——先跑 bash deploy.sh [lane-...] 部署"
  exit 1
fi

mapfile -t PKGS < <(node -e 'process.stdout.write(require(process.argv[1]).packages.join("\n"))' "$SETTINGS")

i=0
for pkg in "${PKGS[@]}"; do
  i=$((i+1))
  printf "[%2d/%d] %s\n" "$i" "${#PKGS[@]}" "$pkg"
  pi install "$pkg" 2>&1 | tail -2 || true
done

echo ""
echo "✅ 全部命令完成（${#PKGS[@]} 个包）。验证：pi list"
echo "💡 切换配置见 docs/configuration-switching.md"
