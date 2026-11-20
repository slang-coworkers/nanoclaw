---
type: chain
title: slang#10234 — int8_t/uint8_t on WGSL gives ICE E99997 instead of a diagnostic
description: Human-filed issue; 11-18 22:48Z jhelferty-nv (maintainer) asked @nv-slang-bot to triage. TRIAGED 22:56Z (bug/low/P2, WGSL emit; rec A = mirror the int16 diagnoseOnce pattern with a new 56xxx diagnostic). Triage posted on the issue; fixer chain NOT started — awaiting maintainer go-ahead per the triager's offer.
tags: [slang, wgsl, emit, int8, ice, triaged, awaiting-maintainer]
---

# slang#10234 — `int8_t`/`uint8_t` reaching WGSL emit hits `SLANG_UNEXPECTED` (E99997)

**Origin.** Issue #10234 (not a PR), filed by a human reporter. On 2026-11-18 22:48Z jhelferty-nv
(NVIDIA maintainer) commented `@nv-slang-bot Can you triage this issue?`
(comment https://github.com/shader-slang/slang/issues/10234#issuecomment-6993912475).
Dispatched to slang-triager on the canonical thread `gh-issue-shader-slang/slang-10234`
with `<github-post-authorized />` (first responder — no prior chain owned it; verified no
coworker session on the thread before dispatch).

**Triage result (triager report, 22:56Z — triager's findings, receipts in its own memo
`memory/issues/triage-10234.md` in the slang-triager group):**

- Classification: bug / low severity / target-emit (WGSL) / P2. Related family: #10232
  (double on WGSL/Metal ICE), #14188, #14186 — not a duplicate of any.
- Root cause (triager): `int8_t`/`uint8_t` reaching WGSL emit hits `SLANG_UNEXPECTED`
  (E99997 ICE) at `source/slang/slang-emit-wgsl.cpp:569-573` and `:1106-1110`; the adjacent
  int16 arms use `diagnoseOnce` → E56103 instead. No upstream capability/legalize gate
  exists for either width — emitter-site rejection is the established layer.
- Repro on master (2026.13.1-50-g3649fb982, fresh build): issue's shader → E99997 exit 3;
  int16 twin → E56103 exit 2. Not a regression (arms untouched since #5006).
- `reproduced` label applied; existing fuzzed/ICE labels untouched.
- Recommended fix (A): mirror the int16 pattern — new `int8-not-supported-in-wgsl`
  56xxx diagnostic in `source/slang/slang-diagnostics.lua` (~:6433) + `diagnoseOnce` at both
  emit sites + a DIAGNOSTIC_TEST twin of `tests/wgsl/int16-uint16-error.slang`.
  Alternative (B) pre-emit WGSL scalar-width legalization walk (larger, needs int16 migration
  too — only if maintainers want unification). (C) capability/checker gate ruled out.

**GitHub artifacts:**
- Triage comment posted: https://github.com/shader-slang/slang/issues/10234#issuecomment-6994071092
  (includes recommended path + explicit offer to open a fixer chain on the maintainer's go-ahead).

**State:** TERMINAL ON OUR SIDE (11-19 ~17:3xZ). **Draft PR #14640** @ `b25fab365` —
"Diagnose 8-bit integers as unsupported in WGSL instead of an ICE", 8 commits, 4 files
+86/−4, label `pr: non-breaking`, base master, explanation comment current. Fix: new
E56110 `int8-not-supported-in-wgsl` diagnostic + `diagnoseOnce` at both WGSL emit sites
(`emitSimpleTypeImpl`/`emitSimpleValueImpl`) + loud `default:` arm + 2 DIAGNOSTIC_TEST twins.
Review: human-peer r1 REQUEST_CHANGES applied; r2 APPROVE_WITH_NITS, all 4 nits applied;
chain critique gates approved. Tests local-run: repro PASS, tests/wgsl/ 164/164,
tests/diagnostics/ 1091/1091 (CI matrix draft-gated/skipped). PR `behind` master —
merge-master (never rebase) before any ready-flip/merge ask. **No maintainer response since
the draft opened** (board-sync auto-assigned jhelferty-nv as shepherd — NOT acknowledgment;
misrelay caught + corrected via Main codex OUTPUT_REVIEW r1→r2 approve, thread
01a1f4d9-9b5e-7f01-b896-4902722fb0b3). Awaiting human review; ready-flip on weekly list.
Side-find: adjacent `double`-arms ICE = already-tracked open #10232 (verified live); FloatLit
bare `default:` pre-existing, out of scope. Route #10234/#14640 webhooks to the fixer session
on `gh-issue-shader-slang/slang-10234`.
