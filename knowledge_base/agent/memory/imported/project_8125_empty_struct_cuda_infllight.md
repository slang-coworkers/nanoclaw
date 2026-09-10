---
name: project_8125_empty_struct_cuda_infllight
description: "slang#8125 — an empty struct in a module's public/exported interface makes the C-like (CPU/CUDA) emitter emit a real 1-byte member while reflection reports size 0 -> offset mismatch / SIGSEGV / CUDA_ERROR_ILLEGAL_ADDRESS. Fixed by PR #12304 (branch fix/issue-8125-v2): remove the 4-line PublicModifier->addPublicDecoration block in slang-lower-to-ir.cpp + else-if->if. csyonghe APPROVED, CI green; awaiting maintainer merge (mergeStateStatus BLOCKED / Office-Yong). ⚠️ The fix REGRESSES a working case: public-struct Ptr/__getAddress on -target cuda now ICEs (non-simple operand) — posted publicly, related #12386."
metadata:
  node_type: memory
  type: project
  originSessionId: ffbf244c-faeb-4852-aa5d-4149319d75a5
---

# slang#8125 — empty struct retained in CPU/CUDA emit

An empty struct in a module's **public/exported** interface makes the C-like (CPU/CUDA) emitter emit a
real 1-byte member while reflection reports size 0 → offset mismatch → SIGSEGV (CPU) /
`CUDA_ERROR_ILLEGAL_ADDRESS` (slangpy repro). Assignee/maintainer @jkwak-work; overlaps #7612.

## The fix — PR #12304 (producer-side, jkwak's minimal direction)

Remove the 4-line `if (as<PublicModifier>(modifier)) { builder->addPublicDecoration(inst); }` block in
`source/slang/slang-lower-to-ir.cpp` and convert the following dangling `else if (HLSLExportModifier)`
→ plain `if` (a real compile fix, not scope creep). This drops `IRPublicDecoration` at lowering so
`isSimpleType` legalizes the empty public struct naturally — **without** touching `isSimpleType` and
**without** the #11657 global pass. Non-public empty structs were already dropped from CUDA emit on
master; the fix makes `public` match that already-correct case.

- **PR:** #12304, base master, branch **`fix/issue-8125-v2`**, head `8b9c0fa00e`. 3 files +120/−7:
  the lowering change; new test `tests/bugs/empty-struct-parameter-block.slang` (5 shapes, CPU
  COMPARE_COMPUTE + CUDA text-emit CHECK); golden update `tests/modules/multi-target-module.slang`
  (drops 2 now-absent `[public]` CHECK lines). `report_pr_created` fired.
- ⚠️ Branch is `fix/issue-8125-v2`, **not** `fix/issue-8125` — the latter is CLOSED PR #11657's branch;
  reusing it would resurrect that PR. The load-bearing routing hook is `report_pr_created`, not the
  branch name.

## State — TERMINAL for the bot; awaiting maintainer merge only

Orch-verified 2026-08-07: **csyonghe APPROVED** (review `4880144345`, state `APPROVED`;
`reviewDecision: APPROVED`). Review list is exactly two rows — jkwak `4832761331` `DISMISSED`
(his own 07-31 ready-flip reset his draft-time approve) + csyonghe `APPROVED`. CI **46 pass / 34
skipping / 0 fail** (key on the state column). `mergeable: MERGEABLE`, non-draft, HEAD unchanged —
**the bot pushed NOTHING across the whole 7-week chain.** ⚠️ `mergeStateStatus: BLOCKED` persists even
at APPROVED+green — not explained by "no approval"; likely leftover requested reviewers, the
`Office-Yong` label (office-hours park), or branch protection. Info for the operator; the bot does NOT
merge and does NOT push (any commit dismisses csyonghe's approval). **RESUME = merge lands (→ #8125
closes via `closingIssuesReferences`), or a maintainer/CI event on #12304.**

## ⚠️ The fix REGRESSES a currently-working case (posted publicly; do NOT re-press)

`public struct Empty {}` + `__getAddress` on a local, `-target cuda`, compiles exit-0 on master but
**ABORTS `error[E99997] … non-simple operand(s)!`** with this PR: removing `addPublicDecoration` lets
the type legalize away, so the pointer op reaches the unhandled `default:` arm of `legalizeInst`
(`slang-ir-legalize-types.cpp:2197`). CI's 46-pass/0-fail did **not** catch it — the green sweep never
exercises the changed path (same blind spot that hid the plain-`public` static regression). Related
issue **#12386** (CUDA Ptr-to-empty-struct ICE) is unassigned; this PR does NOT fix it and **widens**
its surface. Suggested sequencing already on the PR: land the diagnostic contemplated at
`slang-ir-legalize-types.cpp:2196` first/alongside, so the widening surfaces as a normal source error,
not an ICE. Maintainers have this publicly; the bot does not re-comment or push.

⛔⛔ **The repro shape is load-bearing — a wrong shape gives a FALSE NEGATIVE indistinguishable from
refutation.** ❌ `Ptr<Empty> p = nullptr` → exit 0; ❌ `-target spirv` → exit 0. ✅ REQUIRED:
`__getAddress(value)` on a LOCAL **and** `-target cuda`. Also `-o /dev/null` fails with `E00004` for
unrelated reasons and masquerades as a compile result — use a real output path. Confirmed on two
independent build configs.

## Landmines / guardrails (all still active)

- ⛔ Do **not** re-recommend the global `removeEmptyStructFields` pass — that is **PR #11657**, which
  CI rejected (broke `Conditional`/`Optional` dyn-dispatch → `layout-conditional-field.slang.4 (cpu)`
  `non-simple operand(s)!`) and jkwak CLOSED. Confine any empty-struct work to the C/CUDA emit path;
  the review bot flagged the global pass firing for SPIR-V + AD paths too.
- ⛔ **#10788 is CLOSED** (jkwak, 07-16, "Copilot not responding") — drop all adopt/close tasks. It was
  Copilot-authored; csyonghe's `dc4cde29` on it was his own independent isSimpleType-side fix, distinct
  from jkwak's producer-side removal that shipped here.
- ⚠️ The reviewer's REQUEST_CHANGES on "lost plain-`public` host visibility" was **OVER-STRONG** — the
  static-linkage change is **INTENDED** per csyonghe (Code-Review-meeting decision: the `public`
  keyword is meant to do nothing for linkage). The technical analysis (empirical before/after, predicate
  trace at `slang-emit-cpp.cpp:957/2004/2027`, doc citation) was correct and load-bearing; the miss was
  only SEVERITY — a documented-contract conflict is a high-signal QUESTION/GAP for maintainer intent,
  not an autonomous BLOCK. The stale artifact is `docs/cpu-target.md:210`, not the fix.
- ⛔ Verify branch authorship via `gh api pulls/<n>/commits`, **never** `commits?sha=<branch>` — the
  latter returns full branch ANCESTRY, which after a master-merge shows unrelated bot commits (this
  produced a false "9 nv-slang-bot commits in the branch" claim). Mirror of the false-negative in
  [[feedback_verify_regression_claims_at_precision]].

## Residuals (flag-not-act unless a maintainer asks)

1. `docs/cpu-target.md:210` is now stale (documents `public __extern_cpp` as host-callable;
   `public`-as-no-op is the new contract).
2. **Layout-retention gap:** empty `ConstantBuffer<EmptyType>` still emits `struct EmptyType_0 {}` post-fix
   (retained via `LayoutDecoration`) ⇒ #8125's mechanism is NOT fully closed for non-`public` spellings
   (export / `[DllExport]` / `__extern_cpp`).
3. csyonghe forward-looking cleanup (05-17 @-mention): **remove the `PublicDecoration` op entirely**
   ("historical slop that confuses `public` with `export`") — measured footprint 15 refs / 12 files,
   one producer left (`slang-ir-dll-export.cpp:27`, looks redundant vs `HLSLExport`). The fixer offered
   to file a tracking issue and correctly did NOT self-start a 12-file refactor or touch the approved
   PR. **Do not let this cleanup leak into #12304.**

## Process note (pruned)

~5 apparent "silent non-landings" over 7 weeks were **sessions reaped mid-build** (ninja killed during
long slangc builds), not refusals or dead sessions; recovered via Main session-pin recovery. jkwak
chased status 3× publicly before the PR landed. Detail lives in shared learnings / session history;
guardrails above are the durable residue. Peer-wire discipline (no direct Main→fixer double-dispatch)
per [[feedback_no_double_dispatch_peer_wired]]; never auto-close/flip per
[[feedback_github_writes_operator_authorized]].
