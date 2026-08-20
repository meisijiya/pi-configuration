// git-guard extension
// 拦截 bash 工具里危险 git 子命令（reset --hard / push --force / clean -fd 等）
// 替代 mattpocock/skills 的 misc/git-guardrails-claude-code skill。
// matt 官方版的 git-guardrails-claude-code skill 是给 Claude Code 写 hooks JSON
// (~/.claude/settings.json 的 PreToolUse 配置)。pi 不识别 Claude Code hooks,
// 因此在 pi 层用本 extension 兜底：监听 pi.on("tool_call", ...) 事件直接拦截。
//
// 安全模型：
// - 监听 pi.on("tool_call", ...) 事件
// - 仅检查 bash 工具的 input.command 字段
// - 黑名单 regex 5 条，匹配则返回 { block: true, reason: "..." }
//
// 已知绕过（README 必须明列，避免给用户安全错觉）：
//   bash -c "git reset --hard HEAD~5"                  # 字符串嵌入
//   git --exec-path=/tmp reset --hard                   # 长选项拆分
//   git\ reset --hard                                   # 反斜杠转义
//   GIT_PAGER=cat git -c alias.dh='reset --hard' dh    # alias 链
//
// 误伤修正（review 结论）：
//   git push --force-with-lease / --force-if-includes   # 安全变体，放行（用 --force(?!-) 排除）
//   git checkout .gitignore                             # 单文件 checkout，放行（用 \.(?:\s|$) 排除）
//   git branch -d main                                  # 安全删除（已合并），放行（仅拦 -D）
//   git clean -fn                                       # dry-run，放行（字符集不含 n）
//
// 适用：仅 Lane B（docs/mattpocock-skills-integration.md §3B.7.2）
// Lane A 用户不需要——superpowers-zh / obra/superpowers / 不装 三种模板都不装 matt skill。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const FORBIDDEN: RegExp[] = [
  /\bgit\s+reset\s+--hard\b/,                        // reset --hard
  /\bgit\s+push\s+(?:--force(?!-)|-f)\b/,            // push --force / -f（放行 --force-with-lease / --force-if-includes）
  /\bgit\s+clean\s+-f[dDfXx]*\b/,                    // clean -f / -fd / -ff / -fdx / -fX（-n dry-run 放行）
  /\bgit\s+checkout\s+(?:--\s+)?\.(?:\s|$)/,         // checkout . / checkout -- .（单文件 .gitignore 放行）
  /\bgit\s+branch\s+-D\b/,                           // branch -D 任何分支（-d 安全删除放行）
];

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;
    const cmd: string = String(event.input.command ?? "");
    for (const pat of FORBIDDEN) {
      if (pat.test(cmd)) {
        const reason = `git-guard blocked: "${cmd.slice(0, 80)}..." matches ${pat}`;
        if (ctx.hasUI) ctx.ui.notify(reason, "error");
        return { block: true, reason };
      }
    }
    return undefined;
  });
}
