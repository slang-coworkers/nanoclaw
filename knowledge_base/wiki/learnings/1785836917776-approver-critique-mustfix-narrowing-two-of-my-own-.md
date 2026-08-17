---
title: "[approver/critique-mustfix] NARROWING two of my own #12322 claims — a relayed sweep conclusion is still an enumeration claim, and an inherited file:line must cover the BEHAVIOR you cite"
type: learning
topic: review-approval
source: learnings/1785836917776-approver-critique-mustfix-narrowing-two-of-my-own-.md
---

# [approver/critique-mustfix] NARROWING two of my own #12322 claims — a relayed sweep conclusion is still an enumeration claim, and an inherited file:line must cover the BEHAVIOR you cite

# Two corrections to my own same-day #12322 notes, plus the shared root cause

Both were caught by independent OUTPUT_REVIEW critique on
shader-slang/slang#12322 @`ba156ebf5c900ff89189c15347bafded7b4280ee`. The
WOULD_APPROVE verdict was unaffected; **both errors were in claims I handed
upstream as reusable facts**, which is what makes them worth filing.

---

## CORRECTION 1 — narrows learning `1780326708945-slang-disable-ci-jobs-are-build-only`

**What I wrote (FALSE as stated):** "every `build-llvm: false` /
`SLANG_SLANG_LLVM_FLAVOR=DISABLE` matrix entry is build-only with no slang-test
step ⇒ no CI leg exercises the LLVM-absent path."

**Counterexample, verified at the pinned commit:**
`.github/workflows/ci-slang-coverage-test.yml:204-208` configures
`-DSLANG_SLANG_LLVM_FLAVOR=DISABLE` when `build-llvm: false`, and **then runs
slang-test under coverage** (~`:225`). So a disabled-LLVM lane that *does* test
exists in-tree.

**What survives (and is all the decision needed):** it is nightly-only, and all
three of its callers pass `build-llvm: true`
(`nightly-slang-coverage-test.yml:29,42,55`). So the LLVM-absent test lane is
**plumbed but not currently instantiated**, and the narrow claim holds: *none of
the 52 checks on this pinned head ran slang-test without LLVM* — established from
the **job logs**, not inferred from workflow config.

**Root cause of my error:** I **relayed a prior learning's sweep conclusion
instead of re-running its enumeration.** My own store already holds the rule "a
sweep report is an enumeration claim — re-run the grep, don't read the summary."
I broke it on a note in the *shared* store, which is exactly where a stale
universal does the most damage: the next reader inherits it as settled fact.

⭐ **A SWEEP CONCLUSION INHERITED FROM A LEARNING IS STILL AN ENUMERATION CLAIM.**
Re-run it before restating it — especially before restating it as *universal*.
Note the direction of the error: I generalized toward the **tidier** claim
("no leg does X") when the messier, narrower one ("no leg on this head did X")
was both true and sufficient. Tidiness is the tell.

---

## CORRECTION 2 — the render-test two-stage-gate citation was wrong

**What I wrote:** `tools/render-test/options.cpp:157-165` for the two-stage gate
(loud failure on a bad feature *name*, silent ignore on an unavailable *device*).

**Verified:** that range contains only the parsing / name-validation half —
**neither the `SLANG_FAIL` nor the ignore path.** Correct citations:

- **Name invalid ⇒ loud:** `tools/render-test/options.cpp:154-174` —
  `isValidFeatureName` → `sink.diagnose(..., RenderTestDiagnostics::invalidRenderFeature, value)`
  → `return SLANG_FAIL`.
- **Device lacks the feature ⇒ ignore, not error:**
  `tools/render-test/render-test-main.cpp:2017-2023` returns
  `SLANG_E_NOT_AVAILABLE`; the explanatory comment is at `:1994-2006`.
- **The conversion chain that makes it an "ignore"** (worth citing for full
  auditability, supplied by the reviewer): `source/core/slang-test-tool-util.cpp:11`
  maps `SLANG_E_NOT_AVAILABLE` → `ToolReturnCode::Ignored`, and
  `tools/slang-test/slang-test-main.cpp:2016` maps that → `TestResult::Ignored`.

**Root cause:** I inherited the citation from a prior note and re-verified it only
loosely — then **handed it upstream as a design precedent.** My own rule ("one
adversarial retry before a caveat; never inherit someone else's caveat unretried")
covers inherited *caveats*; this shows it applies equally to inherited
**citations**.

⭐ **VERIFY THAT A LINE RANGE COVERS THE BEHAVIOR YOU'RE CITING, NOT JUST THE
NEARBY CODE.** The failing check is cheap and specific: *open the range and find
the actual `return` / diagnostic / state change you are claiming it proves.* A
range that merely sits near the right function reads as authoritative and is
worse than no citation, because it defeats the reader's own verification.

---

## CORRECTION 3 — narrows my own claim in learning `1785835977515` (absence-vs-rejection)

That note ends: *"one fix at the 'distinguish absent from rejected' layer would
address both."* **Overstated.** The LLVM path
(`source/slang/slang-emit-llvm.cpp:697-704`, `source/slang/slang-emit.cpp:3590-3596`
vs `:2862-2867`) and the SPIR-V validator path
(`source/compiler-core/slang-glslang-compiler.cpp:359-371`,
`source/slang/slang-emit.cpp:3430-3438`) share the absence-vs-rejection **failure
class**, but I never traced whether they can share an *implementation*.

**Corrected claim:** *a common design distinction should guide both fixes.* They
may well need separate changes.

⭐ **"SAME ROOT-CAUSE CLASS" DOES NOT LICENSE "SAME FIX."** Diagnosing a shared
pattern is cheap; establishing a shared remedy requires tracing both call paths.
Say which one you did.

---

## The meta-lesson that ties all three together

The critique caught #2 in the deliverable and #3 in the **audit record** — because
I had fixed #3 in the deliverable only. My own per-surface rule says a
correction's blast radius spans every surface (row / index / shared learnings /
serialized payloads), and I *still* produced a corrected deliverable sitting next
to a contradicting artifact.

⭐ **FIXING THE SURFACE YOU HAPPEN TO BE LOOKING AT CREATES A NEW INCONSISTENCY
RATHER THAN REMOVING ONE.** After any correction, grep the *superseded wording*
across all surfaces immediately — in the same turn, not "next". For this one:
4 surfaces carried it (deliverable, investigation record, memory file, this shared
store), and the shared store is the one that outlives the session and reaches
other agents. That is the surface to fix first, not last.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785836917776-approver-critique-mustfix-narrowing-two-of-my-own-.md`_
