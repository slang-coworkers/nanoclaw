---
name: project_12330_entrypoint_throws_not_diagnosed
description: "slang#12330 shader entry point allowed to `throws` with no diagnostic. SHIPPED 2026-08-06: draft PR #12412 adds E38053 in validateEntryPoint + tests, closingIssuesReferences=[12330], codex approve. Blanket rule is right (no CPP carve-out). Shares assert line :2166 with #12134 but a DIFFERENT defect ⇒ not blocked on that deferred fix. RESUME = slang-reviewer verdict then merge (operator-gated)."
metadata:
  node_type: memory
  type: project
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# slang#12330 — shader entry point allowed to `throws` (no diagnostic)

Author **skiminki-nv** (maintainer, self-filed). A `throws` clause on a shader entry point should be an
error. On master it either ICEs (`-target spirv` → `E99997` assert `slang-ir-glsl-legalize.cpp:2166
structTypeLayout`; `spirv/glsl/metal/wgsl` SIGSEGV 139) or emits DXC-invalid code (`-target hlsl` emits a
`ResultType` struct as the entry-point return type). **08-06: skiminki authorized triage + fix**
("@nv-slang-bot: Please reproduce and make a PR"); Type set to `Language Maturity`, milestone Q3 2026.

## SHIPPED — draft PR #12412, verdict published, fix implemented

**Fix:** new diagnostic **`entry-point-cannot-throw` = E38053**, check in `validateEntryPoint`
(`slang-check-shader.cpp:1697`, beside `EntryPointCannotReturnResourceType`/`…ArrayType`). Predicate =
`getErrorCodeType(...)->equals(getBottomType())` — deliberately the **same predicate lowering uses** to
attach `kIROp_FuncThrowTypeAttr`, so the diagnostic cannot drift from lowering. Substitution-aware
(generics). The error trips the error-count gate before `generateIR()`, so the malformed shape never
reaches layout/legalization. `E38053` was free on master (38050–38052 taken; no collision). Draft PR
#12412, `Fixes #12330`, `closingIssuesReferences=[12330]` (auto-close on merge), codex PLAN/CODE/OUTPUT
all approve, `report_pr_created` done. **PR stays draft; ready/merge operator-gated** ("make a PR"
authorizes the PR, not the flip — [[feedback_drafts_only_guardrail]]; pushes to the branch need no
approval — [[feedback_pushes_not_gated]]).

**The three dispatch questions, answered by the triager (I verified 5 legs myself at master `d7d59f374`):**
1. **Blanket rule is RIGHT — no carve-out.** Reporter's "only CPP could theoretically support it" does
   not hold: `cuda`/`cpp`/`host-callable` all fail `E99999 … this target doesn't support this
   user-defined varying parameter`. No target works today.
2. **Same assert LINE as #12134, DIFFERENT defect.** See root cause below. Practical consequence is the
   *opposite* of what I feared: #12330 does NOT depend on jkwak-work's deferred #9580/#12134 fix.
3. `throws`/`try` is **ungated, not experimental** (from source) ⇒ "diagnose an error" is the right
   disposition, not "feature incomplete." The assert stays independently reachable — the diagnostic guards
   a live bug and the verdict says so publicly ([[feedback_green_job_skipped_backend_zero_coverage]]).

## Root cause — a shared assert LINE is not a shared bug

The `:2166` ICE is an EP-result type⇄layout disagreement, but the precise mechanism is **absence, not
staleness**: `slang-parameter-binding.cpp:3560` only computes `resultLayout` when the AST result type is
non-`void`; here it's `void` (the `throws` clause is not folded into `getResultType`), so no result layout
is ever built. The `ResultType` struct appears later and only in IR
(`slang-ir-lower-error-handling.cpp:43`, which has zero layout references); glsl-legalize reads
`getResultLayout()` unguarded at `:4910` and asserts at `:2166`. The layout was never wrong — it correctly
described a void-returning EP. **"Same bug" refuted by positive-control differential:** #12134's reproducer
**still aborts at :2166 in the patched build** (different root cause, jkwak-work, Q4 2026).
⭐⭐ **A shared assert line is weak evidence — asserts are chokepoints; only a differential decides dedup.**
2nd instance of this error shape for me ([[project_9580_glsl_legalize_layout_mismatch]],
[[project_12134_base_interface_assoc_type_followup]]).

Two facts the reporter/others got directionally right but for the wrong reason: **Release hard-crashes
with no diagnostic** (`SLANG_ASSERT`→`SLANG_ASSUME` when `_DEBUG` undefined), worse than the debug
`E99997`. And the HLSL problem is a **missing return-value semantic** (DXC 1.9: "Semantic must be defined
for all parameters of an entry function"), NOT "compute shaders can't return values." **Silent wrong
codegen is the worse half**, and it was measured at the start yet framed around the assert because that is
what the reporter led with — **a reporter's lead symptom is not necessarily the worst one you measured.**

## The must-fix a reviewer found, and the class it belongs to

**E38053 over-fired:** `throws NotAType` produced `E30015 undefined identifier` PLUS a spurious E38053.
Mechanism: a `throws` clause that *fails to check* goes through `CheckProperType` → `ErrorType` (≠ bottom)
⇒ the `equals(getBottomType())` predicate fires — a second error stacked on an already-reported one, on
exactly the input a user typos. Fixed with in-tree precedent (`slang-language-server-completion.cpp:554-555`
— the only site testing **both** sentinels) + a test arm asserting E30015 only.
⭐ **A single-sentinel test could not have caught it** — a test that pins one input class says nothing
about the adjacent one. This is a **pre-existing class** (4 other sites use the bottom-only spelling:
`slang-check-stmt.cpp:642`, `slang-check-expr.cpp:7575`/`:7600`); the fixer's decline of the 9-site
`doesDeclareThrows` consolidation is correct with evidence — folding it in would widen an already-unreviewed
change (separate issue for a maintainer).

**User-visible consequence a maintainer must weigh, not rubber-stamp:** `validateEntryPoint` is reached at
compile time AND from module import (`Linkage::loadSerializedModuleContents` → `_discoverEntryPoints` →
`:409`); `errorType` IS serialized (`FIDDLE() TypeExp errorType` beside `returnType`). ⇒ **a `.slang-module`
built by an older compiler containing a throwing entry point will no longer load** (hard failure — module
unregistered at `:1234-1236`), not implied by the issue's compile-time ask. ⚠️ **Bounded: path real,
failure hard, incidence unknown** — whether such an artifact exists in the wild is unmeasured.
[[feedback_an_enumeration_claim_needs_a_computed_complement]].

## Durable lessons (this chain's calibration record)

- ⭐⭐⭐ **An enumeration answers the query you ran, not the sentence you hang on it.** Repeatedly this
  chain a correct `grep` stopped one hop short: "who calls `validateEntryPoint`" (call sites) published as
  "how can this check be reached" (paths). The remedy is not a better grep but **asking whether what you
  enumerated is what your sentence quantifies over.** Sibling axes: **a predicate is (operand, comparand)**
  (matching the comparand in a nearby line says nothing about the operand) and **a citation is (site, role)**
  — every check was a *site* check; nothing asked "does this support the sentence?" No matcher fires on
  either. [[feedback_an_enumeration_claim_needs_a_computed_complement]].
- ⭐⭐⭐ **Four independent confirmations of a number are worth nothing against a SHARED APERTURE.** All
  three parties' patterns keyed on `errorType` textually adjacent to `getBottomType()`; observations were
  independent, only the *window* was shared. The only check that worked: probe what the pattern **excluded
  by construction** (line-wrapped predicates; `getErrorCodeType(...)` call sites) — cheap, one question
  about the instrument. **Widening one dimension of an aperture (regex shape) does not establish the others
  (file-set)** — the triager found a 6th `getErrorCodeType` site outside my 4-file scope.
- ⭐⭐⭐ **Three individually-true observations composed into a mechanism our artifact is not in the
  population of** (the CI yield mechanism exists · a `waiting` run exists · the 12h ceiling exists) reached
  the OPERATOR as a false decision option. Our CI was **`skipped` at the draft guard** (`ci.yml:15` guards
  on `draft != true`, all 36 jobs `needs: filter`), never yielded, so the escalation is structurally
  unreachable and the `waiting` run I cited was another author's. **Before blaming a mechanism, check your
  artifact is in its population — one field on one run** (a yielding story predicts `waiting`; ours read
  `skipped`).
- **A workflow reporting `success` every ~2 min while performing no work is the best disguise for a
  deadlock** (`ci-retry-yielded-bot.yml` self-blocks on a manual-approval `waiting` run it counts as
  active). **I read its cron trigger and inferred its behaviour instead of reading its runs** — the trigger
  is readable, the run log decides.
- **An append-only correction leaves the artifact self-contradictory; delete what you supersede.** Final
  critique caught the PR body asserting both that the check matches lowering's test and deliberately differs.
  And **deleting a wrong citation is half the repair; the other half is naming the right one.**
- **A stale sentence in my reasoning is not a stale artifact — ask WHICH ARTIFACT the sentence lives in
  before issuing a correction.** My "byte-identical" warning was about my own sentence; the published
  comment's only revision claim was SHA-pinned and re-derived exactly. An unpinned figure needs an edit at
  each head, and each edit notifies nobody — **pinned figures are stale-by-events, not wrong**
  ([[feedback_two_figures_for_one_quantity_may_be_two_revisions]]).
- **A guard that cannot fail is a defect:** `throws-outside-entry-point.slang`'s `//CHECK-NOT: error`
  scans a region (stderr-before-stdout) that cannot contain diagnostics — dead negative. Same class as the
  delivery-gate that treats every `Bash` call as an edit (the `sha256sum`/`git status` run to prove nothing
  changed re-armed it); fix = content-based invalidation (compare the approved hash), the shape running
  through the whole chain: **an output that reads identically whether or not the thing it measures occurred.**
- ⛔ **I misdiagnosed a codex gate 4× (the cause was the fixer's `sandbox: "read-only"` param, which
  `force-codex-sandbox.sh` denies ⇒ no PostToolUse ⇒ track-critique never ran); I read the denying hook and
  reported only that it never rewrites `tool_input` — the wrong question.**
  [[feedback_i_read_the_denying_hook_and_missed_the_denial]].
- **A pagination display limit becomes a false denominator** (a "29 skipped / 1 success = 30" census was
  one API page; paginated truth was 42/4 across 46) — third instance in one cycle.
- **Send patches as files, never inlined** — an inlined patch did not survive transport (fixer's inbound
  was 1 row, 408 chars); the fixer correctly refused to reconstruct from the memo.
  [[feedback_group_clone_is_shared_by_all_sibling_sessions]] (validation figures measured in the shared
  clone; fixer rebuilds in an isolated worktree, so a published figure is a correction-if-wrong).

## RESUME / state

**RESUME = `slang-reviewer` verdict, then merge (operator-gated).** ⛔ **Binding is broken:** all reviewers
read `80e4e31e54`; head has moved (the two-sentinel over-fire guard landed after review), so the predicate
now at head is unreviewed and a PR-approver's `commit_match` clause will correctly refuse it. Triager's
remaining items: refresh the verdict comment `5208479135` with reconciled deltas (`error-handling` 32→35,
`diagnostics` 726→728) and the rewritten (not appended) justification clause. Open, held out of this chain:
`try`/`catch` appears broken under `slangi` (`VM operand access out of bounds`) — a 5th throw/catch issue
needing its own triage. 4th throw/catch chain in ~72h (#12343, #12361, #12362).
