// migrate-skill-lock.ts (standalone script)
// 同步 ~/.agents/.skill-lock.json：把 25 个 mattpocock/skills stable skill 的 lock 条目
// 统一指向 mattpocock/skills 源 + 更新 skillFolderHash（git tree SHA）。
// 适用于从 omo-skills 时代迁来的用户（lock 中可能含 meisijiya/skills 域条目）。
//
// 关键事实（旧版实现有错，这里修正）：
// .skill-lock.json（skills CLI v3 全局 lock）里，sourceType=github 的条目，
// 其 skillFolderHash 是「skill 文件夹在源仓库里的 git tree SHA」（40 位 hex），
// 不是本地 SKILL.md 的 sha256。见 vercel-labs/skills 的 getSkillFolderHashFromTree。
//
// 因此本脚本通过 GitHub API 拉取目标仓库 tree，取 skill 文件夹的 tree SHA，
// 与 `npx skills update` 的比对逻辑一致。离线时无法产出正确 hash，会报错并
// 跳过该条目——绝不写入错误 hash（旧版 sha256 取 16 字符是错的）。
//
// 用法（用户手动跑）：
//   node scripts/migrate-skill-lock.ts
//
// 可测试性：SKILL_LOCK_PATH=/path/to/lock.json 可覆盖默认 lock 路径。
//
// 行为：
//   1. 备份 lock 到 .bak-<TS>
//   2. 对 OVERRIDDEN 列表里每个 skill：
//      - 从目标 source 的 GitHub tree 找到 skill 文件夹的 tree SHA
//      - 更新 source / sourceUrl / sourceType / skillFolderHash / updatedAt
//   3. 写回（保留原条目其它字段，不删除）

import { readFileSync, writeFileSync, existsSync, copyFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const LOCK = process.env.SKILL_LOCK_PATH ?? join(homedir(), ".agents/.skill-lock.json");

// mattpocock/skills 25 个 stable skill → 统一指向 mattpocock/skills 源。
// (engineering 18 + productivity 7,跳过 misc/recipes/in-progress)
const OVERRIDDEN: Record<string, { source: string; sourceUrl: string }> = {
  // engineering 18
  "ask-matt":                      { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "code-review":                   { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "codebase-design":               { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "diagnosing-bugs":               { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "domain-modeling":               { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "grill-with-docs":               { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "implement":                     { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "improve-codebase-architecture": { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "prototype":                     { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "research":                      { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "resolving-merge-conflicts":     { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "setup-matt-pocock-skills":      { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "tdd":                           { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "to-spec":                       { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "to-tickets":                    { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "triage":                        { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "wayfinder":                     { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "wizard":                        { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  // productivity 7
  "grill-me":                      { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "grilling":                      { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "handoff":                       { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "teach":                         { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "to-questionnaire":              { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "wait-what":                     { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
  "writing-for-agents":            { source: "mattpocock/skills", sourceUrl: "https://github.com/mattpocock/skills.git" },
};

interface SkillEntry {
  source?: string;
  sourceType?: string;
  sourceUrl?: string;
  skillPath?: string;
  skillFolderHash?: string;
  installedAt?: string;
  updatedAt?: string;
  pluginName?: string;
  [k: string]: unknown;
}

interface Lock {
  version: number;
  skills: Record<string, SkillEntry>;
}

interface TreeEntry { path: string; type: string; sha: string }
interface TreeResponse { sha: string; tree: TreeEntry[] }

// 从 sourceUrl / source 推导 owner/repo，构造 GitHub tree API URL（默认分支 HEAD）
function githubTreeUrl(source: string, sourceUrl?: string): string {
  const fromUrl = sourceUrl?.match(/github\.com[:/]([^/]+)\/([^/]+?)(?:\.git)?$/);
  if (fromUrl) {
    return `https://api.github.com/repos/${fromUrl[1]}/${fromUrl[2]}/git/trees/HEAD?recursive=1`;
  }
  const [owner, repo] = source.split("/");
  return `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`;
}

// 复刻 skills CLI 的 getSkillFolderHashFromTree：由 skillPath 找文件夹 tree SHA
function getSkillFolderHashFromTree(tree: TreeResponse, skillPath: string): string | null {
  let folderPath = skillPath.replace(/\\/g, "/");
  if (folderPath.toLowerCase().endsWith("/skill.md")) folderPath = folderPath.slice(0, -9);
  else if (folderPath.toLowerCase().endsWith("skill.md")) folderPath = folderPath.slice(0, -8);
  if (folderPath.endsWith("/")) folderPath = folderPath.slice(0, -1);
  if (!folderPath) return tree.sha;
  return tree.tree.find((e) => e.type === "tree" && e.path === folderPath)?.sha ?? null;
}

async function fetchTree(url: string): Promise<TreeResponse> {
  const res = await fetch(url, {
    headers: { "User-Agent": "migrate-skill-lock", Accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} ${res.statusText}`);
  return (await res.json()) as TreeResponse;
}

async function migrate(): Promise<void> {
  if (!existsSync(LOCK)) {
    console.error(`❌ lock 文件不存在: ${LOCK}`);
    process.exit(1);
  }

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
    if (!entry.skillPath) {
      console.log(`⚠️  ${skill} 缺 skillPath，跳过`);
      continue;
    }

    const url = githubTreeUrl(mapping.source, mapping.sourceUrl);
    try {
      const tree = await fetchTree(url);
      const sha = getSkillFolderHashFromTree(tree, entry.skillPath);
      if (!sha) {
        console.log(`⚠️  ${skill}: 在 ${mapping.source} 的 tree 里找不到文件夹 ${entry.skillPath}，跳过`);
        continue;
      }

      // 已对齐到 mattpocock/skills:跳过;其他源(包括 meisijiya/omo-skills / 其他):更新
      if (entry.source === "mattpocock/skills" && entry.skillFolderHash === sha) {
        console.log(`✓  ${skill} 已对齐到 mattpocock/skills (sha: ${sha})`);
        continue;
      }

      console.log(`🔄 ${skill}: source ${entry.source ?? "(无)"} → ${mapping.source}`);
      console.log(`   hash ${entry.skillFolderHash ?? "(无)"} → ${sha}`);
      entry.source = mapping.source;
      entry.sourceUrl = mapping.sourceUrl;
      entry.sourceType = "github";
      entry.skillFolderHash = sha;
      entry.updatedAt = new Date().toISOString();
      updated++;
    } catch (e) {
      console.error(`❌ ${skill}: 拉取 ${mapping.source} tree 失败，未改动该条目：${(e as Error).message}`);
    }
  }

  writeFileSync(LOCK, JSON.stringify(lock, null, 2));
  console.log(`\n✅ 迁移完成：${updated} 个 skill 已更新`);
  console.log(`   lock: ${LOCK}`);
  console.log(`   备份: ${BACKUP}`);
  console.log(`\n提示：如需 revert，从 ${BACKUP} 恢复即可`);
}

migrate();
