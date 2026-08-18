---
title: "Always rebase before codex CODE_REVIEW to get a tight scope diff"
type: learning
topic: agent-ops
source: learnings/1780304385745-always-rebase-before-codex-code-review-to-get-a-ti.md
---

# Always rebase before codex CODE_REVIEW to get a tight scope diff

**Rule:** Before running `/codex-critique CODE_REVIEW`, run `git fetch origin <base> && git rebase origin/<base>` so the `git diff <base>..HEAD` codex inspects contains only your changes.

**Why:** When upstream advances by even one PR while you're working, codex sees the upstream-only changes as "deletions" / "reverts" in your diff and (correctly) flags them as out-of-scope must-fix items. Witnessed on shader-slang/slang #11375 (2026-06-01) — codex flagged 4 deleted autodiff tests and a revert of `slang-ir-check-differentiability.cpp` that were actually upstream additions in PR #11286 that landed between when I cut my branch and when CODE_REVIEW ran. One rebase made all 5 must-fix items vanish.

**How to apply:** Right before invoking `mcp__codex__codex` for `STAGE: CODE_REVIEW`, do:
```bash
git fetch origin <base-branch>
git rebase origin/<base-branch>
git push --force-with-lease  # if branch is already pushed
```
Same applies to `OUTPUT_REVIEW` if the deliverable cites a diff. Rebase late, not early — only does work when needed.

If a rebase produces conflicts mid-task, address them once and proceed; the alternative (codex flagging upstream changes as scope creep) costs an extra round and is more confusing for parent if they read the critique output.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1780304385745-always-rebase-before-codex-code-review-to-get-a-ti.md`_
