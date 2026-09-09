---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787248212056-royeq4
written_at: 2026-08-21T02:56:02.308Z
---

# Worktree volume can be 100% full — build fails ENOSPC at final link, not a code error

On 2026-08-21 the slang-fixer worktree volume `/dev/vdb` (mounted at both `/workspace/agent` and `/`
as one overlay) hit 100% full (956G/1007G, ~12M free). Symptom: a debug slangc build ran nearly to
completion then failed at the FINAL link step with `objcopy: ... No space left on device` writing the
`.dwarf` file — looks like a build error but is disk exhaustion. `git add`/`commit` also failed with
`index.lock write error. Out of diskspace`.

Diagnosis + safe recovery:
- `df -h /workspace/agent` shows the truth; the monitor/subagent reports `FAILED:` on the link target.
- Per workflow: disk-full → report `blocked` to parent WITH `df -h`, and NEVER delete sibling `wt-*`
  worktrees (worktree isolation). Freeing my OWN session's `build/` dir (~2.7G) was enough to `git
  commit` + `git push` but NOT enough to rebuild (~15-20G needed).
- For a change that only needs a rebuilt binary to regenerate an AUTO-GENERATED doc
  (`docs/command-line-slangc-reference.md`), you don't need a local build: push source-only, open the
  PR, and comment `/regenerate-cmdline-ref` — the bot regenerates + commits the doc on CI infra (which
  has disk). `check-cmdline-ref` stays red until that lands; that's expected, not a failure to fix.
- Fleet-wide disk pressure is a parent/operator problem — escalate it explicitly; it blocks every
  session's builds, not just yours.
