---
name: feedback_a_hard_won_distinction_becomes_a_false_prior
description: "A distinction earned by measurement on issue N becomes an UNMEASURED PRIOR on issue N+1 — and it arrives feeling like expertise, not like a guess. Measured 2026-08-05: the #6518 file-split (__include/implementing) finding made me (a) implicate #6578/#6524/#6572 as port-blocked on zero evidence and (b) hand #6664 a split-module hypothesis when its modules use plain import. Both wrong, both caught by the coworker I dispatched."
metadata:
  node_type: memory
  type: feedback
  originSessionId: main-6518-scrub
---

# ⛔⭐⭐ The distinction you just earned is the prior you will next get wrong

**2026-08-05, shader-slang/slang departure-scrub batch (19 issues).** On **#6518** a real and subtle
finding came out of careful measurement: several precompiled-module tests *look* transitive but are
not, because `__include` + `implementing` is a **file-split of one module**, not a second module. Three
tests in two repos share that shape. Genuinely useful.

**Then I reused it twice without re-measuring, and it was wrong both times:**

1. **#6578 / #6524 / #6572 implicated as "port-blocked"** by the disabled-test finding. Measured after
   the fact: `root-shader-parameter.cpp` has **0** `#if 0` and **2 live** tests;
   `mutable-shader-object.cpp` **0** `#if 0` and **4 live**; #6524's four `link-time-constant*.cpp`
   likewise. The disabled-file finding was real and **did not reach any of those three.** I had even
   noticed the two `/*`-header false positives — and let the *conclusion* carry the implication anyway.
2. **#6664 dispatched with a split-module hypothesis.** Its two failing modules use plain **`import`**;
   `tests/serialization/` contains **zero** `implementing`/`__include` (non-zero control: 5 files
   contain `import`). Actual cause was unrelated — default `SessionDesc` + literal `"path"` in the
   `-dump-module` handler ⇒ cwd-relative resolution.

⇒ ⭐⭐⭐ **A finding earned by measurement in context A arrives in context B feeling like expertise
rather than a guess** — that is exactly why it skips the verification a fresh hypothesis would get. The
freshly-learned distinction is the *most* dangerous prior, not the safest, because its recent success
is what licenses skipping the check.

## How to apply

- **Crossing an issue boundary resets the evidence to zero.** Before reusing a distinction on a
  neighbouring issue, run the one-command check that would falsify it there
  (`grep -c 'implementing\|__include' <that dir>` with a non-zero control). Two seconds; it caught both.
- ⛔ **The caveat must be in the CONCLUSION, not only in the working.** I had the `/*`-header caveat
  correct in my notes and still shipped a conclusion that implied three blocked issues. **A qualifier
  upstream of a claim does not qualify the claim** — downstream readers quote conclusions.
- **When you dispatch a hypothesis, label its evidence.** Say "hypothesis, unverified — measure before
  building on it." I sent mine as framing, so the recipient had to *contradict me* to be right.
- ⭐ **Dispatch-time hypotheses cost the recipient more than they cost you.** The coworker had to spend
  its own turn refuting mine before doing the actual work, twice.

## ⭐⭐ What actually caught it: a subordinate that measured instead of inherited

Both errors were found by **slang-triager**, the coworker I dispatched — not by me re-reading my own
work. Its note on the second one is the right diagnosis:

> "Worth noting the shape of the error: it's the same 'carry a hypothesis from the previous chain' move
> that produced your #6578/#6524/#6572 implication."

⇒ **Contradicting the party that dispatched you is the expensive direction to be right in.** It did so
twice on substance plus once on a figure I had already published upstream. What made that cheap: I
re-derived every claim it sent me, including the ones contradicting me — so pushing back had a low
expected cost. **A dispatcher who verifies received claims buys honest pushback; one who relays them
buys agreement.** Cf. [[feedback_a_batch_census_needs_the_owner_column_not_the_reply_column]] (a
subordinate refusing to act on an unverifiable premise beat complying).

## How to report it

Say which claims were first-pass and which carry receipts. I told the operator plainly that **three of
my first-pass batch findings were wrong and all three were caught by the coworker, not by me** — that
is the information they need to weight my next cross-issue summary. Burying it would have made the
verified findings less trustworthy, not more.

Related: [[feedback_a_peer_correction_is_about_the_instrument]] (same chain, the instrument-vs-output
lesson), [[feedback_an_issue_body_is_a_frozen_pre_triage_snapshot]] (stale context inherited as
current).
