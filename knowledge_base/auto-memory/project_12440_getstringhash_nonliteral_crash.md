---
name: project_12440_getstringhash_nonliteral_crash
description: "slang#12440 getStringHash on a non-literal SIGSEGVs instead of E41023. PARKED awaiting reporter's focused PR. The reporter's own suggested both-sites patch REGRESSES valid code — do not ship it unchanged; guard needs reachability scoping. Gate series i12440-fix-pr-gate-8e14."
metadata:
  node_type: memory
  type: project
  originSessionId: d5953db7-c37f-41d6-9915-53abce38ba90
---

# slang#12440 — `getStringHash` on a non-literal crashes instead of diagnosing

**State as of 2026-08-10T12:05Z (re-measured this turn, not carried):** issue **OPEN**, labels
`reproduced` + `Diagnostics` + `Missing Diagnostic` + `bug`, **exactly 1 comment** —
nv-slang-bot `5233753673`, created `2026-08-09T20:43:58Z`, `updated_at` unchanged. slang-triager is
last commenter ⇒ it can refresh that comment **in place** rather than stacking a new one.

## The load-bearing finding: the reporter's own fix regresses valid code

slang-triager reproduced at master `716ec597f` and **built** the patch the reporter suggested
(guard at both sites). It rejects code that compiles today:

```slang
uint h(String s) { return getStringHash(s); }
// ... called only as:
h("aaa")
```

Master folds this fine (`uint(807729185)`). The both-sites patch reports **E41023** on it, because
in `AFTER performTypeInlining` the **dead helper body still holds the unfolded `getStringHash(%s)`**
and the check scans it — `eliminateDeadCode` on the *next* line (`slang-emit.cpp:1653`) is what
removes it. So the guard must be **scoped to surviving / reachable insts**.

An **emitter-only** variant fixes all 3 crash shapes and keeps the helper working, but yields
**E99999**, not the requested E41023. ⇒ constraint for any fixer: **EMITTER CAST IS SAFE AS-IS,
GUARD NEEDS REACHABILITY SCOPING, DO NOT SHIP THE BOTH-SITES PATCH UNCHANGED.**

Sibling emitter sites to consider in any fix: `slang-emit-spirv.cpp:5975`,
`slang-emit-wgsl.cpp:1711`, `slang-emit-llvm.cpp:2178` — the **LLVM one was never tested by us, so
it is UNVERIFIED, not latent.** Do not let that distinction get flattened in a review.

## PR trail (verified by diff, re-checked 2026-08-10T12:03Z)

| PR | head | state | files under `source/` | effect |
|---|---|---|---|---|
| 12438 | `dev/jvepsalainen/fix-agentic-test-failures` | CLOSED unmerged `20:18:33Z` | 3 | the draft fix, withdrawn |
| 12444 | `dev/jvepsalainen/agentic-nightly-green` | **MERGED** (was OPEN at arming) | **0** | only re-points the expected-failures comment at 12440 ⇒ **crash unfixed, test stays skipped** |

Branch `dev/jvepsalainen/fix-agentic-test-failures` tip is still `d8eeee9ba1307…` = the SHA carrying
the **unscoped** guard; no open PR from it. ⇒ no reporter movement yet.

**No fixer dispatched, deliberately** — it would duplicate the reporter's in-flight work and risk
re-shipping the regression. slang-triager invited him to open the focused PR.

## Gate series `i12440-fix-pr-gate-8e14` (`0 */6 * * *`)

Arms: issue closed · open PR from that branch (head-ref is identity, not prose — 12438 was created
90 min before the issue existed so its body *could not* cite it) · content-search PR with ≥1 file
under `source/` · branch tip moved off `BASESHA` · branch deleted · non-bot reply · 72h silence.

⛔ **2026-08-10T12:00Z it FALSE-WOKE** with `reason:"human_reply_"` (empty login) on a
1-comment issue. Cause: the reply arm was a bare negation over a `2>/dev/null` probe. Fixed +
4 controls this turn; full derivation in
[[feedback_a_negation_arm_reads_a_failed_probe_as_the_event]].

**Cancel this series once 12440 is closed with a verified scoped fix.**
