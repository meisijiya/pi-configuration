# 常见问题排查

## 安装阶段

### Q1：`pi install` 报 "bash -c ... failed with code 1"

**症状**：
```
Error: bash -c source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npm install <pkg> ... failed with code 1
```

**原因**：`settings.json` 里写了 `npmCommand: ["bash", "-c", "..."]`，pi 把 install args 当成 bash positional 传，npm 没收到参数。

**修法**：
1. **首选**：删掉 settings.json 里的 `npmCommand` 字段。交互 shell 的 PATH 已有 nvm，pi 子进程继承。
2. **次选**：用 `exec npm "$@"` 透传：
   ```jsonc
   "npmCommand": ["bash", "-c", "source ~/.nvm/nvm.sh >/dev/null 2>&1 && exec npm \"$@\"", "npm-via-nvm"]
   ```
3. **彻底**：symlink 到 `/usr/local/bin`：
   ```bash
   sudo ln -sf ~/.nvm/versions/node/v22.23.1/bin/npm /usr/local/bin/npm
   sudo ln -sf ~/.nvm/versions/node/v22.23.1/bin/npx /usr/local/bin/npx
   ```

详见 `decisions.md` 决策 2。

---

### Q2：`codegraph init -i` 慢 / 卡住

**症状**：第一次跑 codegraph init 等几分钟没反应。

**正常**：大型 monorepo（>10k 文件）首次索引可能要 5-10 分钟。

**优化**：
```bash
# 加 -v 看进度
codegraph init -i -v

# 排除不必要的目录（在 .codegraph/source.json 里改）
{
  "sourceDir": "/your/project",
  "ignore": ["node_modules", ".git", "dist", "build", "target"]
}
```

---

### Q3：`apt install ffmpeg yt-dlp` 失败 / sudo 密码

**症状**：在 WSL 里跑 apt 报密码错误。

**修法**：
```bash
# 方式 A：当前用户已在 sudo 组，直接输密码
sudo apt install -y ffmpeg yt-dlp

# 方式 B：apt 缓存过期
sudo apt update && sudo apt install -y ffmpeg yt-dlp

# 方式 C：换镜像（阿里云）
sudo sed -i 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list.d/ubuntu.sources
sudo apt update && sudo apt install -y ffmpeg yt-dlp
```

---

## 运行阶段

### Q4：`pi` 启动报 "package not found"

**症状**：
```
Error: package not installed: npm:@upstash/context7-pi
```

**原因**：settings.json 里写了，但没跑 `pi install`。

**修法**：
```bash
./install-packages.sh    # 重跑所有 install
# 或单装：
pi install npm:@upstash/context7-pi@latest
```

---

### Q5：codegraph tool 在 pi 里不出现

**症状**：在 pi 里说"how does X work"，agent 用 grep 而不是 codegraph。

**原因**：当前目录没 `.codegraph/`。

**修法**：
```bash
cd /your/project
codegraph init -i    # 一次性
# 之后 watcher 自动同步
```

**验证**：
```bash
codegraph status    # 应有 Files > 0
ls .codegraph/      # 应有 codegraph.db
```

---

### Q6：`/tasks` 不显示 widget

**症状**：跑 `/tasks` 命令没反应。

**可能原因**：
1. `pi-tasks` 没装 → `pi install npm:@tintinweb/pi-tasks@latest`
2. settings 里 `hideThinkingBlock: false` 但 TUI 模式不对 → 确认 `tuiMode: "fullscreen"`
3. 全局 / 项目 tasks-config 冲突 → 检查 `~/.pi/agent/tasks-config.json` 和 `<cwd>/.pi/tasks-config.json`

---

### Q7：`/websearch` 报 "no provider configured"

**症状**：`/websearch react` 报无 provider。

**修法**：零配置应该自动用 Exa MCP。如果还报：
1. 确认 `~/.pi/web-search.json` 存在
2. 加一个 paid provider key（OpenAI / Brave / Gemini 任意）：
   ```jsonc
   {
     "openaiApiKey": "$OPENAI_API_KEY",
     ...
   }
   ```
3. export env：
   ```bash
   export OPENAI_API_KEY="sk-..."
   ```
4. 重启 pi

---

### Q8：LSP `/lsp status` 报 "not installed"

**症状**：`/lsp status` 显示 TypeScript / Python 等 server 未装。

**修法**：
- 自动装（白名单内的 server）：
  ```
  /lsp install typescript-language-server
  ```
- 手动装：
  ```bash
  # TypeScript
  npm i -g typescript-language-server
  
  # Python
  pip install pyright
  
  # Rust
  rustup component add rust-analyzer
  ```

完整 server 列表见 `pi-lsp-client` README：
https://github.com/code-yeongyu/pi-lsp-client

---

## 性能 / 资源

### Q9：两个 agent 同时跑同 workspace 时 codegraph 报错

**症状**：OpenCode + pi 同时开，两个都 spawn `codegraph serve --mcp`，偶发 "database is locked"。

**原因**：SQLite WAL + 单 writer。两个 watcher 偶尔撞锁。

**严重程度**：低。SQLite 会自动重试，不会损坏数据。可能瞬间读到稍微陈旧的数据。

**修法**：
- **简单**：别同时开两个 agent
- **复杂**：把 OMO 的 `codegraph serve` 改成只读模式（修改 ~/.omo/ 配置）
- **最简**：跑完一个再开另一个

---

### Q10：内存占用高（>1GB）

**症状**：`htop` 看 pi 占用内存大。

**诊断**：
```bash
# 看 pi 子进程
pgrep -P $(pgrep -f "^pi$") -a

# 通常是 npm 子进程 + codegraph serve
```

**优化**：
- `pi-web-access` 7MB unpacked 但运行时小（按需起 worker）
- `codegraph serve --mcp` 长期占 ~150-300MB
- LSP server 按需起，空闲 5 分钟自动 reap

**底线**：正常 500-800MB。如果你跑了多个 pi session 同时 + MCP + LSP，1-2GB 正常。

---

## 安全

### Q11：如何确认敏感文件权限

```bash
stat -c '%a %n' ~/.pi/agent/mcp.json
stat -c '%a %n' ~/.pi/web-search.json
# 都应是 600
```

修法：
```bash
chmod 600 ~/.pi/agent/mcp.json
chmod 600 ~/.pi/web-search.json
```

---

### Q12：如何确认 key 没硬编码

```bash
grep -rE '(sk-|pplx-|gho_|gsk_|ctx7sk_|key-)' ~/.pi/ \
  --include='*.json' 2>/dev/null
# 应该没输出
```

如果检出：把硬编码 key 改成 `$ENV_VAR` 引用，并立刻在对应平台 revoke 这个 key。

---

## GitHub push 失败

### Q13：`gh repo create` 报 "already exists"

如果远程仓库已被人创建过：
```bash
git remote add origin https://github.com/meisijiya/pi-configuration.git
git push -u origin main
```

### Q14：推送 403 / 权限错误

```bash
# 重新登录 gh
gh auth logout
gh auth login
```

---

## 还原 / 卸载

### Q15：完全卸载回到默认 pi

```bash
# 1. 卸所有扩展包
for pkg in $(pi list | awk '/^(npm|git):/{print $1}'); do
  pi remove "$pkg"
done

# 2. 删配置（备份已自动留在 ~/.pi/agent/backup-*/）
rm ~/.pi/agent/settings.json \
   ~/.pi/agent/mcp.json \
   ~/.pi/agent/tasks-config.json \
   ~/.pi/web-search.json

# 3. 项目级 .pi/（每个项目分别删）
rm -rf /your/project/.pi/tasks-config.json

# 4. 验证回到原始状态
pi list    # 应只显示你原本的内置包
```