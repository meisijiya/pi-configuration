// git-guard extension
// 拦截 bash 工具里危险 git 子命令（reset --hard / push --force / clean -fd 等）
// 替代 omo-skills 的 git-guardrails-claude-code（在 pi 里需要重写为 extension 风格）
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
// 适用：仅 Lane B（docs/omo-skills-integration.md §3B.7.2）
// Lane A 用户不需要这个 extension——superpowers-zh / obra/superpowers / 不装 三种模板都不装 omo-skills。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const FORBIDDEN: RegExp[] = [
  /\bgit\s+reset\s+--hard\b/,
  /\bgit\s+push\s+(--force|-f)\b/,
  /\bgit\s+clean\s+-f[fd]\b/,
  /\bgit\s+checkout\s+\.\s*$/,
  /\bgit\s+branch\s+-D\s+main\b/,
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
