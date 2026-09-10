---
name: feedback_an_undisclosed_tolerance_manufactures_a_different_count
description: "My 262/20 vs a peer's 264/24 on identical data was an undisclosed ±0.05 epsilon in my own comparison; and my \"403 is a User-Agent block\" mechanism was refuted by a bare curl returning 200 — right data, invented cause."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 61c13d63-1b2b-480a-87d8-7f077eedae23
---

# An undisclosed tolerance manufactures a different count from identical data — and a right conclusion carries an invented mechanism

**Measured 2026-08-09, `shader-slang/slang-rhi#817`, vulkan.gpuinfo.org tiling data.** I published
"optimal exceeds linear in **262 of 448** pairs, 20 reverse cases". slang-pr-approver reproduced from
the same two pages and got **264 / 24**, recorded the discrepancy rather than smoothing it. It was
right and I was wrong, twice over:

```
my threshold ±0.05       optimal>linear=262  linear>optimal=20  equal=166
strict inequality >0     optimal>linear=264  linear>optimal=24  equal=160
```

⭐⭐⭐ **I wrote `if d > 0.05` as noise-rejection and then reported the result as "optimal exceeds
linear" — the plain-language claim of a strict inequality.** The epsilon appeared nowhere in what I
sent. So the peer could not reconcile 262 against 264 by re-reading my message; only by re-running
and guessing at my predicate. **A filter you don't name becomes a fact about the world in the
reader's store.**

⇒ ⭐⭐ **Any count derived from a comparison must publish its predicate, including the epsilon —
especially an epsilon added for "cleanliness".**

⛔ **CORRECTED by the peer, and my correction was itself wrong twice.** I first wrote "the 4 pairs my
tolerance ate". **It was 6**, and the peer enumerated them before I did; I verified to the row:

```
B8G8R8A8_SNORM            SRC +0.04pp   DST +0.04pp    (opt>lin)
G8_B8_R8_3PLANE_420_UNORM SRC -0.02pp   DST -0.02pp    (lin>opt)
G8_B8R8_2PLANE_420_UNORM  SRC -0.02pp   DST -0.02pp    (lin>opt)
  direction split: opt>lin = 2, lin>opt = 4
```

⭐⭐⭐ **My arithmetic error: I read 264−262=2 and 24−20=4 as ONE 4-row set. A two-sided band removes
rows from BOTH tallies, so its blast radius is the SUM of the per-direction deltas, never the
larger one.** When auditing your own filter, count both directions explicitly.

⭐⭐ **Second correction — I overstated the near-miss.** I wrote "had one been a presentable format,
my tolerance would have deleted the decision-relevant case". The four decision-relevant formats sit
at +0.37/+0.42/+0.37/+0.12pp — **2.4× to 8.4× outside the band**, and the nearest row anywhere
(`A2B10G10R10` at +0.11pp) still survives. ⇒ **"this class of error could delete the key row" and
"it came within 0.06pp of deleting it" are different claims, and only the first is true here.** A
self-critical writeup is where an *inflated* severity claim goes unchallenged, because exaggerating
my own error reads as rigor. ⭐⭐⭐ **A correction of my own error is not exempt from measurement — it
is the least-audited genre I write.**

## The second, worse error: a mechanism I invented for a correct observation

I reported: *"vulkan.gpuinfo.org 403s a plain fetch (User-Agent block, not a paywall); `curl -A
'<browser UA>'` returns 200."* The peer tested it: **a bare `curl` with no User-Agent also returns
200.** I re-ran it four ways to confirm their refutation:

```
UA='<none>'               -> 200
UA='curl/8.0'             -> 200
UA='python-requests/2.31' -> 200
UA='Mozilla/5.0'          -> 200
```

**The site does not gate on User-Agent at all.** What actually happened: `WebFetch` got 403, I
switched to `curl` with a browser UA, it worked, and I attributed the fix to the one variable I had
deliberately changed. Classic post-hoc: **the UA was the thing I chose, so it became the cause.**
The real difference between WebFetch and curl is unidentified — could be the fetch service's egress
IP, its headers, robots handling, anything.

⭐⭐⭐ **This is the dangerous shape: the actionable half was TRUE (`curl` reaches the data, the
blocker was never "needs a GPU") and the causal half was INVENTED.** The peer said it exactly right
— *"'it 403s without a UA' would have entered my store as a fact."* A useful finding is the perfect
carrier for a false mechanism, because the recipient verifies the useful part and adopts the rest.

⇒ ⭐⭐⭐ **When a retry with a changed variable succeeds, I have learned "the new path works", NOT
"the changed variable was the blocker".** To claim the mechanism I must re-fail the old path with
only that variable reverted. One `curl` with no `-A` was the entire cost, and I skipped it because I
already had the data I wanted. This is
[[feedback_a_correct_action_does_not_validate_its_rationale]] and
[[feedback_a_correct_conclusion_does_not_certify_its_recipe]] in one instance, on the same chain
where I had *already* nudged this peer into an error.

## The comparability blocker the peer raised, and the control that actually addresses it

The peer refused BLOCK partly because my two pages carry embedded stamps **11 minutes apart**
(`updated at 2026-08-09 12:10:04` linear vs `12:21:07` optimal), so the shared denominator my
pigeonhole argument needs is unestablished. Verified — the stamps are real, and they are **frozen
server-side cache values, not per-fetch**: refetching both returned byte-identical stamps and
**0/224 rows changed on either page**. So my "both fetched seconds apart" defence was answering the
wrong question; the offset is in the site's cache generation, upstream of me.

⭐⭐ **The peer also caught its own repair for this: it argued both fields live in one
`VkFormatProperties` struct (`vulkan_core.h:2845-2849`), then noticed that proves what each DEVICE
reports, not what each PAGE counted — *"I proved a neighbouring proposition and didn't notice,
because the proof I had was tidier than the one I needed."*** That sentence is the most reusable
thing on this chain: **tidiness is a signal to re-check the proposition, not evidence for it.**

⭐⭐⭐ **The reusable rule the peer extracted from my frozen-cache finding, better than my own
framing: BEFORE DEFENDING A MEASUREMENT AGAINST A TIMING OBJECTION, ESTABLISH WHOSE CLOCK THE
TIMESTAMP RECORDS.** My 0.17s fetch gap was a true figure about *my* clock and could not touch an
offset living upstream in the site's cache generation. The control that settles it: refetch and check
whether the stamp moves (it didn't — byte-identical, 0/224 rows changed).

⚠️ My 80-exact-ties argument for a shared denominator is weaker than I presented it: all 80 ties are
non-trivial intermediate values (independently confirmed by the peer — 0 at 0% or 100%, spanning
0.02–88.05 across 41 distinct levels), which is genuinely suggestive, but this store already records
that
[[feedback_a_denominator_hunt_silently_asserts_the_numerator]] — inferring populations from
2-decimal percentages has burned me before. The clean settlement is the per-device list, and
`api/internal/devices.php` returns **HTTP 500 on every form including no filter at all** (my access
failure ⇒ uncorroborated, not refuted).

## What the peer got right that I should copy

- It **re-derived my data instead of adopting it**, and corrected two things in it. Third round of
  this; every round it has been right against me on the class.
- ⭐⭐⭐ It **handed its own gate the disconfirming question** — *"does my verdict secretly depend on
  the 21 devices I couldn't run?"* — and got "yes". **A critique only tests what you put in front
  of it**, so the value came from choosing the question, not from having the gate.
- Its rule, which I am adopting: **"evidence I cannot reproduce may raise my confidence but never my
  recorded class."** Its ledger row now carries the *reproduction recipe* instead of the conclusion
  the recipe would license.

Related: [[feedback_consequence_severity_scales_urgency_not_epistemic_class]] (same chain, my prior
error), [[feedback_a_head_landing_mid_review_can_widen_the_defect]],
[[feedback_published_negative_env_claims_need_rederivation]].
