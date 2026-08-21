---
name: project_12405_peephole_fp_mode_unreachable_and_leaks
description: "#12405 slang peephole Add/Sub float zero-fold ungated. Two defects, one root cause (Main-verified at d7d59f374): the pass NEVER reads -fp-mode, and autodiff's Fast leaks module-wide via the fixpoint loop. Triaged, no fixer, awaiting maintainer Q1."
metadata: 
  node_type: memory
  type: project
  originSessionId: 2861fef4-d207-4f49-a66d-1fde7cb32722
---

# #12405 — peephole fp-mode is unreachable from the CLI, and autodiff's `Fast` leaks

Filed 2026-08-06 17:36Z by our own `nv-slang-bot[bot]` (a sibling slang-triager session) as a
spin-off while triaging #12396. Title is about the `Add`/`Sub` additive-identity fold not being
gated on `allowUnsafeOptimizations` while the adjacent `Mul`/`Div` zero folds are.

**RESUME trigger:** (A) a maintainer answers the body's Q1 (deliberate vs oversight) — that
converts Q2-Q4 from a decision into a change request and unblocks a fixer; (B) any fresh
substantive human comment; (C) a PR appears touching `slang-ir-peephole.cpp`
`tryOptimizeArithmeticInst` or `processFunc`; (D) **catch-all, outranks A-C** — any inbound that
adds an *obligation* or changes *scope* (revert requirement, follow-up issue, doc mirror, "when X
lands also do Y"), not only ones that change the answer.

**~~FINAL STATE 2026-08-06 18:09Z~~ SUPERSEDED — maintainer answered, chain re-opened.** Triaged,
body PATCHed 9412→14817 chars, comments 0, labels `bug` + `reproduced`, Type `Bug`.

**MAINTAINER VERDICT 2026-08-06 ~18:2xZ — jkwak-work (MEMBER), cmt `5363875868`:** *"I think both
are unintended bugs. For Q1, allowUnsafeOptimizations should be also applied to Add/Sub; please
leave comments in the code that explains why it should be applied. For Q2, let's apply `-fp-mode`."*

⇒ **Resume trigger A fired.** Both findings confirmed bugs, both to be fixed:
- **Q1** → gate `Add`/`Sub` identity folds on `allowUnsafeOptimizations` (as `Mul`/`Div` already
  are), **with an in-code comment explaining why** — the maintainer asked for this explicitly, so
  the comment is a deliverable, not optional.
- **Q2** → make the pass actually consult `-fp-mode` (the unreachability defect).

Routed to `slang-triager` on the canonical thread 2026-08-21 for the fixer handoff (ANCHOR H —
triager owns it, not a direct Main→fixer send), **pinned to `sess-1786038083166-nu4qd4`** (the
existing 12405 triager session, holds the full analysis + 08-10 triage-summary comment `5240474724`).
Pin held — verified exactly one triager 12405 session, no phantom minted. Verdict comment is
`5363875868`, issue assigned `jkwak-work`, milestone Q3 2026. PR #12417 (fixer session
`sess-1786035669521-4aptki` on the **12396** thread, mapping confirmed) is a *different* fix that
deliberately left this fold alone — genuinely new fix work, not a re-open of #12417.

**HANDOFF COMPLETE 2026-08-21 ~01:05Z (triager 5-bullet, msg 48):** fixer dispatched on the canonical
thread with the principled single-fix brief. Triager re-verified all four anchors at current HEAD
**`de679fdc3`** (peephole `:21`/`:167-257`/`:304-305`/`:2033-2056`; `getParentFunc` `slang-ir.h:2494`;
`getFloatingPointMode` `slang-compiler-options.h:395`) — **`d7d59f374` confirmed stale**, fixer
branches from `de679fdc3`. Incremental GitHub comment posted `5363936441` (human was last poster, so
a fresh comment was correct, not an edit). All three of my emphases passed to the fixer verbatim:
Q1 in-code comment = PR acceptance criterion; `processFunc` save/restore no-op trap flagged;
Q2 scope consequence (newly-enabled `Mul`/`Div` fast-math folds → baseline churn + two-sided
regression tests, build+slang-test settles it). Fixer to open draft PR with `Closes #12405`; triager
forwards the [Triage Resolution] up when the Fix Report lands.

⚠️ **Line numbers drifted at `de679fdc3` — use these, the ones in this memo's body are `d7d59f374`:**
ungated `Add`/`Sub` `isZero` folds now at `slang-ir-peephole.cpp:205/209/216/220` (the Q1 comment
site), `isFloatingPointModePrecise` reference pattern at `slang-emit-spirv.cpp:10414` (not `:10406`),
`getParentFunc` `slang-ir.h:2494`, `getFloatingPointMode` `slang-compiler-options.h:395`. Anchors
re-confirmed against live source by the triager, not memory.

Aside logged by triager: a `[GATE AUDIT]` critique warning fired on its report to me — a false
positive, substring-matching the bracketed `[Fix Report]` marker in prose referencing the fixer's
*future* report. That session reviewed no code, so the critique gate doesn't apply; triager shared
the gotcha as a learning. Not a defect in the chain.

**NEXT RESUME:** the fixer's Fix Report / PR-opened event arriving up through the triager — expect a
draft PR `Closes #12405` against `de679fdc3`+. Nothing owed from Main until then. ⚠️**Scope consequence the fixer must handle deliberately,
already verified in this memo:** satisfying Q2 (pass reads `-fp-mode`) **newly enables the `Mul`/`Div`
zero folds for all user fast-math code** — a real behaviour change beyond a bug fix. The principled
single fix (delete the `floatingPointMode` member, resolve per inst à la
`isFloatingPointModePrecise` `slang-emit-spirv.cpp:10406`) satisfies **both** Q1 and Q2 and kills the
module-wide leak by construction. The Q1 code-comment lands at the `Add`/`Sub` fold site
(`slang-ir-peephole.cpp:205-219`).

**Test-dependence precondition ANSWERED (triager's sweep): no in-tree test depends on the ungated
behaviour** — `CHECK-NOT` lines with a zero literal = 0 against a 443-line must-hit control; 913
`.expected*` baselines clean; the mirror case (a test pinning float `x*0.0` surviving) also 0.
Structural rather than lucky: almost nothing FileChecks emitted *float* arithmetic, and the only
mul+add text assertions are 4 **integer** `uint3` lines where the gate is `true` regardless.
⇒ **Q1 is a decision, not a change request.** ⚠️Their published caveat, which is the right one:
*"no test depends on it" ≠ "no test breaks"* — gating makes an `Add(0.0, x)` survive into later
passes, and settling that needs a build + `slang-test` that was not run.

⚠️**Label set is `bug` + `reproduced` because no subsystem label fits** — the repo's 82 labels
include no `IR`, no `Optimization`, and nothing float/codegen-shaped. Borrowing a *target* label for
a target-independent defect would have been worse. Don't "fix" this later thinking a label was
missed.

## What the triager added beyond the filed body

The body shipped with a self-declared inconclusive probe: *"my attempt emitted `_S2 * 0.0f`
unchanged in **both** modes, so that probe is inconclusive and the `Mul`/`Div` gating claim rests
on the source read, not on measurement."* I routed exactly that gap. They closed it, and the
reason it was inconclusive is structural rather than a bad test shape.

### Defect A — the peephole never consults `-fp-mode` at all

`PeepholeContext::floatingPointMode` (`slang-ir-peephole.cpp:21`) defaults to `Precise` and has
**exactly three** occurrences in the whole file (Main-verified: `grep -n 'getFloatingPointMode\|floatingPointMode'`
→ `:21` decl, `:170` read, `:305` write). There is **no** `targetProgram->getOptionSet().getFloatingPointMode()`
call anywhere in the file. So `-fp-mode fast` vs `-fp-mode precise` is byte-identical **by
construction** — no test shape could ever have discriminated it. The triager's original probe was
not weak; it was measuring a variable that has no path to the gate.

The single writer at `:305` reads `IRFloatingPointModeOverrideDecoration`. Main-verified that
decoration's only producer tree-wide:

- `IRBuilder::addFloatingModeOverrideDecoration` defined `slang-ir.cpp:6097`
- called **once**, `slang-ir-autodiff-fwd.cpp:2247`, unconditional inside `translateFuncHeader`,
  always `FloatingPointMode::Fast`

⇒ the only way `allowUnsafeOptimizations` is ever true for a float in the peephole is inside a
forward-mode autodiff-generated function.

### Defect B — `Fast` leaks across functions by traversal order

The leak is real. Triager measured it behaviourally (their evidence): an ordinary function textually
after a `[Differentiable]` one folds its float `x*0.0`; move the call before it and the same
function keeps the multiply; a no-autodiff control keeps it in all three.

⇒ unsafe float folding in `precise` functions is **order-dependent**, worse than the ungated-`Add`
asymmetry in the issue title.

⛔ **But the mechanism is NOT the `processFunc` save/restore omission, and that misattribution has
teeth.** Triager framed it as *"`processFunc` saves/restores `isInGeneric` but not
`floatingPointMode`"*. In the module-wide path `processFunc` **is called exactly once** — on the
module inst (`processModule()` → `processFunc(module->getModuleInst())`, `:2058`/`:2061-2069`). It
is not invoked per function. So adding `floatingPointMode` to its save/restore would be a **no-op
for cross-function leakage**: there is no per-function scope for it to restore.

The actual mechanism, Main-verified:

- `processChildInsts` (`slang-ir-inst-pass-base.h:94-112`) is **one flat worklist walk over every
  inst under the root** — not per-function recursion. LIFO (`pop()` takes `getLast()`, `:33`),
  children pushed last-to-first, so the traversal is depth-first in declaration order. That is
  exactly why the defect presents as *textual* order.
- `processInst` (`:302-306`) sets `floatingPointMode` on a decorated `IRGlobalValueWithCode` and has
  **no else-branch** resetting it for an undecorated one. The assignment is sticky.

⇒ once an autodiff-generated function's subtree is walked, the mode stays `Fast` for every function
popped afterwards in the same walk. The per-func entry point `peepholeOptimize(target, IRInst* func)`
(`:2071`) builds a fresh context per call, so it does not leak; the module path does.

⭐⭐⭐ **The triager then out-corrected my correction, and it is the best finding in the chain.**
My within-walk story explains a function walked *after* the autodiff one. It does **not** explain
their measurement, where the function declared **first** also lost its multiply. Their mechanism
does: the **fixpoint loop** at `:2042-2050` re-runs `processChildInsts` from scratch while
`floatingPointMode` is a member that survives across iterations — so **iteration 2 begins with the
`Fast` left by the end of iteration 1**, and every function is then folded regardless of position.
Main-verified: the loop body re-walks unconditionally on `changed`, `isInGeneric` is restored at
`:2053` but the fp mode is never restored or reset anywhere (`grep -n 'floatingPointMode *='` → the
`:21` initializer and the `:305` assignment, and nothing else in the file).

⇒ declaration order is not even a reliable predictor: **one folding function anywhere in the module
contaminates the entire module on the next fixpoint iteration.** That is strictly worse than the
order-dependence originally reported, and it makes the leak effectively module-global rather than
positional. It also means my "LIFO ⇒ declaration order" framing, while correct about the traversal,
was the wrong layer for explaining the observation.

⭐⭐ Lesson: a mechanism that reproduces the *direction* of an effect can still fail to predict its
*coordinates* — here, "the first-declared function folded too". Their probe was the discriminator my
source read could not have been. Cf. [[feedback_mechanism_must_predict_observed_coordinates]],
third instance.

### The correct pattern already exists in-tree

`slang-emit-spirv.cpp:10406` `isFloatingPointModePrecise` does it right, and its comment even names
the autodiff case:

```cpp
auto mode = m_targetProgram->getOptionSet().getFloatingPointMode();
if (auto func = getParentFunc(inst))
    if (auto fpModeDecor = func->findDecoration<IRFloatingPointModeOverrideDecoration>())
        mode = fpModeDecor->getFloatingPointMode();
```

Global option as the base, per-parent-function override on top, resolved per inst so nothing is
carried between functions. Added for #11933 (`NoContraction` on the direct SPIR-V path).

## ⭐⭐⭐ The state-carrying member is the single root cause of both defects

A and B are not two bugs; they are two faces of `floatingPointMode` being **mutable pass state
mutated during a flat traversal** instead of a value resolved per inst. A is "the state has no path
from the CLI option"; B is "the state outlives the function that set it".

That reframing also kills the tempting minimal fix. Adding an else-branch at `:305` to reset the
mode for undecorated functions would stop the leak, and `-fp-mode precise` would remain **just as
unreachable** as before (it is already the default, so nothing observably changes) — a fixer would
measure "leak gone" and declare victory on a report whose headline is fp-mode gating.

The principled fix is to delete the member and mirror `isFloatingPointModePrecise`
(`slang-emit-spirv.cpp:10406`): global option as the base, per-parent-function override resolved
**per inst**. Stateless, so B cannot recur by construction, and A is fixed because the global option
is finally consulted. This is the repo's own methodology applied — fix the representation so
consumers stay simple, rather than guarding a consumer against state a producer should never have
carried.

⚠️ Consequence a maintainer must weigh before anyone patches: making `-fp-mode fast` actually reach
this gate **newly enables** the `Mul`/`Div` zero folds for all user fast-math code. That is a
behaviour change well beyond a bug fix, which is precisely why Q1/Q2 are maintainer-owned.

## ⛔ My brief overstated a negative I had no instrument for

I dispatched saying the issue had "zero labels, no Issue Type". Labels genuinely were empty
(`"labels": []` from `github_get_issue` at 17:37Z and again via search at 17:54Z). **Issue Type I
asserted without any method that could observe it** — the MCP GitHub view returns no type field at
all, so my claim was unfalsifiable from where I stood. The triager corrected it: Type was already
`Bug`, set by our bot at filing 17:37:14Z. Same class as
[[feedback_published_negative_env_claims_need_rederivation]] — a capability/absence negative that
logs nothing when a reader complies. Correct form was *"labels empty per the API; I cannot see the
Type field — check it."*

## ⚠️ Shared-identity credit mis-routing — a new failure mode for this store

I praised "the restructured body" to the triager on the 12405 thread. **That restructure (17:54:07Z,
the case-analysis table + search-basis section) was a DIFFERENT session's work** — the triager had
issued no PATCH when my message arrived, and told me so unprompted. Both sessions are
`ag-1780667166418-apezq5` publishing as `nv-slang-bot[bot]`; verified live there are two active
triager sessions in play, `…-nu4qd4` on `gh-issue-…-12405` and `…-4zoory` on `…-12396`, and the
issue was filed *by* the 12396 one.

⇒ ⭐⭐⭐ **Under a shared bot identity, a GitHub artifact's `updated_at` tells you WHEN it changed and
nothing about WHICH session changed it.** I attributed content to my correspondent purely because it
appeared between my dispatch and their reply — a post-hoc-ergo-propter-hoc read of a timestamp. The
peer had to correct praise, which is a strange and easy-to-miss direction for a correction to run.
**Before crediting or blaming a session for a shared-identity artifact, ask whose session wrote it**
(`ncl sessions list | grep <agent-group>`, compare thread ids), or attribute to the tier, not the
session: *"the body now carries…"* rather than *"you added…"*.

This is the inverse of the two-sessions-one-task phantom in `CLAUDE.md`: there the danger was
believing a phantom's report over my own rows; here it was believing my own inference about
authorship over the fact that two legitimate sessions share one output surface. Same root: **session
identity is not visible in the artifact.**

## ⚠️ Shared clone went dirty mid-chain — my edge did not

Triager reported the shared slang clone acquiring 3 tracked mods during its session
(`hlsl.meta.slang` `dot` glsl arm, `slang-check-shader.cpp`, `slang-diagnostics.lua`), none of them
its own, warning that "verified at `d7d59f374`" read off that tree would be misleading.

**Do not merge that with my measurement.** Mine: `/dev/vda1[/home/ubuntu/slang-coworkers-prod/nanoclaw/groups/main]`,
`HEAD d7d59f374`, **0 tracked mods**, and each of the five files my claims cite individually
confirmed unmodified. Their edge is a different mount (see the anchored per-container-path rule).
Both reports are true about different objects; I am **not** repeating the 08-06 mistake of
"disproving" a peer's file claim from my own tree. The `d7d59f374` pin is sound *for the claims in
this memo as verified on my edge*; a reader on another edge must re-derive.

## Standing scope

The body's four numbered questions are maintainer-owned (deliberate-vs-oversight is not ours).
**No fixer forward** unless Q1 comes back "oversight". Triager edited the body in place at 17:54Z
to carry both consequences; `comments_count` stayed 0, which is correct — the body is the public
footprint and a restating comment would be noise.

Related: [[project_12364_cts_storage_image_minnonuniform]] for the resume-trigger clause-D pattern
reused above.
