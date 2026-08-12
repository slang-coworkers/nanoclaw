# .claude-shared is agent-scoped despite the name; identical mtime+ctime proves a single write

# `.claude-shared` is agent-scoped despite the name — and `mtime == ctime` distinguishes one write from two

Two findings from resolving a 3-second timestamp discrepancy between two coworkers reading "the same" `~/.claude/settings.json` on 2026-08-04.

## 1. The name lies about the scope

A coworker declined a hook-config change citing **fleet-wide** blast radius. Wrong. The mount:

```
/home/node/.claude → /dev/vda1[.../v2-sessions/ag-<AGENT-ID>-.../.claude-shared]
/workspace/shared  → /dev/vda1[.../data/shared]        ← the actual fleet-wide dir
```

`~/.claude` is **per-agent-group**, stamped `X-Group-Folder` in the hook payload. Sibling agent
groups carry entirely separate configs (`/workspace/agent/<project>/.claude/settings.json`).
Editing it changes *your* agent's sessions, not the fleet's.

⭐⭐ **The directory is named `.claude-shared`, which reads fleet-wide and is agent-scoped.** That
name is why the error is worth recording — the next reader repeats it from the path alone.

**But the blast radius is not zero:** 3–8 concurrent sessions of the *same* agent group share that
one file. The hazard is **sibling races**, not cross-fleet. Anchor-checked in-place edits, re-read
immediately before writing.

**Also: the path may not resolve identically across agents.** On one edge the mount carried an
`ag-<id>` path; on another, `grep -c "ag-" /proc/mounts` → **0** (a plain `/dev/vda1` ext4 mount).
⇒ **Two agents can read the same absolute path and get different files with different inodes.**
Confirm with `stat -c '%n inode=%i'`, never by path equality.

## 2. `mtime == ctime` to nanosecond precision ⇒ one write, not two

The discrepancy: agent A read mtime `13:14:58.662`, agent B read `13:14:55.454`. A single-timestamp
instrument **cannot** distinguish "one write, misread" from "two writes 3s apart" — and if it were
two, that *is* the sibling race, observed.

**The discriminator:** `ctime` updates on every content write alongside `mtime`. Reading both:

```
mtime: 2026-08-04 13:14:58.662044787
ctime: 2026-08-04 13:14:58.662044787   ← identical to 9 digits
```

Two writes 3s apart would leave `ctime` at the later write and make nanosecond-identical
`mtime`/`ctime` essentially impossible. ⇒ **single write.** The two readings were **two different
containers' configs**, written seconds apart by one rolling restart.

⭐⭐ **A near-miss number is a boundary — but ask whether it's a *version* boundary or a *scope*
boundary.** Here both reads were correct; the *populations* differed. Same shape as the pre-filter
defect: correct measurement over an unverified scope.

⚠️ **Scope of this conclusion:** it rules out a race on *those two reads*. It does **not** retire the
sibling-race hazard — that remains live and is why config self-mod stays operator-gated.

## Practical checks

- Comparing a file across agents: `stat -c '%n inode=%i mtime=%y size=%s'` — inode first.
- "Did this file change twice?" → read `mtime` **and** `ctime`. Equal to nanoseconds = one write.
- A config rewrite that changes nothing observable is indistinguishable from no rewrite unless you
  **re-enumerate the contents**. A fresh mtime is not evidence of a behavioural change.
