---
name: project_11118_atomic_mutating_noncopyable_spirv
description: "slang PR #11118 (zangold-nv, gh-7262): [mutating] methods on structs with Atomic<T> fields emit invalid SPIR-V — ABSTAIN_POLICY/OPEN_GAP, depth-cap fails open"
metadata: 
  node_type: memory
  type: project
  originSessionId: b9160cc5-9eae-40fb-b450-46d6b9841d33
---

**shader-slang/slang PR #11118** — "Fix `[mutating]` methods on structs containing `Atomic<T>` fields generating invalid SPIR-V". Author **zangold-nv**, branch `gh-7262` → `master`. Fixes #7262; re-enables the disabled gh-6380 test. Opened 2026-05-11.

**Approach:** mark `Atomic<T>` `[__NonCopyableType]` in `core.meta.slang`; add transitive `typeContainsNonCopyableImpl` (struct fields w/ generic substitution, array element types, `InheritanceDecl` struct bases, bounded by `kMaxTypeNestingDepth`); `adjustParamPassingModeBasedOnParamType` promotes `BorrowInOut → Ref`. Threads `ASTBuilder*` + `DeclRef<ParamDecl>` through `getParamPassingMode` and callers across 8 source files. 21 files, +553/−51. **11 new tests** + gh-6380 re-enable (12 test files changed) — NOT 10; the production bot's count was wrong and I propagated it in my dispatch brief.

**Approver verdict (2026-08-03 08:29Z): `ABSTAIN_POLICY` / `reason_code=OPEN_GAP`** @ `6367227358c9`. mode=`live`, clauses **6/6 PASS**, source tier PRIMARY (bot review @ exact head + Devin exit-0 47/47). 0 🔴 ⇒ BLOCK unavailable; challenger controlled the outcome. `record_decision` reported success. Nothing written to GitHub.

**Principal ground — depth cap FAILS OPEN (I verified this myself at the pinned head):**
`slang-lower-to-ir.cpp:3721` — `if (depth >= (int)kMaxTypeNestingDepth) return false;` returns *"copyable"*, so a valid >128-deep nesting containing `Atomic<T>` skips the `BorrowInOut → Ref` promotion and silently re-emits the exact invalid SPIR-V the PR exists to fix. The own-invariant comment (:3713-3714, restated :3718-3720) conflates **cycles** with **depth**: "valid programs cannot have by-value struct cycles … so the depth limit is only a safety guard" — but a valid *acyclic* type can exceed 128. Approver initially **cleared** this on the theory that E39997 gates deep nesting; that was wrong (E39997 is raised by individual walkers carrying their own `recursionDepth`, e.g. `slang-check-shader.cpp`; E39999 covers inheritance *cycles* only). Its critique gate caught the miss and it became the abstain ground.

**Bot gap REFUTED (verified by me): `DeclRef<T>::as<>()` DOES type-check.** `slang-ast-base.h:830-837` — `DeclRef<T>::init` does `if (base && !Slang::as<T>(base->getDecl())) declRefBase = nullptr;`. So the `as<StructDecl>()` filter at `slang-lower-to-ir.cpp:3757` is **effective**; the production bot's "no-op filter" gap is wrong and should be retracted so the author doesn't chase it. The shared-wiki `as<>`-guard learning is real but scoped to `SubstExpr::as()`.

**Other verified findings:** `Ref` has no non-addressable fallback — `case ParamPassingMode::Ref:` @`:3450` passes `getNullVoidPtrValue()` @`:3481`, whose own comment calls that an ICE. Marking `Atomic<T>` non-copyable flips `slang-check-overload.cpp:1130` from `MutatingMethodOnFunctionInputParameterWarning` → `...Error` for `Atomic<T>` `in` params (real escalation; the "6 activated sites" count is loose — I count ~4 live call sites repo-wide). `gh-7262-atomic-no-diff-autodiff.slang:9` comment claims the imaginary-args derivative helpers "exercise this path" but the body has **no `fwd_diff`/`bwd_diff` call** — verified overstated.

**Capability gap:** container `slangc` can't link `slang-glslang`/`spirv-opt` (`E00100`), so the depth-cap / subst-ordering / `Ref`-fallback findings rest on **source traces at the pinned head, not compiles**. That's why uncertainty resolved conservatively rather than toward approval. Subst-ordering (`slang-syntax.cpp:1116`) remains unresolved-reachability with **no reproducer** — must stay hedged in any public text.

**State:** non-draft, OPEN, `mergeable=true`, `mergeable_state=blocked` (required human review outstanding; zero human reviews — only `github-actions[bot]` + `coderabbitai[bot]`, all COMMENTED). CI green 29✓/1⏭/0❌. coderabbit's newest review is `dc2e599b` (2026-05-21) → **stale**, non-operative.

**Routing:** approver → me → `slang-reviewer` for a COMMENT-state public post framed as a **delta/correction to the existing bot review**, not a re-review. Approver never posts ([[feedback_approver_never_posts_route_reviewer]]); hedging must survive into the public text ([[feedback_authorize_comment_matches_memo_hedging]]).

**✅ DELTA POSTED 2026-08-03 09:01:48Z** — review `4842397199`, `nv-slang-bot[bot]`, state **COMMENTED** @ `6367227358c9`, 5646 bytes. Safety verified: **0 non-COMMENTED reviews** on the PR; labels unchanged (`pr: breaking change` only, pre-existing); state `open` / `mergeable_state=blocked` untouched; no ready/merge/close/label ops. Shipped text: `/workspace/inbox/a2a-1785747733853-ljze1s/delta-comment.md`.

**Shipped as 4 items; I re-verified all 17 cited line refs at the pinned head — all correct:**
1. **Retraction** of the bot's `as<StructDecl>` no-op gap. Chain verified: `DeclRef<U> as() const` @`slang-ast-support-types.h:977` → `DeclRef(DeclRefBase*) { init(base); }` @`:949` → type-check @`slang-ast-base.h:830-837`; `explicit operator bool` @`:1011`. Correctly scoped the real caution to `SubstExpr::as()` @`:910` (no `init()` gate) — genuinely a different template.
2. **Warning→error escalation** (the actually-new item): `[__NonCopyableType]` on `Atomic<T>` @`core.meta.slang:4100` → `slang-check-overload.cpp:1130` error branch `:1135` / warning branch `:1142`. Verified `err(...30067)` vs `warning(...30068)` in `slang-diagnostics.lua:1449-1461`. `[__ref]` mutators `store`/`exchange` @`core.meta.slang:4109+`, `attribute_syntax [__ref] : RefAttribute` @`:4724`. Source-compat break, untested; PR already carries `pr: breaking change`.
3. **Depth cap** — `kMaxTypeNestingDepth = 128` @`slang-check.h:21`; cap @`slang-lower-to-ir.cpp:3721` returns `false`; premise conflation @`:3713-3714`. Sibling walkers verified to fail **closed**: `slang-type-layout.cpp:5320` diagnoses `MaximumTypeNestingLevelExceeded` + returns `LayoutSize::invalid()`; `slang-check-decl.cpp:3173` diagnoses + `return nullptr`. Asymmetry is real per the reviewer's compiles.
4. Test count 10→**11**.

**⚠️ MY ERROR the reviewer caught:** I briefed the depth cap as "ESCALATE — new, not in the public review". **It was already there** — bot review findings table row 3, `slang-lower-to-ir.cpp:193` (diff-relative → head `:3721`), and its summary names "a permissive depth-cap fallback". I read the table but mis-keyed on the diff-relative line number. Reviewer correctly demoted it to supporting evidence for an existing gap and promoted the warning→error escalation (verified **absent** from the bot body — 0 grep hits for `MutatingMethodOnFunctionInputParameter`) as the new item. See [[feedback_diff_relative_line_numbers_in_bot_reviews]].

**⚠️ Also corrected:** my hedge asserted `E00100` (`slangc` can't link `slang-glslang`) — that was the **approver's** environment, not the reviewer's. The reviewer's Release `slangc` works; it declined to ship a failure it never hit and substituted the true limitation (binary is **pre-PR** master `53b76e6d3009`; branch not built, no miscompile observed). It then ran real compiles: 143-level acyclic chain via `groupshared` compiles clean + passes SPIR-V validation (depth 0 → 580 B, depth 140 → 11380 B, both exit 0) ⇒ **the cap is empirically reachable by valid code**, the cycle justification genuinely doesn't carry. Same chain behind `RWStructuredBuffer` *does* trip `E39997` — only `groupshared` is ungated. Skipped-promotion conclusion stays source-trace-only and is labelled as such. `void f(Atomic<int> a) { a.add(1); }` → `warning[E30068]` on master, confirming §2 reachable.

**RESUME:** author/maintainer reply on the PR, a new `synchronize`, or a human review landing. Chain otherwise complete — no further dispatch pending.
