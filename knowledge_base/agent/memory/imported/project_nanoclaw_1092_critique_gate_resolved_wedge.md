---
name: project_nanoclaw_1092_critique_gate_resolved_wedge
description: "slang-coworkers/nanoclaw#1092 critique-gate self-heal — 2 findings: leftover resolved esc file wedges session forever (timeout removal), consumed-bypass failed_open never recorded; reviewed inline, comment 5193317699"
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1092
---

**slang-coworkers/nanoclaw#1092** — `critique-gate: self-heal stale/missing escalations, close the fail-open`,
author **`szihs`** (human, NOT a bot — unlike most nanoclaw PRs), base `nv-main`, branch
`fix/nv-main/critique-gate-self-heal`. 8 files, +1114/−115. Reviewed 08-05, comment `5193317699`.

**ROUTING: handled INLINE by Main — ~22nd instance** (NanoClaw platform-infra fork, never to a
`*-pr-approver`; see [[project_nanoclaw_pr874_webhook_route_approver]]).

⭐⭐⭐**RE-MEASURE ON `synchronize` — MY PRIMARY FINDING EVAPORATED.** First head `b3e544ec` failed CI
with `Duplicate migration versions: 931` (collided with `931-approval-join-mode.ts` from `b3bcd59f`,
landed 06:53 the same day). I had that written up as the headline blocker. A `synchronize` webhook
arrived mid-review; new head `85994cd1` had **renumbered 931→932 and CI went green**. Had I published
on the first head I'd have led with a resolved issue. ⇒ **On any `synchronize`, re-fetch head SHA and
re-run every measurement before publishing — the author is working the PR while you review it.**

## 🔴 Finding 1: leftover `resolved` escalation file wedges the session permanently

Removing the 30-min timeout is right in intent, but the timeout was **the only thing that ever
recovered a session whose escalation file sat in a terminal state — and nothing in the tree deletes
that file** (verified: no `rm`/`unlink`/`rmSync` of `critique-escalation.json` repo-wide;
`track-critique.sh` never touches it).

**The two sides read `resolved` differently:**
- host `index.ts:286` — `if (!esc || esc.resolved) return;` ⇒ skipped forever (no self-heal, no card, no retraction)
- hook `gate-critique-on-deliver.sh:288` — `if [ -f "$ESC_FILE" ]` tests **existence only** ⇒ takes the
  "already open, stay shut" branch, never opens a fresh request

⇒ gate denies forever, host never looks again. **Reachable on the NORMAL success path**, not just
after an admin decision: the host itself writes `resolved:'self-healed'` at `index.ts:305`.

**Reproduced by running the real hook** (cap reached, approve → consume → next delivery):
`1) exit=2 escalation opened · 2) exit=0 CONSUMED · 3) exit=2 "self-heal attempt 0" · 4) exit=2 "attempt 0"`.
⭐**`self-heal attempt 0` on every later delivery is the tell** — the counter can't advance because the
host stopped reading the file. **Base-vs-head A/B isolated it to this PR:** base `EXIT=0 "escalation
timeout] Allowing"` vs head `EXIT=2 "attempt 0"`.

## 🔴 Finding 2: consumed-bypass release never recorded — the exact event the PR's observability exists for

`stamp_failed_open "admin bypass consumed (one-shot)"` writes `failed_open_at` onto a file
`applyBypassApproval` already marked `resolved:'approved'`. The `esc.resolved` guard at `:286`
returns **before** the `failed_open_at` ingestion at `:293` ⇒ **no `failed_open` row ever written.**
Contradicts the PR's own stated contract ("Anything that opens the gate must leave a durable trace").
`CRITIQUE_ESCALATION=0` records fine; only the admin-approved path is lost ⇒ the new table
under-counts precisely the releases a **human authorized**.

**Both findings, one root cause:** `resolved` does double duty as "terminal, ignore" and "still the
current escalation", read oppositely by hook and host.

## ⛔ MY INSTRUMENT WAS BROKEN THREE TIMES — every one caught only by a control

1. ⭐⭐⭐**`CRITIQUE_GATE_ACTIVE=0` was set IN MY OWN ENV** and the hook's first branch honors env over
   the marker file ⇒ **every run exited 0 having never reached the gate.** My first "finding" was
   this artifact. Caught by a **positive control that should have DENIED and didn't**, then `bash -x`.
   Fix: `env -u CRITIQUE_GATE_ACTIVE`. ⇒ **When testing a hook that reads env for activation, the
   ambient env is a live confound — a clean exit 0 is indistinguishable from "requirement met".**
2. **`EXIT=$?` captured a preceding `echo`, not the hook** — reported `exit=0` for runs that really
   exited 2. Fix: assign `rc=$?` immediately, `set +e` around the call.
3. **`| head -3` SIGPIPE'd and corrupted status** (the stored `ps`-family lesson, again). Redirect to
   a file, then read it.
⇒ ⭐⭐⭐**Three harness bugs, zero content bugs, in one review. Every result before the positive
control passed was garbage that READ as a finding.** Run the control FIRST; a "clean" result from an
unvalidated harness is the most expensive kind.

## ✅ What I verified positively (not assumed)

- **Auto-retraction is NOT inert:** `last_critique_at` genuinely written by `track-critique.sh:182,195,204`.
  ⚠️`gh api search/code` for `last_critique_at` returned **`total_count: 0`** — a **FALSE ZERO**;
  local `grep` found 6 hits. ⇒ **never accept a `search/code` zero as absence.**
- PR's own 3 suites: **78/78 pass** ⇒ these are **untested gaps, not broken tests**. Wrote failing
  tests in the PR's own harness for both findings.
- Classification pinned verbatim to the hook's 6 `DENIAL_REASON` strings; must-fix checked BEFORE the
  stale patterns (both contain "Re-run /codex-critique"); unknown ⇒ `failed` (correct fail-safe).
- One-shot consumption + TTL expiry both confirmed by live hook runs.

⚠️**MEASUREMENT CAVEAT I published in the comment:** whole-suite run showed **19 failed files / 0
failed tests** — **my environment, NOT the PR** (borrowed `node_modules` from the kb clone missing
`js-yaml`; `src/channels/dashboard.js` is branch-installed and absent). ⭐**"N failed files, 0 failed
tests" is the signature of IMPORT errors** — diagnose before reporting. My first grep for the cause
surfaced only deliberate test-fixture error noise; `grep 'Failed Suites'` then the single-file run
gave the real reason. CI on `85994cd1` is green and is the authority.

**No verdict/approval posted** — nanoclaw has no approver tier; inline review comment only, maintainer
owns merge. **On redelivery: re-check head SHA first** (author is actively pushing); if head is still
`85994cd1` do not re-review, the comment stands.
