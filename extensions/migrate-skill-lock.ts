// migrate-skill-lock.ts (standalone script)
// 同步 ~/.agents/.skill-lock.json：被 omo-skills cp -r 覆盖的 skill 重新计算 hash + 更新 source 字段
//
// 触发场景：Lane B 用户跑 deploy.sh 后，omo-skills 已 cp -r 25 个 skill 到 ~/.pi/agent/skills/
//   其中至少 handoff（mattpocock/skills 原版）被 omo 覆盖
//   但 .skill-lock.json 仍记 mattpocock/skills + 旧 hash
//   未来 npx skills@latest update 会以 lock 为准回滚到 matt 原版
//
// 用法（用户手动跑）：
//   node extensions/migrate-skill-lock.ts
//
// 行为：
//   1. 备份 ~/.agents/.skill-lock.json 到 ~/.agents/.skill-lock.json.bak-<TS>
//   2. 对 OVERRIDDEN 列表里的每个 skill：
//      - 重新计算 ~/.agents/skills/<skill>/SKILL.md 的 sha256（取前 16 字符匹配 pi .skill-lock.json 约定）
//      - 更新 lock 条目的 skillFolderHash / source / sourceUrl / updatedAt 字段
//   3. 写回 lock 文件（保留来源历史——不删除原条目，只更新字段）
//
// 适用：仅 Lane B（docs/omo-skills-integration.md §3B.7.3）

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { createHash } from "crypto";
import { join } from "path";
import { homedir } from "os";

const LOCK = join(homedir(), ".agents/.skill-lock.json");

// omo-skills 装载后会覆盖的 skill（mattpocock/skills 原版 → meisijiya/omo-skills）
// 未来如发现更多被覆盖的 skill，在此处加
const OVERRIDDEN: Record<string, { source: string; sourceUrl: string }> = {
  handoff: {
    source: "meisijiya/omo-skills",
    sourceUrl: "https://github.com/meisijiya/omo-skills.git",
  },
};

interface SkillEntry {
  source?: string;
  sourceType?: string;
  sourceUrl?: string;
  skillFolderHash?: string;
  installedAt?: string;
  updatedAt?: string;
}

interface Lock {
  version: number;
  skills: Record<string, SkillEntry>;
}

function sha256Short(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

function migrate(): void {
  if (!existsSync(LOCK)) {
    console.error(`❌ lock 文件不存在: ${LOCK}`);
    process.exit(1);
  }

  // 备份
  const TS = new Date().toISOString().replace(/[:.]/g, "-");
  const BACKUP = `${LOCK}.bak-${TS}`;
  copyFileSync(LOCK, BACKUP);
  console.log(`✅ 备份到 ${BACKUP}`);

  const lock: Lock = JSON.parse(readFileSync(LOCK, "utf-8"));
  let updated = 0;

  for (const [skill, mapping] of Object.entries(OVERRIDDEN)) {
    const entry = lock.skills[skill];
    if (!entry) {
      console.log(`⚠️  ${skill} 不在 lock 中，跳过`);
      continue;
    }

    const skillFile = join(homedir(), ".agents/skills", skill, "SKILL.md");
    if (!existsSync(skillFile)) {
      console.log(`⚠️  ${skillFile} 不存在，跳过`);
      continue;
    }

    const newHash = sha256Short(readFileSync(skillFile));
    const oldHash = entry.skillFolderHash;
    const oldSource = entry.source;

    if (oldHash === newHash && oldSource === mapping.source) {
      console.log(`✓  ${skill} 已迁移过 (hash: ${newHash}, source: ${mapping.source})`);
      continue;
    }

    entry.skillFolderHash = newHash;
    entry.source = mapping.source;
    entry.sourceUrl = mapping.sourceUrl;
    entry.updatedAt = new Date().toISOString();
    updated++;
    console.log(`🔄 ${skill}: source ${oldSource ?? "(无)"} → ${mapping.source}, hash 更新`);
  }

  writeFileSync(LOCK, JSON.stringify(lock, null, 2));
  console.log(`\n✅ 迁移完成：${updated} 个 skill 已更新`);
  console.log(`   lock: ${LOCK}`);
  console.log(`   备份: ${BACKUP}`);
  console.log(`\n提示：未来如需 revert，从 ${BACKUP} 恢复即可`);
}

migrate();
