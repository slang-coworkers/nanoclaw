---
title: "critique gate arms on MEMORY-file edits and denies read-only gh api — verify state before you start editing notes"
type: learning
topic: agent-ops
source: learnings/1785881956405-critique-gate-arms-on-memory-file-edits-and-denies.md
---

# critique gate arms on MEMORY-file edits and denies read-only gh api — verify state before you start editing notes

# The critique gate counts non-code edits and blocks read-only verification

Hit twice in one hour, 2026-08-04, as slang-fixer. Both times the denial read:

```
CRITIQUE REQUIRED before PR creation.
Reason: 7 edit(s) recorded since the last critique round — the OUTPUT_REVIEW approve
no longer covers the current state. Re-run /codex-critique with STAGE: OUTPUT_REVIEW.
```

**The 7 edits were `memory/*.md` writes.** No source file changed. The gate's edit counter does not
distinguish code artifacts from note-taking, so a long documentation or memory session silently arms a
gate whose stated scope is *PR creation*.

**And it denies the whole `bash` command, including read-only calls that cannot reach the gated
action** — `gh api repos/.../pulls/comments/<id>`, `git ls-remote`, `git log`. So the practical effect
is: **you lose the ability to verify PR state at exactly the moment you are deciding whether an action
is safe.** A gate that blocks verification while a destructive action is under consideration is
inverted against its own purpose.

## What to do about it

- **Verify first, write notes after.** Capture the heads, review states, and comment IDs you'll need
  *before* a memory/documentation pass, because the pass itself will arm the gate.
- **Non-Bash tools still work:** `Read`, `Grep`, `Glob`, `Edit`, `Write`, and MCP tools (including
  `append_learning` and `send_message`). You can inspect the working tree and file learnings while
  blocked; you cannot run `git` or `gh`.
- **Don't reshape the command to slip past a text-matching hook.** A gate is policy, not an obstacle.
  Run it plainly, let it deny, and escalate — quoting the denial verbatim.
- ⭐ **Before treating a blocked check as a blocker, ask whether its outcome would change your
  action.** I was blocked from confirming an approval state; both possible answers led to *hands off*,
  so the verification was never load-bearing and the block cost nothing. **A verification you can't
  run only matters if its result would change what you do.** Say which branch you're on rather than
  spending a round on access.

## Related defect: the gate's advice can contradict the approver

On the same PR, four rounds of `OUTPUT_REVIEW` must-fix items pushed me to **expand** code comments
with producer/consumer detail. The approving maintainer then asked for those same comments **deleted**
(*"too much investigation history and non-local producer/consumer detail"*), and a second maintainer
said *"we can remove all of the comments in this PR."*

⭐ **The gate is advisory; the approver is authoritative.** When a critique round pushes you against a
recorded maintainer preference (here: a standing "comments must be terse, rationale goes in the PR
body" note), follow the maintainer and put the detail in the PR description — which is where the
repo's own contributing guide says design rationale belongs.

Also observed: the gate **re-arms on edits made to satisfy its own prior suggestion**, costing three
rounds on one sentence.

Related: [[technique_codex_critique_gate]], [[technique_critique_gate_blocks_pr_close]].

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785881956405-critique-gate-arms-on-memory-file-edits-and-denies.md`_
