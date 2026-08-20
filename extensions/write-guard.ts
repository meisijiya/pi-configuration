// write-guard extension
// 拦截 write/edit 工具,只允许写入 openspec/specs/<capability>/spec.md
// 用于约束 spec-miner agent 的写权限,防御 prompt injection 触发的越权写
//
// 安全模型:
// - write/edit 工具的 prompt 自带约束是软的(可被 prompt injection 绕过)
// - 本 extension 在 pi runtime 强制路径白名单
// - 配合 spec-miner.md 的 prompt 软约束形成"硬+软"双重防御
//
// 用法:无需注册,自动加载。修改白名单只需改 ALLOWED_PREFIX / ALLOWED_SUFFIX。

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const ALLOWED_PREFIX = "openspec/specs/";
const ALLOWED_SUFFIX = "/spec.md";

function isPathAllowed(rawPath: string): boolean {
  // 规范化:去掉前导 ./
  let p = rawPath;
  if (p.startsWith("./")) p = p.slice(2);
  // 不允许绝对路径(防止越权到系统目录)
  if (p.startsWith("/")) return false;
  // 不允许 .. 段逃逸(防止 openspec/specs/../../etc/passwd)
  if (p.split(/[\\/]/).includes("..")) return false;
  // 必须以 openspec/specs/ 开头,以 /spec.md 结尾
  if (!p.startsWith(ALLOWED_PREFIX)) return false;
  if (!p.endsWith(ALLOWED_SUFFIX)) return false;
  // 中间 capability 部分必须合法(kebab-case,不允许 / 或特殊字符)
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

    const path = event.input.path;
    if (typeof path !== "string") {
      return { block: true, reason: "write-guard: missing path argument" };
    }

    if (!isPathAllowed(path)) {
      const reason =
        `write-guard: ${event.toolName} blocked. ` +
        `Path "${path}" is outside openspec/specs/<capability>/spec.md. ` +
        `This guard protects spec-miner and similar agents from prompt-injection-driven writes.`;
      if (ctx.hasUI) {
        ctx.ui.notify(reason, "warning");
      }
      console.warn(`[write-guard] blocked ${event.toolName}: ${path}`);
      return { block: true, reason };
    }

    return undefined;
  });
}