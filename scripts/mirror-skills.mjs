#!/usr/bin/env node
/**
 * Mirror `container/skills/` into every initialized group's `.claude-shared/`,
 * WITHOUT restarting anything.
 *
 * WHY A COPY IS REQUIRED (this is the whole point of the script)
 * -------------------------------------------------------------
 * `container/skills/` is NOT bind-mounted into containers. The only mount that
 * touches it is a single file — `container/skills/buddy/CHARTER.md` →
 * `/app/skills/buddy/CHARTER.md` (src/container-runner.ts). Refreshing
 * `container/skills/` therefore does nothing at all for a running agent.
 *
 * What IS mounted is the group's own state directory:
 *   data/v2-sessions/<AG-ID>/.claude-shared  →  /home/node/.claude   (rw)
 * (src/container-runner.ts, guarded by `defaultSurfaces`.)
 *
 * And skills get into that directory by being COPIED there —
 * src/group-init.ts mirrors `container/skills/<name>` →
 * `.claude-shared/skills/<name>` via `refreshMirror()`, on every wake.
 *
 * Put those together and the zero-downtime path falls out: replicate that same
 * copy on the host, into the directory that is already bind-mounted. The
 * container sees the new bytes on its next read — no restart, no kill, no
 * re-spawn. The agent picks the skill up the next time it loads one.
 *
 * We deliberately call the SAME `refreshMirror` the supported wake path calls
 * (imported from the built dist) rather than reimplementing `cp -r` with our
 * own staleness rule. Identical semantics is the point: recursive-max-mtime
 * comparison, destination removed first so files deleted upstream do not
 * linger, no-op when the mirror is already current (hence idempotent).
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

if (!fs.existsSync(skillsSrc)) {
  console.error(`✗ ${skillsSrc} does not exist — wrong --root?`);
  process.exit(1);
}
if (!fs.existsSync(sessionsDir)) {
  console.log('No data/v2-sessions — no groups to mirror into.');
  process.exit(0);
}

const { refreshMirror } = await import(path.join(root, 'dist', 'group-init.js'));

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

const skillNames = dirsIn(skillsSrc);

// A group counts as mirror-eligible when it has a .claude-shared — that is what
// group-init creates for default-surfaces groups, and what container-runner
// bind-mounts at /home/node/.claude.
const groups = dirsIn(sessionsDir).filter((id) => fs.existsSync(path.join(sessionsDir, id, '.claude-shared')));

const changes = [];
let groupsTouched = 0;

for (const groupId of groups) {
  const claudeDir = path.join(sessionsDir, groupId, '.claude-shared');
  const skillsDst = path.join(claudeDir, 'skills');
  const agentsDst = path.join(claudeDir, 'agents');
  let touched = false;

  if (!dryRun) fs.mkdirSync(skillsDst, { recursive: true });

  for (const skill of skillNames) {
    const src = path.join(skillsSrc, skill);
    const dst = path.join(skillsDst, skill);
    const existed = fs.existsSync(dst);
    if (dryRun) {
      if (latestMtimeMs(dst) < latestMtimeMs(src)) {
        changes.push(`${groupId}: skills/${skill} ${existed ? 'would refresh' : 'would add'}`);
        touched = true;
      }
      continue;
    }
    if (refreshMirror(src, dst)) {
      changes.push(`${groupId}: skills/${skill} ${existed ? 'refreshed' : 'added'}`);
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
console.log(
  `Mirror${dryRun ? ' (dry-run)' : ''}: ${skillNames.length} skill(s) → ${groups.length} group(s); ` +
    `${changes.length} change(s) across ${groupsTouched} group(s).`,
);
