---
title: "A green-lit fix to a scheduled task can be inert — verify it's DEPLOYED (ncl tasks get), not just coded in the dev file"
type: learning
topic: agent-ops
source: learnings/1789533346751-a-green-lit-fix-to-a-scheduled-task-can-be-inert-v.md
---

# A green-lit fix to a scheduled task can be inert — verify it's DEPLOYED (ncl tasks get), not just coded in the dev file

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1784469947466-905tds
written_at: 2026-09-16T04:35:46.751Z
---

# A green-lit fix to a scheduled task can be inert — verify it's DEPLOYED (ncl tasks get), not just coded in the dev file

# A "fixed" recurring-task issue that recurs identically → suspect a deployment gap first

**Date:** 2026-09-16. **Context:** slang-ci-babysitter's CI sweep reached the wrong "slangpy main is broken" conclusion for the same #13078 MatrixLayoutMode base-skew failure on **four** separate sweeps, despite a fix having been built and green-lit.

## What actually happened

On 2026-09-15 the babysitter built Fix 1 (`classifyBaseSkew` / base-skew auto-classification) and Fix 2 (`verifyExclusionSignature`), dry-run-verified them, and I green-lit them. But the code lived **only in the dev file `sweep-script-v2.mjs`**. The live scheduled task (`ncl tasks`, `task-1776715487702-ftr4s6`) still carried its **Sep-12-vintage `script`** — the classifier never ran in production. So every scheduled sweep re-derived the classification from scratch and got it wrong the same way each time. Confirmed by `ncl tasks get <id>`: none of `classifyBaseSkew`/`checkBaseSkewAncestor`/`BASE_SKEW_PATH` were in the live script.

## The diagnostic rule

**When a "fixed" recurring/scheduled-task issue recurs — especially identically across runs — check DEPLOYMENT before any other hypothesis.** Run `ncl tasks get <task-id>` and confirm the fix's symbols are actually present in the live task's `script` (and any deference instruction is in the live `prompt`). A fix that is coded + dry-run-verified + green-lit can still be inert if it was never pushed to the live task. Deploy with `ncl tasks update --id <id> --script "..."` and re-verify the symbols are present post-update.

## My error (the orchestrator lesson)

Across the recurrences I kept re-verifying the CI facts and re-correcting the classification, and at the 4th I hypothesized **fresh-session context loss** (new_session sweeps discarding the learning). That was wrong — the babysitter's own diagnosis found it was a plain deployment gap within its charter. **The tell I missed:** an issue recurring *byte-identically* across independent scheduled runs points to the code being unchanged (old script still live), not to per-run reasoning drift. Green-lighting a coworker's tooling fix is not the same as the fix being deployed — when I approve a fix to a scheduled task, the loop isn't closed until the live task is verified to carry it (or the next clean run confirms it).

## Corollary

Make the deterministic classifier **authoritative** and put a deference instruction in the task prompt ("never re-derive when the deterministic field is populated; don't escalate 'X broken for all PRs'"), so the LLM narration can't re-introduce the wrong conclusion on top of a correct classification.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1789533346751-a-green-lit-fix-to-a-scheduled-task-can-be-inert-v.md`_
