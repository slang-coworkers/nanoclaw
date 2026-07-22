---
name: project-9403-hpp-extern-cpp-entrypoint
description: "#9403 -target hpp + __extern_cpp compute entrypoint emits invalid C++ header — PR #12152 ready-for-review, shadow WOULD_APPROVE CLEAN, await human join"
metadata: 
  node_type: memory
  type: project
  originSessionId: ecd9809d-63fb-4550-9d53-f5b5080a670c
---

# #9403 — `-target hpp` + `__extern_cpp` compute entrypoint generates invalid C++

**State (2026-07-18):** OPEN, PR #12152 flipped ready-for-review (webhook), routed to slang-pr-approver → **shadow WOULD_APPROVE (reason_code=CLEAN)** @ `9148d9a7b679` (ledger row written, nothing posted — shadow mode). 6/6 eligibility clauses PASS; Devin-only FALLBACK tier (harvest exit 20, prod skips bot branches): 0 bugs/0 flags/3 confirmations; challenger cleared all 3 predicted-miss axes; CI 46✓/44 skip/0 fail. Now awaiting human join (merge/close or `github.pr_review`) to score agreement. Triaged by slang-triager on jkwak-work's request; fixer resolved into a draft.

**Bug:** `-target hpp` emits compute-entrypoint wrapper functions as full DEFINITIONS whose bodies call `_example(...)`, but the `_`-prefixed workhorse is never declared/defined in the header → header won't compile. Only triggers when the entrypoint survives DCE via `__extern_cpp`/export. Reproduced on ToT `aaa07fe29` (CPU, no GPU).

**Root cause:** wrapper loop in `CPPSourceEmitter::emitModuleImpl` (slang-emit-cpp.cpp:2369-2438) never consults `shouldEmitOnlyHeader()`; workhorse decl suppressed by `asEntryPoint` early-return in `emitFuncDecl` (slang-emit-c-like.cpp:3948-3954).

**Fix (draft PR #12152, `fix/issue-9403`→`master`, `Closes #9403`, `pr: non-breaking`, nv-slang-bot):** guard the wrapper loop on `shouldEmitOnlyHeader()` to emit the three wrappers as PROTOTYPES. Triager's recommended `_example` forward-decl proved unnecessary (dead once bodies stripped) — fixer's simplification is correct. Repro test `tests/headers/generate-hpp-extern-cpp-entrypoint.slang` PASS; tests/headers 3/3; `-target cpp` byte-identical; debug 571/571.

**GitHub:** verdict 5-bullet posted (comment 5011419900); `reproduced` label applied (Type=Bug left human-set).

**Next human action:** review draft #12152 → flip ready → merge (auto-closes #9403). CI red on that run = benign bot priority-gate yield (`wait-for-human-priority`/`check-ci`, builds skipped), not a real failure.

**Ownership:** slang-triager owns triage→fixer→reviewer hops and forwards resolution upstream on thread `gh-issue-shader-slang/slang-9403`. Watch-only for Main; do not double-dispatch. See [[feedback_no_double_dispatch_peer_wired]], [[feedback_drafts_only_guardrail]].
