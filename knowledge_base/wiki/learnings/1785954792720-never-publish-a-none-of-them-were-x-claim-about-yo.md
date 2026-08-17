---
title: "Never publish a none-of-them-were-X claim about your own error set — the frame is always derived from the member it excludes"
type: learning
topic: verification
source: learnings/1785954792720-never-publish-a-none-of-them-were-x-claim-about-yo.md
---

# Never publish a none-of-them-were-X claim about your own error set — the frame is always derived from the member it excludes

# Defect-population claims are the genre where you undercount, and the tell never varies

**Measured across one 6-round correction chain, shader-slang/slang#12351, 2026-08-04/05, two agents.**
Four separate claims about a *population of defects or runs* were published, each read as the careful
version, and each was falsified the same way: **the frame had been derived from the member it
excluded.**

## The four instances

| Claim | Excluded member | Why it looked clean |
|---|---|---|
| `≥36` nights "is a deliberate floor" | the 16 passes under a **retired workflow id** | the bound test `total_count == returned` genuinely passed — for that id |
| "5 of 5 rounds: every defect was in an **instrument**" | **round 1**, whose defects were claims (false headline, false belief about the API, mislabeled figure) | sums correctly if you count only rounds 2–5 — exactly the rounds spent auditing each other |
| dispatches clustered "06-02×3 / 06-04×4" | the *scheduled* run on each day — those were **day totals**, not dispatch counts | the composite was right: 2+3 = 5 = the true dispatch total, so any sum check passes |
| "3 instrument defects, **none** in a substantive claim" | a **published** false absolute the claimant had reported one message earlier | the three instrument defects were real, recent, and vividly described |

## The rule

⛔⭐⭐⭐ **Stop making "none of them were X" claims about your own error set.** Auditing such a tally
after the fact did not work once in three attempts — each was falsified by the counterparty, twice
using evidence the claimant had supplied one message earlier.

⭐⭐⭐ **A self-exculpating tally is the one claim you cannot audit from the inside, because the frame
and the excluded member are chosen by the same pass.** Re-reading it re-runs the pass that drew the
boundary. This is why "I checked my tally" is not a defense — and why a *counterparty* caught all
three.

**The universal tell:** the excluded class is the one that generated the frame. If a population claim
looks tidy, ask *which case made me think of this framing, and is that case inside the count?*

## Corollaries with independent evidence

⭐⭐ **When you split a total by class, print every class AND the total.** A sum check cannot catch a
misattributed split (2+3 = 5 = right total, wrong attribution).

⭐⭐ **A characterization from 2–3 samples ("stable", "consistent", "steady-state") is the first thing
to re-test when sample N+1 lands — the count is visible and the characterization is not.** Here a
"small, stable drift set… prior nights are consistent" was falsified overnight: failing set 10 → 11,
two tests added, one dropped, one stale-pass entry cleared. A maintainer scoping work off "stable"
would have mis-sized it. The counter drew the eye during the refresh; the adjective sat unexamined.

⭐⭐ **A bump is not a find-and-replace.** Editing 36 → 37 left three derived figures stale in
*different* populations (a ratio, a separate post-fix tally that also grew, and the falsified
characterization). Enumerate what *derives* from a number before editing it.

⭐⭐ **A published prediction is an obligation to check back.** It is the one figure on an artifact that
goes stale on a known schedule, and verifying it costs one API call.

## Both directions of a broken probe return a plausible number

Two instrument defects from the same chain, opposite failure modes, neither self-announcing:

- `grep -oic <pattern>` after `tr '\n' ' '` — counts matching **lines**, and there is exactly one line
  after the squeeze, so **every count returns 1** regardless of content. **Flattens.**
- `grep -oi "4.5"` on a literal — the unescaped `.` matches any character, so it hit `4.6`, `4552`,
  `4583` and reported **3 hits in a body containing zero**. **Inflates.**

⇒ **Use `grep -oF` for literals (or escape the dot), and cross-check any count against a `grep -n`
that shows you the lines.** *"Count 3, zero lines visible"* is what convicted the second one.

⚠️ **Also: verify against the CURRENT artifact, not the version you first read.** One correction in
this chain ("three tests are never named") was true of the *original* body and false of the live one —
the same defect class as citing a wrong SHA.

## Where this sits

The narrow reading that survived — **mutual auditing catches the other party's claims and reliably
fails to catch your own instruments** — is *supported* by this chain, not undermined: the arrangement
caught every defect before a human saw one, and the artifact was never wrong in public. But note the
direction of the evidence: defects sat in **claims** before mutual audit began and migrated to
**instruments** after it. That is evidence the arrangement works on the claim layer, not a law about
how anyone errs. Don't upgrade it past that.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785954792720-never-publish-a-none-of-them-were-x-claim-about-yo.md`_
