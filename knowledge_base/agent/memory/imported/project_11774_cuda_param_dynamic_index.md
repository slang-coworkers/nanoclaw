---
name: project_11774_cuda_param_dynamic_index
description: "#11774 CUDA runtime-indexed params: triager RETRACTED our published root cause (.param placement costs ~6%, not 10-30x; sm_70+ .param is constant-bank-backed, LDC-indexable). Real cost is the per-thread local copy. #11939's OWN BODY still asserts the refuted serial-chain claim. #11992 draft/breaking carries Fixes #11774."
metadata:
  node_type: memory
  type: project
---

# slang#11774 — CUDA runtime-indexed parameter arrays

## ✅⭐⭐⭐ 2026-08-10 — TRIAGER RETRACTED OUR ROOT CAUSE ON MEASURED EVIDENCE, ON THE ORIGINAL TOOLCHAIN. Verified what I could reach.

They replied on #11774 (cmt `5243456461`) conceding to `skallweitNV`. **The measurement is the strongest kind available here: they hold an L40S / CUDA 12.6 / sm_89 box — the ORIGINAL toolchain from the report, not a proxy.**
```
.param 0.2037 / global-ptr 0.1923 / __constant__ 0.2040 ms   => placement axis ~6%, NOT 10-30x
SASS: 64 register-indexed LDC (c[0x0][R+off]), 0 LDL / 0 STL
  => on sm_70+ .param is CONSTANT-BANK-BACKED and ptxas CAN index it dynamically
  => "lowers a runtime index to a serial O(N) dependent chain" is FALSE on this toolchain
real cost = the per-thread LOCAL COPY (~17x), created because isLoadFromImmutableAddress
            (slang-ir-transform-params-to-constref.cpp:196-209) doesn't recognize a by-value .param root
```
⇒ ⭐⭐ **And the issue TITLE names the wrong axis too, which is why this needed a public concession rather than a quiet correction.**

✅ **Their three "stale header" claims verified independently via the API:**
```
#11939  open, NOT draft, pr: non-breaking, base=master, head=haaggarwal/cuda-param-dynamic-index-floor
        -> floor-only; "the by-reference ABI change (layer 2) was split back out into #11992"
#11992  open, DRAFT, pr: BREAKING CHANGE, base=haaggarwal/cuda-param-dynamic-index-floor  <- stacked
        -> body carries "Fixes #11774 (with #11939)"  and "supersedes #11941 ... cannot be reopened"
```
⇒ **So #11939 alone will not close #11774; the closing link lives on a DRAFT breaking-change PR stacked on it.** ⭐⭐ **A `Fixes` on a stacked draft is doubly inert: draft keywords don't fire, and its base is a feature branch rather than master — merging it would close nothing until the whole stack lands on master.** Their landing order (#11939 → slangpy#1045 → #11992 → close #11774) is the right sequence and it is stated in #11992's own body.

⛔⭐⭐⭐ **AND THE PART NOBODY HAS ADDRESSED: #11939's OWN BODY STILL ASSERTS THE REFUTED CLAIM, VERBATIM —** *"a runtime index into a by-value parameter array lowers to a serial per-element load chain — O(N) *dependent* loads per access"* + *"serial 32-element ld.param chain today"*. **That is exactly the mechanism the triager just measured false on sm_89.** ⇒ **The retraction landed on the ISSUE while the same claim stays live in the MOTIVATION of an open, non-draft PR that a reviewer will read as justification.** ⇒ ⭐⭐ **A correction posted on the issue does not reach the PR bodies that repeat it — enumerate every artifact carrying the claim, not just the one where the discussion happened.** Same generator as my own "a correction's blast radius includes derived artifacts".

⚠️ **What they explicitly could NOT close, and said so publicly — the honest limit:** on 12.6 the local copy **does not survive** (real emitted wrapper and standalone shapes give byte-identical PTX/cubins, 0-byte frame); it only materializes under a forced inlining barrier (1408 B frame, 176 `STL.64`, **96 `LDL`** — matching his 96 `LDL` exactly). **So they confirmed his MECHANISM and refuted the OLD ATTRIBUTION without showing the temp explains the original 10-30x.** And `sm_120` was untestable — CUDA 12.6 `ptxas` rejects it ⇒ **a capability gap, not a null result** (the distinction my store's negative-claims rule demands).

⚠️ **Their risk probe on #11939 is worth carrying to review:** its floor deliberately adds one local copy, and a hand-written approximation of that shape is **17.4× slower** than the no-copy baseline, *because on 12.6 the already-fast shape is fast precisely by having no stack frame.* Framed as a risk probe, not a claim about the PR (whose own sweep says perf-neutral) — ⇒ **"benchmark the floor against an already-fast case" is now load-bearing, not optional.**

✅ **Scope note in their favour, and they measured it rather than asserting it: OUR triage comment never made the causal claim** (`cannot`/`serial`/`O(N)` = 0 occurrences). It said only that placement differs, which is true and re-verified. **The bad attribution is in szihs's body, 07-07 status, and title — so nothing else of ours needed retracting.** ⭐ **Bounding a retraction by measuring your own prior text is the right move; it prevents an over-broad apology that concedes claims you never made.**

⭐⭐ **And their codex gate earned its keep concretely: 4 rounds (NEEDS_WORK ×3 → APPROVE) killed "these loads are independent" (only the SELECTION CASCADE is absent), a PTX-vs-SASS count mismatch that would have invented a discrepancy with his numbers, and "this explains the dashboard step" → "may be related to".** All three are overstatement-of-mechanism errors — the exact class this week's chain kept producing.
