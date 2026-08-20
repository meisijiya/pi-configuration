// write-guard extension
// 约束 spec-miner 等 agent 的写权限：只允许写 openspec/specs/<capability>/spec.md。
//
// ⚠️ 作用域限制（重要，务必读）：
// pi 的 ExtensionAPI 不向 extension 暴露 caller/agent 身份——
// `tool_call` 事件只有 type / toolCallId / toolName / input，
// `ExtensionContext` 没有 callerAgentName / agentName 等字段。
// 因此本 extension 无法区分"主对话"与"spec-miner 子 agent"。
//
// 后果：若按旧版全局硬拦截，会误拦主对话（以及所有未排除本扩展的 subagent）的
// 每一次 write/edit——实测已复现（见 docs/omo-skills-integration.md §4.7）。
//
// 当前行为：
// - 默认（未设置 WRITE_GUARD_STRICT）→ 完全放行，等价于 no-op，安全无副作用。
// - 设置环境变量 WRITE_GUARD_STRICT=1 → 启用白名单硬拦截（仅放行
//   openspec/specs/<capability>/spec.md）。供未来 pi 支持 per-agent 扩展作用域后，
//   把严格模式挂到 spec-miner 上时使用。
//
// 现阶段 spec-miner 的写约束由 prompt 软约束承担（agents/spec-miner.md 的
// "Tool guardrails" + "Prompt Defense Baseline"），不依赖本扩展。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ALLOWED_PREFIX = "openspec/specs/";
const ALLOWED_SUFFIX = "/spec.md";

// 严格模式开关：默认关。理由见文件头注释。
const STRICT = process.env.WRITE_GUARD_STRICT === "1";

function isPathAllowed(rawPath: string): boolean {
  // 规范化：去掉前导 ./
  let p = rawPath;
  if (p.startsWith("./")) p = p.slice(2);
  // 不允许绝对路径（防止越权到系统目录）
  if (p.startsWith("/")) return false;
  // 不允许 .. 段逃逸（防止 openspec/specs/../../etc/passwd）
  if (p.split(/[\\/]/).includes("..")) return false;
  // 必须以 openspec/specs/ 开头，以 /spec.md 结尾
  if (!p.startsWith(ALLOWED_PREFIX)) return false;
  if (!p.endsWith(ALLOWED_SUFFIX)) return false;
  // 中间 capability 部分必须合法（kebab-case，不允许 / 或特殊字符）
  const middle = p.slice(ALLOWED_PREFIX.length, -ALLOWED_SUFFIX.length);
  if (middle.length === 0) return false;
  if (!/^[a-z0-9][a-z0-9-]*$/.test(middle)) return false;
  return true;
}

export default function (pi: ExtensionAPI) {
  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") {
      return undefined;
    }

    // 默认放行：无法可靠识别 caller，全局硬拦截会误伤主对话。
    if (!STRICT) {
      return undefined;
    }

    const path = event.input.path;
    if (typeof path !== "string") {
      return { block: true, reason: "write-guard: missing path argument" };
    }

    if (!isPathAllowed(path)) {
      const reason =
        `write-guard: ${event.toolName} blocked. ` +
        `Path "${path}" is outside openspec/specs/<capability>/spec.md. ` +
        `(WRITE_GUARD_STRICT=1 白名单模式)`;
      if (ctx.hasUI) {
        ctx.ui.notify(reason, "warning");
      }
      console.warn(`[write-guard] blocked ${event.toolName}: ${path}`);
      return { block: true, reason };
    }

    return undefined;
  });
}
