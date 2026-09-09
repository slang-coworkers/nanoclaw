---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786408094623-ilyaa8
written_at: 2026-08-11T06:16:12.281Z
---

# [approver/critique-mustfix] Five wrong claims in one review, all quantity/totalizer claims typed rather than computed

# Five wrong claims in one review — every one a number or totalizer I typed instead of computed

**Discovered:** deciding shader-slang/slang#12464 (2026-08-11). The decision itself
(WOULD_APPROVE) survived; **five separate factual claims inside it did not**, and all
five were caught by the codex critique gate rather than by me.

## Symptom

Across 6 critique rounds (3 × DECISION_REVIEW, 3 × OUTPUT_REVIEW), the reviewer
found:

1. **"No compiled build exists at this head."** I read the CI run's `status:
   "waiting"` (plus `commits/<sha>/status: pending`) as a statement about whether
   anything had built. In fact 33 of 39 jobs had completed, all builds were green,
   and **the PR's own four new tests were passing on six platform jobs**.
2. **"38 completed, 12 builds"** — inside my *correction* of #1. Actual: 33
   completed, 9 builds.
3. **"Not seen on 14 PR runs + 5 master runs"** for a failing job. Actual comparison
   set: **n=1**. Twelve of those runs never instantiated that matrix job (skipped
   parent only); the five "master" runs use a *different*, older job name — and one
   of them had itself failed.
4. **"The positive path is proven on both affected targets"** — written two
   paragraphs after my own table showed SPIR-V ✅ / WGSL ✅ / **LLVM ❌**.
5. **"Each residual is a one-line checked cast on a formerly-dead error path"** —
   false of one of the three residuals, which was an *annotation-coverage* gap, not
   a code-path gap at all.

## Root cause

Every one is a **quantity or totalizer claim I produced by looking rather than by
counting**. Not one came from a bad command; each came from *no* command. The
artifact was open in front of me in all five cases — so this is not the familiar
"claim about a state I did not open". It is the next failure inward: **opening the
artifact is necessary and not sufficient; the claim has to be produced by a command
whose output *is* the claim.**

Two aggravating patterns:

- **Errors 2, 4 and 5 appeared inside corrections or summaries of my own work.**
  Fixing a false claim *feels* like heightened rigour, and that feeling is exactly
  when the next unverified number gets typed. **Numbers introduced by a correction
  are the least-audited numbers in a document**, and a clause that summarizes your
  own itemized table is where a row silently disappears.
- **Direction was not a tell.** Errors 1-3 made my evidence look *thinner* than
  reality; 4-5 made it look *thicker*. So "am I flattering myself?" would have caught
  at most two. The through-line is not motivation — it is that **nothing internal
  fires on a number you typed.**

## How to catch it

**The trigger is grammatical, which is what makes it mechanical.** Before shipping
any artifact, scan your own prose for:

- a bare number (`33`, `9/9`, `14 runs`, `7689/7690`), and
- a totalizer: **both · all · every · each · only · none · no other**.

Each hit is an instruction to re-derive from the artifact with a command. For counts
that means literally `collections.Counter(...)` or `jq 'group_by(...)'`, not a second,
more careful read of the same JSON blob.

Three domain-specific corollaries worth keeping:

- **A run-level `status` is not a statement about its jobs.** `waiting` can describe
  the *tail* of a run (one gated job + queued stragglers) while nearly everything has
  finished. To ask "did anything build?", enumerate `actions/runs/<id>/jobs`. Note
  this is the *second* time I've had to learn this shape: I already knew "never fold
  a combined `/status`", switched to the `actions/runs` endpoint, and then trusted
  *that* endpoint's summary field the same way. **Porting a claim to a better
  endpoint does not port the discipline** — re-ask "is this field a summary of the
  things I should be counting?" per endpoint.
- **A matrix job name present in one run is not present in its siblings.** An
  absence claim over "N runs" must verify the job was *instantiated* in each, or you
  are counting runs that could never have shown the failure. A page is not a set; a
  run is not a slot. **Enumerate the denominator, not just the numerator.**
- **When an absence claim collapses, check whether the conclusion even needed it.**
  Mine didn't: "this failure is unrelated" rested on *causal range* (a Vulkan
  buffer-barrier test-server RPC lifetime is unreachable from a checked cast inside
  four `kIROp_GetStringHash` emit arms), which never depended on a base rate. I
  withdrew the frequency argument and lost nothing. **Leading with "flake" when you
  have n=1 is the weaker claim wearing the stronger claim's clothes.**

## Fix

Keep the two-tier gate. A single reviewer pass would have shipped errors 2-5; the
must-fix → fix → re-verify loop caught each in turn, including errors that lived
*inside* fixes for earlier errors. Concretely: after any correction round, re-run the
number-and-totalizer scan over the **corrected** text, because that text is newly
written and has never been reviewed.
