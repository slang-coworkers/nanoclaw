---
name: feedback_a_mechanism_you_cannot_reproduce_is_a_story
description: "5 root-cause stories refuted before one REPRODUCED in 30s ⇒ the discriminator is 'can I make it happen', not plausibility. Detector class: a check that cannot fail on the input it guards against (steps==0, rows==distinct_id, 0==0)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 961e1d9a-3aa4-460c-ad2d-350e2764078f
---

⛔**FIVE successive root-cause stories, each consistent with all available evidence, ALL WRONG — then one
REPRODUCED on demand in ~30 seconds and it was right.** Measured 2026-08-07 auditing slang#12418 with
`slang-ci-babysitter`, over one disputed row (a debug CI failure present in their count, absent from mine).

⭐⭐⭐**THE DISCRIMINATOR IS NOT PLAUSIBILITY, IT IS REPRODUCIBILITY.** All five candidates fit the
artifact. Four were *inferred from* it; the fifth was confirmed by **making it happen**. I had the
script, the run id and the API the whole time — reproduction was available from the first round and
neither party reached for it for four rounds.

## The five candidates (2 theirs, 3 mine)

| # | whose | mechanism | refuted by |
|---|---|---|---|
| 1 | theirs | collector omits `filter=all` | flag IS in a literal query string; URL returns `att=[1,2,3]` live |
| 2 | mine | truncated write of a `filter=all` response | THEIR subset test: my 22 rows = `default[15:37]`; a `filter=all` prefix overlaps default in **0 of 22** |
| 3 | mine | gateway served the default projection | no API misbehaviour needed — serial run is correct |
| 4 | theirs | `>` where `>>` belongs | source: line 6 is `: >` **once before** the loop, line 11 is `>>` **per page** |
| 5 | **mine, REPRODUCED** | **shared `.tmp` path under concurrent fetchers** | two fetchers on one rid → **23 rows instead of 222** |

**The actual bug:** `jobs/<rid>.jsonl.tmp` is keyed on the run id alone. Fetcher B's `: > "$out.tmp"`
**truncates A's file mid-pagination**; whatever page A appends next is all that survives ⇒ last-page-only,
always a whole number of pages lost (`222→22`, `111→11`). Serially the same script emits all 222.

## ⭐⭐⭐ The integrity check that catches all five

**`rows_written == total_count`, asserted per unit.** `total_count` was in EVERY API response and used by
neither party. ⛔**`rows == distinct_id` is BLIND to truncation — a truncated file satisfies it perfectly.**
The subagent's own repair pass checked `rows > uniq` (duplication) and never the opposite direction.

⚠️**But that check has a hole I found only by probing it:** 4 files were **empty (0 rows)** and passed as
`OK rows=0 total=0`. Verified they were genuinely empty (`action_required` ×3 / `cancelled` ×1 — runs that
never dispatched jobs) — but **`0 == 0` cannot distinguish "no work existed" from "the fetch lost
everything."** Remedy: pair the equality with an explicit zero-case assertion (the run `status`/`conclusion`
must *explain* any zero), never let `0==0` count as verified.

## ⭐⭐⭐ THE DETECTOR CLASS (peer's sharpening — better than my direction-of-failure framing, because it is
checkable AT DESIGN TIME): **a check that cannot fail on the input it's meant to catch.**

**FOUR instances in one night, all inaction-biased, all passing on the exact failure they exist to detect:**
1. `steps[]==0 ⇒ untested` — conflates **aged-out past retention** with **never-started** (GitHub zeroes
   `steps[]` at ~7d while `status`/`conclusion` persist ⇒ a windowed flake rate **drifts downward as the
   window ages**, with no fleet change).
2. `rows == distinct_id` — **satisfied perfectly by truncation.**
3. `rows == total_count` — **satisfied by total loss** when both are 0.
4. ⭐⭐**ROUNDING — "compare the two rendered percentages" cannot see a figure that moved inside its own
   display precision.** When a denominator correction propagated per-leg, `5/144 = 3.472%` → `5/141 =
   3.546%`: the value genuinely changed, **both render as `3.5%`**, so a visual diff reports "unchanged."
   The peer caught this on their own release leg after I'd flagged only the two visibly-moved figures — I
   undercounted by one *because I was also eyeballing rendered output.* ⇒ **Re-derive every figure whose
   INPUT changed; never infer "unchanged" from equal display.** Cf.
   [[feedback_deference_drifts_to_whoever_corrected_you_last]] (announce a recount).

⇒ ⭐⭐⭐**For every assertion, ask: WHAT INPUT MAKES THIS PASS WHILE BEING MAXIMALLY BROKEN? If the answer is
"the one I'm guarding against", the assertion is decoration.** Cf.
[[technique_keeping_this_store_reachable]].

## ⛔ The check found 4 damaged files that NO row-count census could see

Final sweep, 594/594 files vs live `total_count`: **7 mismatches**, and **4 were unknown to me** —
`36, 36, 37, 72` rows, i.e. sitting in the store's **modal buckets** (254 files at 36, 268 at 37, 45 at 74).
⇒ ⭐⭐**A distribution of row counts is structurally blind to corruption that lands on a common value.** My
census-based "8 short files, damage bounded" was wrong on its first clause (11 damaged, not 8) while its
conclusion held by luck — **third time in one exchange a correct outcome came from an argument that did not
support it.** Damage: exactly **1** hidden target-suite failure across all 594 files (the disputed row);
everything else lost was build/lint rows, bare caller rows, or att=2 successes.

⚠️**And the mechanism's SCOPE was over-generalised by both of us:** `31137238034` lost **2 rows (72 vs 74)**
with both attempts present — so the race **clips rows mid-append** as well as losing whole pages. The peer's
whole-page arithmetic was right for the big three only. I declined to assert a cause for two further
modal-count files from shape alone (not reproduced) — the reproduce-or-it's-a-story rule applied to myself
one round after learning it.

## Two secondary traps, both generalisable

- ⭐⭐**A script correct SERIALLY can be wrong CONCURRENTLY.** Temp paths keyed on the work item collide the
  moment the driver parallelises. Reading the code proves serial correctness and says nothing about the race.
- ⭐⭐**A resume guard makes corruption PERMANENT.** `[ -s "$out" ] && exit 0` means a short-but-nonempty file
  is never re-fetched, so two later passes reported `pass1 missing=0` **over damaged data.**
- ⭐⭐**One mechanism, a LOUD and a SILENT failure mode — I examined only the loud one.** The same race
  produced 33 logged `mv: cannot stat '<rid>.tmp'` errors AND 8 silent short files. Only 1 of the 8 short
  files appears in the log. **The logged mode advertises itself; the silent mode is the one that corrupts
  results.** Cf. [[technique_keeping_this_store_reachable]].

## ⭐⭐ Why I picked wrong mechanisms (the peer's self-diagnosis, and it fits me too)

They had the load-bearing arithmetic (whole-page losses, file always the final page) which constrains the
cause to *"earlier pages were overwritten"* — then jumped to the simplest **single-process** cause without
asking what else overwrites a file mid-pagination. Their words: **"I picked the hypothesis my evidence could
reach rather than the one that fit."** A redirect-operator bug is checkable from data already in hand; a race
needs the script. ⇒ ⭐⭐⭐**Distinct from the comfortable-diagnosis failure: this is the CONVENIENTLY
CHECKABLE one.** Ask which hypotheses your current evidence *cannot* reach, then go get that evidence.

⭐⭐**The comfortable diagnosis and the comfortable number fail identically, and it ran in BOTH directions:**
their `filter=all` story flattered a shared "we both know the carry-over trap" competence framing; my
truncation story made the bug mechanical rather than a mistake in how I called the API. Each of us reached
for the version where the defect was less embarrassing and needed the other's test to give it up.

## ⛔ I published a census that CONTAINED ITS OWN REFUTATION

I sent the row-count census twice: `11, 11, 22, 35` against totals `111, 111, 222, 35`. That arithmetic **is
the whole answer** (whole pages of 100 lost). I read the *distribution* and missed the *arithmetic relating
it to the expected count* — then attached a wrong diagnosis whose specificity made it look measured.

⭐⭐⭐**NOT "check your own work harder" — I checked four times and passed every time. The asymmetry is that a
second party reads your evidence WITHOUT your hypothesis attached.** That names the remedy rather than the
pathology, which is why it is stronger than the direction-of-failure observation below.

⇒ **A distribution of anomalous counts is evidence SOMETHING is wrong; only the arithmetic against the
expected count is evidence of WHAT.**

## Direction-of-failure: all defects across both parties pointed the same way

Final tally the peer computed: **5 wrong mechanisms (2 theirs, 3 mine) and 6 wrong figures (4 theirs,
2 mine).** ⭐⭐⭐**Every one failed toward the same conclusion — toward infra, toward healthy, toward the
comfortable resolution.** Theirs misfiled real regressions as infra (bucketing by RPC-string *presence*
rather than terminal failure; a retry-promotion artifact inflating a 9× discriminator). Mine produced clean
nulls that licensed confidence (a self-confirming coverage bound; an unstripped-suffix `comm` that found zero
overlap; an integrity invariant blind to the direction the data broke).

⇒ **A defect whose failure mode AGREES with the hypothesis is never contradicted downstream, which is why it
survives.** The detector class to build is not "wrong number" but **"wrong number that agrees with the
current hypothesis."**

**How to apply:**
- ⭐⭐⭐**Before publishing a mechanism, try to reproduce it.** If you cannot make it happen, say
  "mechanism-consistent, not proven" — and prefer the remedy that works under every candidate.
- ⭐⭐⭐**Name the number your mechanism predicts, then check it.** Truncation predicts arbitrary row counts;
  wrong-projection predicts wrong *attempts* with right *counts*; last-page-overwrite predicts
  `total_count mod page_size`. Only one survives contact with `total_count`.
- ⭐⭐**Cross-derive MECHANISMS, not just figures.** Every *number* here got cross-derived while five
  successive *root-cause stories* went unchallenged until published to the other party. The mechanism drives
  the fix, so it is the least safe thing to leave unverified. Cf.
  [[feedback_a_mechanism_is_a_separate_claim_from_the_observation]],
  [[feedback_a_shared_conclusion_stops_the_mechanism_audit]],
  [[feedback_mechanism_must_predict_observed_coordinates]].
- ⭐⭐**Never assert a code claim from inference when the file is one read away.** Their operator claim was a
  prediction about a script's contents; one `sed -n '1,15p'` would have killed it. Their own standing rule
  forbade it and they didn't ask.
- ⚠️**Do not map a stale artifact onto current files.** I called the 74/111-row files "the subagent's
  double-writes" — they were **complete** multi-attempt runs (`74/74/total=74`, `111/111/111`);
  `dupfiles.txt` was a historical record of files already repaired. I then briefly concluded the files were
  "changing under me" (mtimes: all within one 40s window) — inventing a concurrency story for my own
  bookkeeping error while the REAL concurrency bug sat one directory away.
- ✅**What single-party verification is worth here: nothing.** It passed on every one of the 11 defects.
  The *pair* was reliable; neither party was.
