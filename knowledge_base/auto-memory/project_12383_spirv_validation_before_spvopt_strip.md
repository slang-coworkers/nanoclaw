---
name: project_12383_spirv_validation_before_spvopt_strip
description: "slang#12383 — SPIR-V validation runs BEFORE spirv-opt and before debug-stripping, so shipped bytes were never validated. Bot-filed spin-off of #12371, fully triaged in its own body. PARKED: needs a policy decision + a suite survey, and both adjacent issues (#12247, #8681) are jkwak-assigned. RESUME: human comment on #12383 (arrives by webhook — no guard armed)."
metadata: 
  node_type: memory
  type: project
  originSessionId: 0dacff7c-b2e0-4955-93f6-07f27abcd3f8
---

# slang#12383 — validation is mid-pipeline, not at finalisation

Filed 2026-08-06 06:08:02Z by `nv-slang-bot[bot]` as the spin-off our own #12371 chain promised.
OPEN, **0 comments**, no assignee, Issue Type **Bug**, labels `Diagnostics` + `spirv_validation`.

**Not a report that Slang emits invalid SPIR-V.** The body is explicit: four shipped artifacts were
fed to `glslang_validateSPIRV` after the fact and all four passed, with a malformed control
correctly rejected. The claim is narrower — **a supported configuration ships bytes nothing
checked.** Two instances in `createArtifactFromIR` (`source/slang/slang-emit.cpp`): `spirv-opt`
(validate `:3432`, compile `:3487`, artifact replaced `:3486`/`:3492`) and `-separate-debug-info`
(`stripDbgSpirvFromArtifact` `:3496`, `artifact = _Move(strippedArtifact)` `:3497`). The second is
independent of `-O` level and easy to miss.

## ⛔⭐⭐⭐ 2026-08-09 14:04Z — #12408 WOULD AUTO-CLOSE #12371 WHILE SHIPPING THE KNOWN-FAILING TEST. VERIFIED INDEPENDENTLY, ALL FOUR CLAIMS HOLD.

`slang-fixer` escalated this and I checked every leg at the named shas rather than relaying:
```
PR #12408  state=open draft=true  head=fix/issue-12383@49dbe8c165  base=master  mergeable=blocked
   body: "Fixes #12371."  "Fixes #12383."          <- both present, verbatim
   tools/slang-unit-test/unit-test-spirv-link-validation.cpp EXISTS, 223 lines
     grep -cE 'haveSpirvOpt|SLANG_IGNORE_TEST'  ->  0
     :222  SLANG_CHECK((outcome.generatorMagic & 0xFFFF0000u) == kSpvGeneratorKhronosLinker);   <- UNCONDITIONAL
PR #12382  state=open draft=true  head=fix/issue-12371@80c93009cb
     same grep  ->  4
compare 49dbe8c165...80c93009cb  ->  diverged, ahead=5 behind=25, merge-base f93eb4f74a
```
✅ **And I identified WHICH of the five missing commits is the Windows fix, which the escalation asserted but did not pin** — walking the guard count per commit:
```
50d7a5e71f  "Skip the SPIR-V link validation test when there is no downstream linker"   guard=1   <- THE FIX
7037262b16  "Key the link-validation skip on the dependency, not the emitted module"    guard=5
115185a041  "Report the spirv-opt load failure the test depends on"                     guard=4
97cf9c6da1 / 80c93009cb  comment-only                                                   guard=4
```
⇒ **The "behind 5" is not cosmetic: the FIRST of the five is the fix, and #12408's head predates all of them.** ⇒ **Merging #12408 as-is reintroduces the `windows-*-cl-x86_64-gpu` failure AND auto-closes #12371 via its own `Fixes` line — shutting the issue that would have tracked the regression.** The escalation's framing is right and "behind 5" undersells it.

⚠️ **BUT #12408's OWN BODY CONTRADICTS ITS OWN CLOSING LINE, and this is the part nobody flagged:** the body says *"This PR is a strict descendant of #12382's head and therefore **contains** that fix"* — **measured FALSE: `diverged`, `behind=25`, and the guard count is 0 vs 4.** The `Fixes #12371` line was justified *by* that false premise (*"#12382's own `Fixes #12371` will not fire from this merge — hence both closing links below"*). ⇒ ⭐⭐⭐ **A CLOSING KEYWORD INHERITS THE TRUTH OF THE SENTENCE THAT JUSTIFIES IT, AND GITHUB ENFORCES THE KEYWORD REGARDLESS.** The reasoning was sound *when written* (the branch presumably was a descendant then) and the divergence silently invalidated it while the mechanical consequence stayed armed. **A stale "strict descendant" claim is load-bearing in a way a stale prose caveat is not.**

⇒ ✅ **ROUTING POSITION: the fix is mechanical (cherry-pick `50d7a5e71f..80c93009cb` onto `fix/issue-12383`, or drop `Fixes #12371` from #12408's body) but BOTH touch a branch `slang-fixer` is barred from, and the second is a maintainer-facing scope decision.** Correctly refused by them; **operator-gated at my tier too — I hold no GitHub write.** ⭐⭐ **The draft status is doing real protective work here: `draft=true` means the keyword cannot fire yet. That is the reason this is urgent-before-ready-flip rather than urgent-now** — and a reviewer flipping it to ready without reading the body would arm both consequences in one click.

## ⭐ 2026-08-12 17:55Z — RE-OPENED by maintainer decision; parking precondition now MET

`jhelferty-nv` (human maintainer, **now co-assigned to #12383 with `jkwak-work`**; no bot mention)
commented (id 5270550992): *"From discussion with Tess, it sounds like we want the canonical
validation step to happen at the end … We probably still also want an option to run validation where
it currently is, though, via a `-paranoid-validation` flag or the like, so that we can catch any
invalid spirv we generate internally prior to the spirv-opt step from CI?"*

⇒ **The policy decision that parked this chain has been made by the maintainers: YES, canonical
validation at finalisation** (the A2 direction #12408 implements). So reasons 1–2 below are now
*resolved by human input*, not standing. **Plus a new, additive requirement #12408 does not currently
carry:** retain an **opt-in flag** to *also* validate at the current pre-`spirv-opt` point for CI —
not a replacement for the move, an addition. Whether that rides in #12408 or splits is a maintainer
design call, not mine.

Forwarded to `slang-triager`'s existing session for this chain (`sess-1786044169494-ew23ak`, pinned
via `target_session_id`) on `thread_id=gh-issue-shader-slang/slang-12383`. Triager owns the GitHub
verdict + fixer edge; I hold no GitHub write. A substantive human comment on a parked chain re-opens
it — this is that, not a thanks/ack.

**Triager acted 2026-08-12 18:06Z (cmt `5270709223` on #12383):** verified at #12408's *current* head
`e7f5274eee` — the **canonical A2 half is DONE**: `validateSpirvArtifact(...)` runs on the *final*
`artifact` at `:3612` (after optimize+strip), and the A1 fix is intact (4 validation calls, 0 fed
`spirv.getBuffer()`). **`-paranoid-validation` is confirmed genuinely additive:** #12408 validates the
pre-optimize module *only on failure paths* (`:3585`,`:3598`, inside `SLANG_FAILED` guards), never on
a successful compile — which is exactly the CI check jhelferty wants. Would be a new `OptionKind`
appended to the ABI enum on the `-skip-spirv-validation` pattern. **Open question routed to
maintainers + jkwak:** does the flag ride in #12408 or split to a follow-up (triager leans follow-up).
**No fixer dispatch** until they pick. Chain now correctly in maintainer hands.

**Descendant-relation carry re-verified by triager at current heads:** both PRs moved in the 5-day gap
(#12382 `f93eb4f74a`→`80c93009cb`, #12408 `d8dcbe3549`→`e7f5274eee`); `compare 80c93009cb...e7f5274eee`
⇒ diverged, ahead 33 / behind 5 — #12408 now carries `Merge origin/master` commits, so the "strict
descendant" wording at #12408 body `:269` is **stale** (substance still holds — it carries #12382's A1
content). Left unedited (jkwak's surface). ⚠️ **Stale closing-keyword hazard still armed:** #12408 refs
`Fixes #12371` + `Fixes #12383`; if the flag stays in #12383's scope but ships separately, #12408
merging auto-closes #12383 before the flag lands. Triager co-trigger set: maintainer picks flag home
⇒ dispatch fixer on this thread; #12408 moves toward ready ⇒ re-check the closing-keyword split first.

**Live family state 2026-08-12 (moved far past the Aug-6 rows below):** #12371 open · **#12382** open
draft, head `80c93009cb`, MERGEABLE, title narrowed to *"Validate the linked SPIR-V module…"* · **#12408**
open draft, head `e7f5274eee`, MERGEABLE, title *"Validate the final SPIR-V artifact…"* (the A2 PR).
⚠️ #12408's stale `Fixes #12371` + false "strict descendant" hazard (§ 2026-08-09 below) is **still
armed** if this comment pushes it toward ready.

## Why no fix chain was opened (deliberate, 2026-08-06 06:1xZ) — SUPERSEDED by the re-open above for reasons 1–2

Three converging reasons, not one:

1. **It is a policy decision, not a bug fix.** Moving validation to finalisation *could newly
   reject output that ships today*. Nobody has surveyed how much. The body names the precondition
   itself: a full `slang-test` run with validation forced on at a **non-zero** optimisation level.
   That is a long run whose outcome licenses a behavioural change — operator's call to launch, not
   mine to start unasked.
2. **Both adjacent issues are maintainer-owned.** #12247 (*slang-test -O3 has 79 failures when
   spirv-opt is enabled suite-wide*) and #8681 (*use spirv-opt for debug-strip*) are **both OPEN and
   both assigned to `jkwak-work`**. Per [[feedback_no_autofixer_jkwak_self_filed]] that territory
   gets triage-and-park, never an auto-fixer.
3. ⭐ **The survey #12383 wants may substantially overlap #12247's existing baseline** — same suite,
   same optimiser setting. Not the same measurement (test failures ≠ validation rejections), so it
   does not *substitute*; but a maintainer weighing the cost should know the run may already be half
   done. This connection is the one piece of content the issue body does **not** carry.

#8681 would reshape instance 2 entirely — if debug-stripping moves into `spirv-opt`, the
strip-replaces-the-artifact instance stops existing in its current form.

## RESUME trigger — webhook, no guard

A human comment on #12383 arrives as an `issue_comment` webhook, which is a trigger whose *receipt*
I control. Deliberately **no cron guard armed** — contrast #12371, where the outstanding items were
a peer's PR number and an operator reply, neither of which announces itself. Arming a guard here
would be a redundant timer over a channel that already delivers. Stating this so the absence reads
as a decision, not an oversight ([[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]]).

## Trail state — closed on the issue end, open on the PR end

Verified rather than inherited from the body's claim that "the trail is closed on both ends":

- ✅ **#12371's verdict comment 5197829621 DOES name #12383** (`updated 2026-08-06T06:08:36Z`, 34 s
  after the issue was created — the triager patched it in place).
- ⛔ **PR #12382's body does NOT name #12383.** Its *Known limitation* section (line 116 of the
  body) describes the defect accurately and ends *"Filing it as its own issue is the right next
  step"* — a dangling recommendation, because the issue number did not exist when the body was
  written. Three reviewers (A correctness / B Devin / C clarity) were mid-review on
  `5c4c63d17e` when #12383 was filed, so a reviewer hits that sentence with no way to see it was
  acted on. Mechanism: [[feedback_a_recommendation_cannot_cite_what_it_causes]].

Routed the forward-link patch to `slang-fixer` **through `slang-triager`** (direct edges only — the
fixer is triager's child, not mine) on `thread_id=gh-issue-shader-slang/slang-12371`, since the PR
is that chain's artifact.

## Provenance of the measurements in the body

Measured at `9cd92bb3a` (the #12353 merge) and re-confirmed against #12382's head `5c4c63d1`.
Size evidence for "the optimizer does change the shipped bytes":
`tests/library/precompiled-spirv-generics.slang` → **1668 B at `-O0`**, **964 B at default**, `cmp`
differs. Population context for the unrun survey: ~4,474 `.slang` files under `tests/`, ~1,239
mentioning `-target spirv`.

Related: [[project_12371_spirv_prelink_validation_buffer]] (parent chain),
[[project_12247_slang_test_o3_spvopt_baseline]], [[project_8681_debuginfo_strip_spiropt]],
[[project_12331_spirv_opt_size_preset_Os]].
