#!/usr/bin/env node
/**
 * Link `container/skills/` into every initialized group's `.claude-shared/`,
 * WITHOUT restarting anything.
 *
 * HOW A GROUP SEES A SHARED SKILL
 * -------------------------------
 * Two bind mounts meet inside the container (src/container-runner.ts):
 *   container/skills/                            →  /app/skills          (ro)
 *   data/v2-sessions/<AG-ID>/.claude-shared/     →  /home/node/.claude   (rw)
 *
 * On every spawn the host's `syncSkillSymlinks` → `syncSharedSkillLinks`
 * (src/provider-contracts/realize.ts) reconciles `.claude-shared/skills/`: each
 * selected shared skill is a SYMLINK `<skill> → /app/skills/<skill>`, dangling
 * on the host and valid inside the container. The container therefore reads
 * the host's `container/skills/<skill>` bytes live, so refreshing that
 * directory propagates to a running agent with no copy and no restart.
 *
 * The host accepts exactly one shape for a shared skill's entry: a symlink
 * (`lstat().isSymbolicLink()`). A real directory under that name is left in
 * place but logged as "Shared skill not symlinked" on every spawn, and it
 * shadows the live skill with whatever bytes it held when it was copied. An
 * older revision of this script produced such copies, so this script now owns
 * two things the spawn path does not cover:
 *
 *   1. Replacing a stale real-directory copy of a shared skill with the link,
 *      so live agents stop reading frozen bytes and the host stops warning.
 *   2. Adding links for skills fetched since the group last spawned, so a
 *      long-running container can load a brand-new skill before its next wake.
 *
 * A template's own skills are stamped into the SAME directory as real
 * directories (src/templates/create-agent.ts) and must stay real: the template
 * is their only source in the group. We cannot map a session id to its group
 * folder without the database, so a name that any template under `groups/`
 * stamps is treated as template-owned everywhere and never replaced. That
 * over-approximates ownership (a stale copy of a catalog skill that merely
 * shares a name with some template's skill keeps warning), but a destructive
 * step errs toward leaving a directory alone.
 *
 * Subagent definitions (`agent.md` siblings) are still copied: the host mirrors
 * them to `.claude-shared/agents/<entry>.md` as real files, and there is no
 * container path for a link to point at.
 *
 * Idempotent: an existing symlink is left as-is, whatever its target, exactly
 * as the host's own sync does.
 *
 * Usage:
 *   node scripts/mirror-skills.mjs [--root <repo>] [--dry-run] [--quiet]
 */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const quiet = argv.includes('--quiet');
const rootIdx = argv.indexOf('--root');
const root = rootIdx >= 0 && argv[rootIdx + 1] ? path.resolve(argv[rootIdx + 1]) : process.cwd();

const skillsSrc = path.join(root, 'container', 'skills');
const overlaysSrc = path.join(root, 'container', 'overlays');
const sessionsDir = path.join(root, 'data', 'v2-sessions');
const groupsDir = path.join(root, 'groups');

/** The container-side path of `container/skills/<skill>`; the link target the host itself plants. */
const CONTAINER_SKILLS_DIR = '/app/skills';

if (!fs.existsSync(skillsSrc)) {
  console.error(`✗ ${skillsSrc} does not exist — wrong --root?`);
  process.exit(1);
}
if (!fs.existsSync(sessionsDir)) {
  console.log('No data/v2-sessions — no groups to mirror into.');
  process.exit(0);
}

/** Recursive newest-mtime, same rule group-init uses for the agents/ mirror. */
function latestMtimeMs(p) {
  let st;
  try {
    st = fs.statSync(p);
  } catch {
    return 0;
  }
  if (!st.isDirectory()) return st.mtimeMs;
  let max = st.mtimeMs;
  for (const entry of fs.readdirSync(p)) {
    const child = latestMtimeMs(path.join(p, entry));
    if (child > max) max = child;
  }
  return max;
}

const dirsIn = (p) =>
  fs.readdirSync(p).filter((e) => {
    try {
      return fs.statSync(path.join(p, e)).isDirectory();
    } catch {
      return false;
    }
  });

/**
 * Skill names stamped by any template under `groups/<folder>/plugins/<plugin>/skills/`.
 * Enumerated by directory rather than through the validated plugin reader so
 * that an unvalidated stamp is still protected: this set only ever widens what
 * we refuse to replace.
 */
function templateStampedSkillNames() {
  const names = new Set();
  if (!fs.existsSync(groupsDir)) return names;
  for (const folder of dirsIn(groupsDir)) {
    const pluginsRoot = path.join(groupsDir, folder, 'plugins');
    if (!fs.existsSync(pluginsRoot)) continue;
    for (const plugin of dirsIn(pluginsRoot)) {
      const pluginSkills = path.join(pluginsRoot, plugin, 'skills');
      if (!fs.existsSync(pluginSkills)) continue;
      for (const skill of dirsIn(pluginSkills)) names.add(skill);
    }
  }
  return names;
}

/**
 * Make `dst` the symlink the host's spawn-time sync expects for `skill`, or in
 * dry-run mode only say what would be done. Returns a verb for the change, or
 * null when `dst` is already a symlink (any target: the host's own sync also
 * leaves an existing link alone). A real entry is removed first; the caller has
 * already excluded template-owned names, so what remains under a shared
 * skill's name is a stale copy.
 */
function linkSharedSkill(skill, dst, dryRun) {
  let st;
  try {
    st = fs.lstatSync(dst);
  } catch {
    st = undefined;
  }
  if (st?.isSymbolicLink()) return null;
  if (dryRun) return st ? 'would replace copy with link' : 'would link';
  if (st) fs.rmSync(dst, { recursive: true, force: true });
  fs.symlinkSync(path.posix.join(CONTAINER_SKILLS_DIR, skill), dst);
  return st ? 'replaced copy with link' : 'linked';
}

const skillNames = dirsIn(skillsSrc);
const templateOwned = templateStampedSkillNames();

// A group counts as mirror-eligible when it has a .claude-shared — that is what
// group-init creates for default-surfaces groups, and what container-runner
// bind-mounts at /home/node/.claude.
const groups = dirsIn(sessionsDir).filter((id) => fs.existsSync(path.join(sessionsDir, id, '.claude-shared')));

const changes = [];
const skipped = [];
let groupsTouched = 0;

for (const groupId of groups) {
  const claudeDir = path.join(sessionsDir, groupId, '.claude-shared');
  const skillsDst = path.join(claudeDir, 'skills');
  const agentsDst = path.join(claudeDir, 'agents');
  let touched = false;

  // The host refuses a skills directory that is itself a symlink (the
  // container owns every name under the mount, so a planted link could redirect
  // the sync anywhere). We refuse it the same way rather than write through it.
  let skillsDstIsLink = false;
  try {
    skillsDstIsLink = fs.lstatSync(skillsDst).isSymbolicLink();
  } catch {
    // absent — created below
  }
  if (skillsDstIsLink) {
    skipped.push(`${groupId}: skills/ is a symlink — left alone`);
    continue;
  }

  if (!dryRun) fs.mkdirSync(skillsDst, { recursive: true });

  for (const skill of skillNames) {
    const dst = path.join(skillsDst, skill);
    // A template-stamped name is the template's to manage; we neither replace
    // a stamped directory nor plant a link under a name the template owns.
    if (templateOwned.has(skill)) {
      if (fs.existsSync(dst)) skipped.push(`${groupId}: skills/${skill} is template-owned — left alone`);
      continue;
    }
    const verb = linkSharedSkill(skill, dst, dryRun);
    if (verb) {
      changes.push(`${groupId}: skills/${skill} ${verb}`);
      touched = true;
    }
  }

  // Subagent definitions: group-init copies a skill's/overlay's sibling
  // `agent.md` to .claude-shared/agents/<entry>.md. An upstream skill that ships
  // one would otherwise stay on the definition captured at the last wake.
  // Orphan pruning is intentionally NOT replicated here — deleting a subagent
  // definition out from under a live container is a bigger action than adding
  // one, and group-init prunes on the next wake anyway.
  for (const [srcRoot, entries] of [
    [skillsSrc, skillNames],
    [overlaysSrc, fs.existsSync(overlaysSrc) ? dirsIn(overlaysSrc) : []],
  ]) {
    for (const entry of entries) {
      const agentFile = path.join(srcRoot, entry, 'agent.md');
      if (!fs.existsSync(agentFile)) continue;
      const dst = path.join(agentsDst, `${entry}.md`);
      const existed = fs.existsSync(dst);
      if (latestMtimeMs(dst) >= latestMtimeMs(agentFile)) continue;
      if (!dryRun) {
        fs.mkdirSync(agentsDst, { recursive: true });
        fs.copyFileSync(agentFile, dst);
      }
      const verb = dryRun ? (existed ? 'would refresh' : 'would add') : existed ? 'refreshed' : 'added';
      changes.push(`${groupId}: agents/${entry}.md ${verb}`);
      touched = true;
    }
  }

  if (touched) groupsTouched++;
}

if (!quiet || changes.length > 0) {
  for (const line of changes) console.log(`  ${line}`);
}
if (!quiet) {
  for (const line of skipped) console.log(`  ${line}`);
}
console.log(
  `Mirror${dryRun ? ' (dry-run)' : ''}: ${skillNames.length} skill(s) → ${groups.length} group(s); ` +
    `${changes.length} change(s) across ${groupsTouched} group(s).`,
);
