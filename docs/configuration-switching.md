# 配置切换指南（Configuration Switching）

> 本指南面向**已安装**本仓库配置、想在不同 preset 之间切换的用户。
> 首次安装走 [INSTALL.md](INSTALL.md)（Agent 引导决策 + 6 步安装）；本文只讲**切换**。

## 0. 四个 preset 一览

| Preset | Lane | superpowers | PKGS | 配套 agent / extension |
|---|---|---|---|---|
| `settings.lane-a.zh.json` | A | `npm:superpowers-zh@latest`（中文增强版） | 14 | 9 个 subagent + write-guard.ts |
| `settings.lane-a.en.json` | A | `git:github.com/obra/superpowers`（英文原版） | 14 | 同上 |
| `settings.lane-a.bare.json` | A | 无 | 13 | 同上 |
| `settings.lane-b.json` | B | 撤除，改用 `git:github.com/mattpocock/skills` 官方版（25 stable skill） | 13 | 撤 `tdd-guide` / `code-reviewer`；加 `git-guard.ts` + `migrate-skill-lock.ts`（OVERRIDDEN 25 项） |

**切换的本质** = 「cp 目标 preset 覆盖 settings.json」+「`pi remove` / `pi install` 对齐 package 差异」+「按 Lane 增删 agent/extension」。三者缺一不可。

---

## 1. 切换前：先备份（每次都要）

```bash
PI_AGENT="$HOME/.pi/agent"
TS="$(date +%Y%m%d-%H%M%S)"
BACKUP="$PI_AGENT/backup-switch-$TS"
mkdir -p "$BACKUP"
cp "$PI_AGENT/settings.json" "$BACKUP/" 2>/dev/null || true
[ -d "$PI_AGENT/agents" ]    && cp -r "$PI_AGENT/agents"    "$BACKUP/agents"
[ -d "$PI_AGENT/extensions" ] && cp -r "$PI_AGENT/extensions" "$BACKUP/extensions"
echo "✅ 备份到 $BACKUP"
```

> 回滚 = 从 `$BACKUP` 把三个东西 cp 回去（见 [§6 回滚](#6-回滚)）。

---

## 2. 切换矩阵（速查）

| 从 → 到 | remove | install | 额外步骤 |
|---|---|---|---|
| A.zh → A.en | `npm:superpowers-zh` | `git:github.com/obra/superpowers` | 无 |
| A.en → A.zh | `git:github.com/obra/superpowers` | `npm:superpowers-zh@latest` | 无 |
| A.zh/A.en → A.bare | `npm:superpowers-zh`（或 `git:github.com/obra/superpowers`） | — | 无 |
| A.bare → A.zh/A.en | — | `npm:superpowers-zh@latest`（或 obra） | 无 |
| A → B | `npm:superpowers-zh`（或 obra）+ `npm:pi-simplify` | `git:github.com/mattpocock/skills` | 撤 2 agent + 加 1 extension + 1 standalone script + 装载 matt skill（见 §4） |
| B → A | `git:github.com/mattpocock/skills` | `npm:superpowers-zh@latest`（或 obra）+ `npm:pi-simplify` | 加回 2 agent（见 §5） |

---

## 3. Lane A 内部切换（superpowers 中文 ↔ 英文 ↔ 不装）

**前提**：`REPO_ROOT` 指向本仓库克隆目录。

### 3.1 中文 → 英文

```bash
REPO_ROOT=/path/to/pi-configuration
cp "$REPO_ROOT/presets/settings.lane-a.en.json" ~/.pi/agent/settings.json
pi remove npm:superpowers-zh
pi install git:github.com/obra/superpowers
```

### 3.2 英文 → 中文

```bash
cp "$REPO_ROOT/presets/settings.lane-a.zh.json" ~/.pi/agent/settings.json
pi remove git:github.com/obra/superpowers
pi install npm:superpowers-zh@latest
```

### 3.3 中文/英文 → 不装 superpowers

```bash
cp "$REPO_ROOT/presets/settings.lane-a.bare.json" ~/.pi/agent/settings.json
pi remove npm:superpowers-zh          # 当前是中文版
# 或 pi remove git:github.com/obra/superpowers   # 当前是英文版
```

### 3.4 不装 → 中文/英文

```bash
cp "$REPO_ROOT/presets/settings.lane-a.zh.json" ~/.pi/agent/settings.json   # 或 .en.json
pi install npm:superpowers-zh@latest   # 或 git:github.com/obra/superpowers
```

**验证**（Lane A 通用）：

```bash
pi list | grep -E 'superpowers|^git:'   # 确认 superpowers 源正确
pi
> /simplify          # pi-simplify 仍在 → 应可用
> /skills            # 中文版见 20 个 superpowers-zh skill；英文版见 14 个 obra skill；bare 无
```

---

## 4. Lane A → Lane B（装 mattpocock/skills 25 stable skill）

> ⚠️ 这是改动最大的一次切换。**务必先做 §1 备份。**

```bash
REPO_ROOT=/path/to/pi-configuration

# 4.1 覆盖 settings 模板
cp "$REPO_ROOT/presets/settings.lane-b.json" ~/.pi/agent/settings.json

# 4.2 撤 superpowers + pi-simplify
pi remove npm:superpowers-zh                  # 或 git:github.com/obra/superpowers
pi remove npm:pi-simplify

# 4.3 装 mattpocock/skills 装载源（经 packages filter 装 25 stable）
pi install git:github.com/mattpocock/skills

# 4.4 撤 2 个被 matt 覆盖的 agent
rm -f ~/.pi/agent/agents/tdd-guide.md ~/.pi/agent/agents/code-reviewer.md

# 4.5 部署 Lane B 新增的 git-guard extension（若还没部署；deploy.sh 已自动做）
mkdir -p ~/.pi/agent/extensions
cp "$REPO_ROOT/extensions/git-guard.ts" ~/.pi/agent/extensions/
# 注意：migrate-skill-lock.ts 是 standalone 脚本（scripts/ 下），不要 cp 进 extensions/，
#       否则会被 pi 当作 extension 自动加载。

# 4.6 装载 25 stable skill（pi convention 自动发现；详见 INSTALL.md §5a）
#     到 ~/.pi/agent/skills/

# 4.7 同步 .skill-lock.json（把 25 stable skill 对齐到 mattpocock/skills 源 + 更新 tree SHA）
node "$REPO_ROOT/scripts/migrate-skill-lock.ts"

# 4.8 启动 pi 跑强制 init（让 agent 帮跑，或手动）
#   /skill:setup-matt-pocock-skills
```

**验证**（Lane B）：

```bash
pi
> /simplify            # ❌ 期望未知命令（pi-simplify 已撤）
> /skill:code-review   # ✅ matt code-review
> /skills              # 应见 25 个 matt skill + 7 个 subagent
```

---

## 5. Lane B → Lane A（回到 superpowers 路线）

```bash
REPO_ROOT=/path/to/pi-configuration

# 5.1 覆盖 settings 模板（选 zh / en / bare 之一）
cp "$REPO_ROOT/presets/settings.lane-a.zh.json" ~/.pi/agent/settings.json

# 5.2 撤 mattpocock/skills
pi remove git:github.com/mattpocock/skills

# 5.3 装回 superpowers + pi-simplify（bare 则不装 superpowers）
pi install npm:superpowers-zh@latest    # 或 git:github.com/obra/superpowers
pi install npm:pi-simplify@latest

# 5.4 加回 2 个 agent
cp "$REPO_ROOT/agents/tdd-guide.md"      ~/.pi/agent/agents/
cp "$REPO_ROOT/agents/code-reviewer.md"  ~/.pi/agent/agents/

# 5.5 撤 Lane B 专属 extension（可选——不删也只是白占位，write-guard 已默认放行）
rm -f ~/.pi/agent/extensions/git-guard.ts
```

> 注：`git-guard.ts` 留在 `~/.pi/agent/extensions/` 里对 Lane A 只是拦危险 git 子命令，删除只是保持整洁。
> `migrate-skill-lock.ts` 是 standalone 脚本（`scripts/` 下），本就不在自动加载目录。

---

## 6. 回滚

```bash
# 找到最近一次切换备份
BACKUP=$(ls -dt ~/.pi/agent/backup-switch-* 2>/dev/null | head -1)
# 或 install 阶段的备份：ls -dt ~/.pi/agent/backup-* | head -1

cp "$BACKUP/settings.json" ~/.pi/agent/settings.json
[ -d "$BACKUP/agents" ]     && cp -r "$BACKUP/agents"/*     ~/.pi/agent/agents/
[ -d "$BACKUP/extensions" ] && cp -r "$BACKUP/extensions"/* ~/.pi/agent/extensions/

# 按需把 package 也撤/装回（对照 §2 矩阵反向操作）
```

---

## 7. 已知坑（切换必读）

### 7.1 `deploy.sh` 现在支持 preset 选择

`deploy.sh` 已改为 `bash deploy.sh <lane>`（默认 `lane-a.zh`），会：
- 部署对应 `presets/settings.<lane>.json`（不再覆盖成根 `settings.json`）；
- 从该 preset 的 `packages` 数组跑 `pi install`（不再硬编码包列表）；
- 按 lane 增删 agent / extension。

所以**切换可以直接跑 `bash deploy.sh lane-b`** 等。但注意：deploy.sh 只负责 `pi install`，
Lane B 的 mattpocock/skills 25 stable skill 装载（pi convention 自动）、`/skill:setup-matt-pocock-skills`、`migrate-skill-lock.ts` 仍需手动（§4.6–4.8）。

### 7.2 `write-guard.ts` 已改为默认放行

`write-guard.ts` 旧版会全局拦截主对话所有 write/edit（实测已复现）。现版本**默认放行**，
严格白名单仅在 `WRITE_GUARD_STRICT=1` 时启用。所以切换后主对话能正常写文件是**预期行为**，不是 bug。

### 7.3 mattpocock/skills 装载路径 + migrate-skill-lock

INSTALL.md §5a 里 `~/.pi-test/agent/skills/` 是占位符，实际目标应是 `~/.pi/agent/skills/`。
`migrate-skill-lock.ts` 现在**通过 GitHub API 拉取 mattpocock/skills 的 tree 取 tree SHA**（与 `npx skills update` 比对逻辑一致），
不读本地 skill 文件；离线时会报错并跳过该条目，不会写入错误 hash。

### 7.4 个人模型偏好

preset 已不写模型——只声明 `packages`，`deploy.sh` 只更新 `packages` 字段，不覆盖你的
`defaultProvider` / `defaultModel` / `theme` 等。所以切换后你的模型配置**会保留**，无需改回。
（见 [decisions.md](decisions.md) 决策 5）

---

**文档结束。切换只动 settings.json + package + agent/extension，不动其它配置文件（mcp.json / tasks-config.json / web-search.json）。**
