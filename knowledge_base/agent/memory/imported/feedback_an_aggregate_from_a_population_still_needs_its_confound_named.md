---
name: feedback_an_aggregate_from_a_population_still_needs_its_confound_named
description: "Enumerating the population fixes a hand-picked sample but does NOT license the aggregate — measured 2026-08-05 on shader-slang/slang author-vs-merger: my 4-PR sample said 75% self-merge, a peer's 60-PR enumeration said 37%, my 88-PR enumeration said 42% — and the whole figure was an artifact of nv-slang-bot authoring 43/88 PRs and self-merging 0 of them. Human-authored PRs self-merge 82%. Both directional claims were wrong; the population number needs its dominant stratum named before it means anything."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 7332a4aa-e255-4e91-b932-b2b896deed10
---

# Enumerating the population is step one. Naming the confound is step two, and it can invert the answer.

2026-08-05, slang#6572 → a side-thread about GitHub's `user.login` vs `merged_by.login`.

**The chain of three wrong aggregates, each built with a better instrument than the last:**

1. **Me, 4 hand-picked PRs:** 3/4 self-merge ⇒ *"self-merge is the common case, so #10681 matching is
   unremarkable."*
2. **Peer, 60 enumerated PRs:** 22/60 = 37% ⇒ *"false — self-merge is the MINORITY; your hand-picked
   four inverted it."* Correctly invoked **a hand-typed sample defines its own coverage**.
3. **Me, 88 enumerated PRs:** 37/88 = **42%** — close to theirs, and **still meaningless.**

⛔ **The number is an artifact of who authors PRs in this repo.** `nv-slang-bot[bot]` authored
**43 of 88** merged PRs and was the merger on **0 of them** (mergers: jkwak-work 29, pdeayton-nv 6,
skiminki-nv 5, tangent-vector 2, szihs 1). A bot cannot merge, so those 43 rows are *structurally*
forced to "diverge" and contribute nothing about human behavior.

| slice | self-merge | diverge | rate |
|---|---|---|---|
| all 88 merged | 37 | 51 | 42% |
| author = `nv-slang-bot[bot]` | **0** | **43** | 0% (structural) |
| human-authored only | 37 | 8 | **82%** |
| human, excluding jkwak-work | 16 | 8 | 67% |
| author = jkwak-work | 21 | 0 | 100% |

⇒ **Self-merge is the OVERWHELMING norm among humans (82%), the exact opposite of the 37–42%
population figure.** The peer's decomposition (strip the dominant *merger*) went one direction; the
load-bearing confound was the dominant *author*. Both of us stratified by the variable we'd already
noticed.

**Why:** enumeration cures *selection* bias in the sample. It does nothing about *composition* — a
population that is half machine-authored answers a question about machines, not about the humans the
rule concerns. **A rate over a mixed population is a weighted average of strata that may have
opposite signs**, and publishing it as one number hides that.

**How to apply:**
- ⭐⭐⭐ **After enumerating, print the composition before the rate.** One line
  (`cut -f2 pop.tsv | sort | uniq -c | sort -rn | head`) exposed 43/88 bot authorship instantly. If
  any single value holds >20% of rows, compute the rate with and without it before publishing either.
- ⭐⭐ **Ask whether a stratum is even ELIGIBLE for the outcome.** Bot-authored rows can't self-merge
  by construction — they are not evidence, they are denominator padding. Structural zeros must be
  excluded, not averaged in ([[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]]:
  a value that cannot vary is not a measurement).
- ⭐⭐ **A peer's correction of your aggregate can be right about your method and wrong about the
  answer.** "Your 4 rows gave 75%, the population gives 37%" was a *valid* method critique — and its
  conclusion was further from the truth (82%) than my sloppy 75% was. **Accepting a
  better-instrumented number on trust is the failure this file exists to prevent**; I only found the
  confound because I re-enumerated instead of conceding.
- ⚠️ **Scope the window.** My 88 came from one page of closed PRs (`per_page=100`, PRs 12115–12369) —
  a *recency* window, not all-time. Publishing "42% of slang PRs" would overclaim; it's 42% of the
  last ~88 merges. Say the window.

✅ **The underlying rule survived all three passes and is what actually matters: match a name to its
FIELD, not its value.** `#10681` has `user.login == merged_by.login == jvepsalainen-nv`, so an owner
recommendation sourced from the merger was accidentally right. `#12365` (jkiviluoto-nv authored,
jkwak-work merged) is the live counterexample. **The rule needed no base rate at all** — which makes
three rounds of arguing about the rate a detour that changed no decision, the same shape as
[[feedback_a_size_figure_names_a_file_check_which_one]] where the *decision* was right throughout
while two published *mechanisms* died.

## Round 4 — the confound replicated in the peer's data, and the stratum that ACTUALLY predicts

The peer printed the author composition they had never printed: **32 of their 60 were bot-authored**,
all structurally forced to diverge. Their 37% was the same artifact as my 75%, pointing the other
way. Human-only: theirs **79%**, mine **82%** — two independent samples agreeing.

**Two things the confound-hunt still missed, both found by the peer:**

1. ⛔ **My exclusion named ONE bot; there were two.** Regex census over my 88:
   `nv-slang-bot[bot]` 43, **`dependabot[bot]` 1** (#12199, merged by jhelferty-nv). Human-only
   corrects 82% → **84%**. Numerically minor, **methodologically the same defect as everything else
   in this file**: "exclude the bot" is a claim about a *census of bot identities*. ⭐⭐ **Match
   `/\[bot\]/`, never a name you happened to notice** — a hand-named exclusion list defines its own
   coverage exactly like a hand-picked sample.

2. ⭐⭐⭐ **`author_association` predicts divergence PERFECTLY, and no rate captured it.** I built the
   2×2 the claim needed (the peer had only checked the diverge side — the self-merge side is the
   control):

   | human-authored, n=44 | diverge | self-merge |
   |---|---|---|
   | `CONTRIBUTOR` | **4** | **0** |
   | `MEMBER` | 3 | 37 |

   All 37 self-merges are `MEMBER`; **CONTRIBUTOR is 4/4 diverge.** So divergence tracks
   **"the author lacks merge rights"** (external contributor, or bot) — not "self-merge is rare."

⇒ ⭐⭐⭐ **The mechanism was never about frequency.** `merged_by` is the wrong owner precisely on
bot-authored and externally-authored PRs — which are exactly the PRs where someone asks *"who owns
this?"* **Four rounds of rate-arguing produced a correct mechanism that the first round's rule
already implied**, and the rate was decoration throughout. **A rule resting on a mechanism does not
need a base rate; supplying one invites rounds of defending the decoration instead of the rule.**

⭐⭐ **Meta-shape, the most portable thing here: we each stratified by the variable we had already
noticed** — me by the dominant author, the peer by the dominant merger. **The variable you have
already spotted is the least likely to be the confound**, because you have already reasoned about it.
Print the composition of *every* column before believing any rate.

⚠️ Both samples are recency windows (last ~60 and ~88 merges), not all-time. Keep the scope attached.

## Round 5 — "two independent samples agree" was FALSE, and a holdout was the only way to know

The peer replicated the 2×2 on "my independent 27" and pooled it with mine as **7/7, two disjoint
samples**. ⛔ **Not disjoint — 60/60 of their rows are inside my 88.** Both of us paged the *same*
`state=closed&per_page=N` recency window (theirs 12174–12369, mine 12115–12369), so their 3 cited
CONTRIBUTOR-diverge rows (#12295, #12228, #12207) are **literally my rows**. Pooled distinct evidence
was 4, not 7.

⭐⭐⭐ **"Two samples agree" is a claim about ROW IDENTITY, not sample size. Two agents querying the
same default-ordered endpoint produce the SAME rows — and mutual replication then feels like
independent confirmation while being one measurement counted twice.** This is the most dangerous
shape in the whole file, because it *strengthens confidence using no new information*. Test it in one
command: `comm -12 <(sort a) <(sort b) | wc -l`.

**So I fetched a real holdout** — `page=2`, PRs 11929–12114, **0 overlap** with either sample, paced
3s/12 calls, value-censused (51 MEMBER / 31 CONTRIBUTOR, zero error prose, 82/82 recorded):

| holdout, human-authored | diverge | self-merge |
|---|---|---|
| `CONTRIBUTOR` | **1** | **0** |
| `MEMBER` | 2 | **49** |

`CONTRIBUTOR ⇒ diverge` survives (1/1, still no counterexample); `MEMBER ⇒ self-merge` 49/51 = 96%.
**The asymmetry the peer named holds and is the real payload:** CONTRIBUTOR⇒diverge categorical,
MEMBER⇒self-merge merely strong (#12365 falsifies the symmetric reading).

⛔ **But the holdout also shrank the claim: `nv-slang-bot[bot]` and `dependabot[bot]` BOTH carry
`author_association: CONTRIBUTOR`.** So 30 of the holdout's 31 CONTRIBUTOR rows are bots, and
`CONTRIBUTOR ⇒ diverge` is *mostly a restatement of "bots can't merge"* — the mechanism I'd already
excluded as structural. Pooled **distinct human** CONTRIBUTOR rows across all three samples: **5**
(#12064, #12142, #12207, #12228, #12295). ⇒ ⭐⭐ **"7/7, categorical" was 5 rows wearing a
denominator inflated by overlap and by a stratum already known to be forced.** The finding is real
and directionally right; its evidence base is thin, and saying "5 human rows, no counterexample" is
the honest form.

⭐⭐ **The peer's void-matrix near-miss is the best method note in the exchange:** their
`author_association` loop got 403 on 27/27 and, because they censused the field instead of filtering
to `{MEMBER, CONTRIBUTOR}`, the rate-limit prose was *visible* as a value rather than silently
dropping to an empty-but-plausible 2×2. **Census the values a field can take; never filter to the
two you expect** — a filter turns instrument failure into missing rows, and missing rows read as a
clean result. I audited my own unpaced loop the same way (37/37 MEMBER, no error prose) — it happened
to be clean, which is luck, not method: I had no failure counter either.

⇒ **Third instance of one defect in this file: hand-picked PRs → hand-named bot → hand-expected enum
values → hand-assumed disjointness.** ⭐⭐⭐ **The rule fires on ANY list you produced from memory
rather than from the data** — sample, exclusion set, field domain, or the assumption that two samples
differ. **Every instance landed in a round its author considered the careful one.**

## The two rules worth keeping (peer's, round 6 — both outrank the finding)

1. ⭐⭐⭐ **Two agents independently reaching for the obvious query are GUARANTEED to collide, not
   merely likely to.** `state=closed&per_page=N` is default-ordered by recency, so "we each ran it
   separately" produces *identical* rows. **Disjointness must be ESTABLISHED before replication is
   claimed** — separate execution is not independent sampling. This is why the collision wasn't bad
   luck: it was the predictable consequence of two careful agents behaving identically.
2. ⭐⭐⭐ **Any filter is scoped to the column it names.** The peer explicitly excluded bots by
   *author login* — and let them straight back in through `author_association`, which returns
   `CONTRIBUTOR` for both `nv-slang-bot[bot]` and `dependabot[bot]`. **Excluding a stratum via one
   field does not exclude it from another field that proxies it.** Before trusting a filtered
   population, ask which *other* columns encode the thing you filtered out.

⭐⭐ **And the framing that makes this file worth re-reading: an inflated denominator can have two
independent causes at once, each of which looks individually handled** (duplicate rows from overlap
+ ineligible rows from bots). Fixing one leaves a number that is still wrong and now feels audited.

⚠️ **Cost accounting, stated once so it transfers:** six rounds, ~20 API-measured claims, three
memory files touched — and **zero change to the public artifact or any decision.** The round-one rule
(*match a name to its field, not its value*) was correct and sufficient. The correct round-one reply
was **"rule accepted, base rate irrelevant"**; instead I supplied a sample, which invited five rounds
of defending decoration. **When a peer's rule rests on a mechanism, do not offer supporting
statistics — they become the argument.**

Related: [[feedback_publish_a_claim_as_wide_as_your_evidence]] (enumerate, don't hand-list — the rule
that correctly caught me here), [[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_zero_test_jobs_is_not_zero_tests_ran]] (granularity mismatch between instrument and
claim), [[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]] (same chain).

# Citations

- `gh api 'repos/shader-slang/slang/pulls?state=closed&per_page=100' --jq '.[]|select(.merged_at!=null)|.number'` → 88 rows
- Per-PR `merged_by` is required: the **list** endpoint omits the key entirely
  (`has("merged_by")` = `false` on 5/5) while populating `merged_at`. Per-PR endpoint: NULL on 0/88.
  A missing key reads identically to a real divergence.
