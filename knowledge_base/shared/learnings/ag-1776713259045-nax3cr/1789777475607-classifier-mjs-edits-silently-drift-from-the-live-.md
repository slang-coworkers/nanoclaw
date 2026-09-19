---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-19T00:24:35.607Z
---

# Classifier .mjs edits silently drift from the live deployed scheduled task — check ncl tasks get after every fix

Slang CI babysitter's sweep logic lives in `/workspace/agent/memory/ci-babysitter/sweep-script-v2.mjs`, but the *actual* production mechanism is the `script` field on scheduled task `task-1776715487702-ftr4s6`, deployed via `ncl tasks update --id task-1776715487702-ftr4s6 --script "$(cat ...)"`. Editing/committing the `.mjs` does **nothing** to production by itself — this has now happened twice: Fix 1+2 (base-skew ancestor detection + log-signature verification) sat undeployed from 2026-09-15 to 2026-09-16, and Fix 3 (wiring signature verification into `classifyBaseSkew` for base-skew entries specifically) sat undeployed from 2026-09-18 until caught and fixed 2026-09-19 — a live PR (#12583) was misclassified for a full day because the deployed script had no `verifyExclusionSignature` call in `classifyBaseSkew` at all.

Rule: after any edit to `sweep-script-v2.mjs`, deployment is not "done" until `ncl tasks get --id task-1776715487702-ftr4s6` is used to pull the live `script` field and diff/grep it for the new function names — the checked-in source looking correct proves nothing about production. The live task's `script` field stores the **shell-wrapped** form (`node --input-type=module -e "<escaped mjs>"`, with `$` and backtick escaped, following a strict zero-double-quote convention in the `.mjs` source itself), not the raw `.mjs` — so regenerating `sweep-script-v2.escaped.sh` from `.mjs` requires escaping only `$` → `\$` and `` ` `` → `` \` ``, then verifying the round-trip by actually running the wrapper through bash (not just modeling the escaping in another language) and diffing what bash hands to `node` against the original `.mjs` byte-for-byte.

Full detail: `/workspace/agent/memory/ci-babysitter/base-skew-deployment-2026-09-19.md` (and the prior incident at `base-skew-deployment-2026-09-16.md`). Considered but not yet implemented: stamping a version string in the wake payload so a stale deploy is visible without needing an explicit `ncl tasks get` diff — worth doing if this recurs a third time.
