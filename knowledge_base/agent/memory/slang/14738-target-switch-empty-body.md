---
type: chain-record
title: "#14738 unmatched __target_switch empty body via generic"
description: "Chain record for shader-slang/slang#14738 — triage done, fixer active on aspect 2; aspect 1 is a dup of #13995"
tags: [slang, chain, target-switch, missing-return]
---

# #14738 — Non-void function with unmatched `__target_switch` compiles to empty body via generic

Filed by external user `szihs` 2026-11-27. Webhook-dispatched to `slang-triager` 10:52 UTC (eyes reaction posted).

## Status
- **Triage: complete** (triager session `sess-1795776785878-vzqusj`, report 11:00). Bug / high / P2 / IR. Outcome posted on the issue (cmt 7216590104), `reproduced` label + Issue Type `Bug` applied. Aspect 1 = dup of #13995.
- **Fixer: draft PR #14740 open (11:26→12:22)** — `fix/issue-14738` @ head `44021a1`, 3 commits (failing test, `NoTargetCaseDecoration` IR type, **E41037** reported after the final DCE). pr-mappings verified (row → fixer session `sess-1795777276929-4jgslt`). Fix status comment on the issue (cmt 7218238128). Explanation comment on the PR. Plan deviation from triage memo was intentional + learning-backed (#13564 decorate-and-report-after-final-DCE vs the :87 false-positive trap). Webhook-driven from here; ready-flip → weekly operator list.
- Full triage memo preserved at `triage-14738.md` (sibling file, copied from inbox).

## Fix Report (fixer, TERMINAL our side 14:32 — resting on human review)
- **Draft PR #14740 @ head `a4d3d1e83`** (7 commits, 8 files +389/−4, `pr: non-breaking`): `NoTargetCaseDecoration` (stable id 921, module 45→46) marked at `specializeTargetSwitch` (non-void only); late pass `diagnoseRemainingNoTargetCases` reports **E41037** after last force-inlining + full simplifyIR (SLANG_FAIL before emit); `slang-ir-missing-return.cpp` untouched (E41009 unchanged); 34-lane diagnostic test.
- Acceptance 5/5; suite 16325/16340 (15 A/B-pre-existing); r1 REQUEST_CHANGES applied; **r2 APPROVE_WITH_NITS** — 4 nits applied, 2 declined with evidence, routed to triager (msg 39): (1) `deserializeFromFlatModule` operand-layout validation (class-level pre-existing weakness); (2) stale `docs/generated/design/cross-cutting/targets.md:328` sentence (external docs pipeline regen).
- Coordination hazard: open draft **#13564** (#13555 chain) claims the same E41037 id — second merge renumbers. `Buffer<T>.Load` on cpp now errors instead of garbage (PR Risk line).
- Next: triager's [Triage Resolution].

## Triage Resolution (14:34 — CHAIN TERMINAL our side)
- [Triage Resolution] posted by the triager (verified PR head `a4d3d1e83` directly). Aspect 1 stays on #13995.
- Both declined-nit follow-ups verified + deduped, **bot-filed: #14742** (deserializeFromFlatModule per-op operand layout unvalidated at load boundary; unguarded decoration derefs; precedents #12758/#12376) and **#14743** (stale `__target_switch` sentence, docs/generated/design/cross-cutting/targets.md:327-328, superseded once #14740 merges; cross-ref #12205). **Their issue_opened webhooks are self-echoes — no dispatch** (filing policy; #14743's fix start also gates on #14740's merge).
- Third side-find (14:36): **#14744** (`-target host-cpp` empty capability profile — no HostCPPSource arm in `TargetRequest::getTargetCaps`; naive mapping previously broke dll-import-func-ptr-host-cpp.slang, recorded on #13675). Bot-filed, `reproduced` + Bug, parked for maintainer direction; triager one-shot re-check 12-04. **Self-echo — no dispatch on its issue_opened.**
- Rests on human review of draft PR #14740; ready-flip → weekly operator list; E41037 id collision with draft #13564 to be coordinated at merge.

## Triage digest (from memo)
Two aspects:
1. E36107 blind through generic/interface dispatch — **dup of open #13995**, not fixed here.
2. FRESH: unmatched `__target_switch` in a value-returning fn silently lowers to `emitMissingReturn()` (`slang-ir-specialize-target-switch.cpp:87`); CUDA/CPP "allow" missing returns (`doesTargetAllowMissingReturns`, `slang-ir-missing-return.cpp:18-26`) → empty non-void body, UB, even under `-ignore-capabilities`.

Recommended fix (Approach A): hard-error at the MissingReturn synthesis point in `specializeTargetSwitch` when the enclosing fn is non-void; void-function tolerance unchanged. Acceptance: main_generic cuda/cpp errors, main_direct keeps E36107, void fns still compile, existing E41009/E41010/E41011 tests + 63 `__target_switch` test files pass.

Repro: `ts_repro.slang` (copy at `/workspace/agent/.repro-14738/ts_repro.slang`), verified on master 77e59ba7c 2026-11-27.
