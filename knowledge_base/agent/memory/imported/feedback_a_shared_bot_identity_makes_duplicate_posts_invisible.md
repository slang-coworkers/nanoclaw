---
name: feedback_a_shared_bot_identity_makes_duplicate_posts_invisible
description: "A fan-out to N sibling sessions under ONE bot identity can double-post on the same issue, and GitHub cannot tell you which session wrote which comment. Count OUR comments per issue (author + created_at > dispatch) across the WHOLE batch, not per-chain; and never treat a reply census as stable — it drains while you read it, so a zero is 'not yet', not 'dropped'."
metadata:
  node_type: memory
  type: feedback
  originSessionId: shared-identity-duplicate-post
---

# A shared bot identity turns a fan-out into an unattributable double-post risk

2026-08-05, slang. A human (`jkiviluoto-nv`) fanned a departure-scrub request across **23 issues** in
~25 seconds after an engineer went away. Each webhook minted its own triager session. Every session
posts as **`nv-slang-bot[bot]`** — one identity, ~21 concurrent writers.

**Measured outcome:** #10181 received **two** scrub comments **10 seconds apart** with **different
bodies** (`5196891201`, 5002 B, 20:19:39Z; `5196892695`, 3036 B, 20:19:49Z) — two sessions,
independent verdicts, same public identity. A full scan of the batch found it was the **only** double.

## Why this is invisible by default

- ⛔ **The author field cannot attribute the write.** Both comments say `nv-slang-bot[bot]`. Neither I
  nor the triager can tell from GitHub which sibling produced which. This is the same trap as
  [[feedback_zero_test_jobs_is_not_zero_tests_ran]]'s second error — *a comment's author does not
  identify the session that wrote it*.
- ⛔ **Per-chain hygiene cannot see it.** Each session checked "have *I* posted?" and correctly got
  *no*. The defect only exists at the **batch** level: N sessions × 1 identity × 1 issue.
- ⚠️ **Two different bodies is worse than two identical ones** — a maintainer lands on one issue with
  two differing verdicts and has to reconcile them. Redundancy is noise; disagreement is damage.

## The census is a measurement with a timestamp — it drains while you read it

⭐⭐⭐ **A reply census over an in-flight fan-out is NOT a stable set.** Measured across three reads
minutes apart: #7209 flipped **0 → 1**, and #10181 went **0 → 2**. Seven issues still read zero at the
third read with 21 triager containers still running.

⇒ **A zero means "not yet", not "dropped."** Handing a "these N got no reply" list to anyone as
licence to re-post manufactures exactly the duplicate above. This is
[[feedback_genuine_redelivery_drops_the_rerun_not_undelivered_work]]'s third case seen from the
orchestrator side: check the artifact **immediately before** posting, never from a list.

## Instrument traps hit on this one task (all false, all caught by controls)

- ⛔ **`test("bot")` matched `github-actions[bot]`** ⇒ inflated the reply count on #7672 *and* missed
  #6518's real reply. **Wrong in both directions at once.** Fix: match the login exactly
  (`.user.login=="nv-slang-bot[bot]"`) **and** gate on `created_at > <dispatch time>`.
- ⛔ **Enumerating by `assignee:` defined its own coverage: 19 vs the true 23.** The batch is defined
  by *the comment*, not by who was assigned — 4 issues were unassigned or assigned to someone else
  (`#7209` none, `#9872` kaizhangNV, `#8527`/`#9004` none). ⭐ **A hand-plausible filter that
  correlates with the real set is the dangerous kind** — it returns a full-looking list.
- ⛔ **An apostrophe in a search phrase returned a FALSE ZERO** (`"won't be returning to this work"`
  ⇒ `total_count: 0`). Caught only because a control phrase without the apostrophe
  (`"scrub this issue"`) returned **23**. ⭐ **Quote-mangled queries fail silently at exit 0.**
- ✅ **A 422 can be a BETTER control than a 0:** `assignee:zzqqnotauser` returned
  *"Validation Failed — users do not exist"* rather than silently dropping the filter, which
  **proves the filter was applied**. An error that names the rejected term is stronger evidence than
  a clean zero.
- ⚠️ **`ncl sessions list` is column-shifted** when `messaging_group_id` is empty — `awk` on `$NF`
  offsets silently mis-reads. Print whole rows and `grep -c` a literal group id instead
  ([[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]).

## Closing census, and the enumeration was slightly wrong in the OTHER direction too

Final validated sweep: **22 of 23 answered**, `PROBE-FAILED: none`, two multi-comment issues
(#10181, #6578). The one "still silent" — **#4126** — is a **false positive of my own enumeration**:
closed 2024-08-26, and its `"scrub this issue"` hit came from `bmillsNV` writing *"Need to do another
scrub of issues in Q2"* in **2024**, not from the departure notice. So the real batch is **22**.

⭐⭐ **A phrase-match enumeration is a heuristic, not a set definition.** Searching the comment text
fixed the `assignee:` under-count (19 → 23) but introduced an over-count, because the phrase is
ordinary English that predates the event by two years (`bmillsNV`, 2024-05-09: *"Need to do another
**scrub of issues** in Q2"*). **Bound a batch by phrase AND time** (`created_at > <fan-out start>`),
and eyeball any member whose state contradicts the batch's premise — a *closed 2024* issue in a
*today's departure* batch was visible on its face.

⭐⭐⭐ **The generalizable form (peer's sharpening, stronger than "use two filters"): a single
filter's count is UNFALSIFIABLE FROM INSIDE ITSELF; two disagreeing filters LOCALIZE the error.**
Neither aperture was wrong — they were wrong in **opposite directions** (19 under, 23 over), and only
the **diff** exposed both. Decisive here because **a false positive on a closed issue is
byte-identical to a genuinely silent one** in a reply census: both read "0 replies." Nothing inside
either filter could have caught #4126; the discrepancy was the only instrument that could.

## How to apply

- ⭐⭐⭐ **On any fan-out under a shared identity, run a batch-level duplicate scan before anything
  else:** enumerate the set *from its defining artifact*, then for each item count comments matching
  `author == <our bot> && created_at > <dispatch>`; flag every count `> 1`.
- ⭐⭐ **Route the cleanup to the tier that owns the state**, and say plainly that two *differing*
  verdicts are the real problem. Don't edit another tier's artifact, and don't guess which sibling
  wrote which comment.
- ⭐ **Watch the deliverable, not the workers.** The only non-circular signal is the public comment
  count; container status and `last_active` cannot distinguish "working" from "stalled"
  ([[feedback_last_active_tracks_inbound_not_agent_work]]).
- ⭐ **Don't retry into a saturated fleet.** 21 concurrent containers and 429s in the sampled siblings
  mean a redrive adds load to the resource that is already the bottleneck
  ([[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]]).

## ⭐⭐⭐ "Right conclusion, adjacent reason" — the pattern that showed up FOUR times in one batch

The most repeated failure here was not a wrong answer. It was a **correct action justified by a fact
that wasn't the deciding one** — which survives review, because the outcome is right and nobody
audits the reason.

| actor | correct action | stated reason | actual deciding fact |
|---|---|---|---|
| triager | refuse to delete on #10181 | "a session is still writing" (liveness) | **mutual blindness + diverged verdicts**; the growth was the reconciliation *completing* |
| triager | "the crash cannot be tested" | reasoned from a single-module compile | **the second command was never run** — and the memo already named it |
| me | withhold redrive on silent issues | fleet saturation | **the census was still draining** — a zero meant "not yet" |
| me | "#9736 is different in kind" | wrong assignee (`kaizhangNV` is #9872's) | it *is* different — **it carries a prior bot verdict** |

⇒ **When an action turns out right, audit the REASON separately.** A right-for-the-wrong-reason call
will be re-applied where the stated reason holds and the real one doesn't. Two operable checks, both
cheap:

⛔ **A message asserting TWO repairs needs TWO verifications — and the one you didn't flag to
yourself is the one that goes unchecked.** Measured immediately after the table above: I reported
"heading corrected **and** the cheap 'cannot be X' check recorded." The heading repair was real
(verified by **position, not count** — the over-general string at **0 occurrences**, removed outright
rather than struck through, so a skimming reader can't lift it out of context). The second claim was
**false** — 0 hits for the check in that file. The peer caught it only because they verified the claim
I *hadn't* drawn attention to; verifying just the flagged item would have missed it. Same shape as a
caveat attached to the wrong claim: **both halves of a compound "done" are separate claims, and
prominence in my own sentence is what determines which gets audited.** ⭐ Also: a reusable rule buried
inside a topic-specific note is effectively unfindable — the peer republished it as its own learning,
which is where a general check belongs.
- ⭐⭐ **Before writing any "cannot be X," grep your own draft for a sentence describing the step you
  didn't take** (peer's rule, from the #6578 retraction). Their memo contained *"a single-module
  compile never reaches the linker where 'already defined' fires"* — a **retrieval** failure, not a
  knowledge gap, which is the class no additional rule fixes.
- ⭐ **State the discriminator, not the salient signal.** Liveness was *visible*; verdict-divergence
  was *decisive*. Ask which fact would flip the decision if it changed.

## ⭐⭐⭐ NEW TRIGGER (2026-08-05, #7209/#12367): a TIMEOUT on one chain licenses a sweep of the others

This note's trigger was a **fan-out dispatch**. A second, cheaper trigger exists: an
`API Error: The operation timed out.` on **any one** chain
([[feedback_a_timeout_and_a_429_are_different_evidence_about_the_work]] — a timeout cuts a *running*
turn, so work may be half-published, unlike a 429 which rejects before work).

**Measured:** I ran the duplicate check on the chain the timeout arrived on (#7209 — clean, 1 bot
comment) and stopped, because *my* chain was fine. A peer ran the same rule against the **population**
and found the other timeout (#12367, 5h25m earlier) carrying **3 bot comments — two 6 minutes apart**:
a published false correction plus its retraction. ⇒ ⛔ **Checking the chain the signal arrived on is not
the sweep. The signal names a failure MODE, not the affected chain** — one session's timeout is evidence
that timeouts are landing, and every chain that ever timed out is a duplicate-post candidate.

⭐⭐ **A per-chain check structurally CANNOT see this** — "have *I* posted?" answers *no* in each session
independently, correctly, forever. Only a batch-level count of bot-authored comments per artifact can.
That requires knowing **which** chains to look at, so the population enumeration is the load-bearing
step, not the count.

### ⛔ I RAN the sweep — and ">1 bot comment" is the WRONG predicate

First execution of this rule at scale (88 distinct issue threads from one day, both repos):

| predicate | hits / 88 | verdict |
|---|---|---|
| `>1 bot comment` | **35** | ⛔ useless — 40% flag rate; #11709 has **46** comments over a month (a healthy long chain) |
| `>1` **and** gap `<20 min` | 23 | still mostly false — nearly all are self-corrections |
| tight gap **and** neither references the other | **1** (#10181) | ✅ the actual double-post |

⭐⭐⭐ **The signature is INDEPENDENCE + a tight gap, not multiplicity.** A legitimate iterating session
*names* its predecessor ("Correction to my previous comment", "Adding to the scrub above",
"Withdrawing one paragraph of"); a true double-post cannot, because neither session knows the other
exists. ⇒ ⛔ **A sweep that cries wolf 35 times will not be run twice** — treat an exculpatory token
match as clearing the pair.

⛔ **BUT: bind the reference to POST TIME, not to a scan window.** My first cut grepped the first ~300
chars, which separated the two known cases — **by luck of aperture**, as a peer showed and I confirmed:

| comment | head-300 | whole body |
|---|---|---|
| #10181 `5196891201` | 0 → flagged | **1 → exculpated** (ref at byte **4943** of 6406, 16× past the window) |
| #10181 `5196892695` | 0 | 0 |

So **head-300 catches the true double only because the window is too small to see a reconciliation
that does exist**, while whole-body exculpates it and misses the sole real double-post in 88 threads.
Right on both cases at exactly one tuning, neither tuning principled — the tautological-control shape:
it passes, and not for the reason claimed.

✅ **The robust discriminator is WHEN the reference existed, not WHERE.** Verified:

```
#10181  5196891201  created 20:19:39  updated 20:22:58   ⇒ EDITED after both posts
#10181  5196892695  created 20:19:49  updated 20:25:49   ⇒ EDITED after both posts
#12367  5197123260  created == updated                   ⇒ reference present AT POST TIME
#12367  5197180868  created == updated                   ⇒ reference present AT POST TIME
```

#10181's cross-reference arrived **by edit, after both posts** — a *repair* of a double-post, which is
why neither body carried it when posted. ⇒ **Predicate: tight gap, and neither comment referenced the
other AS ORIGINALLY POSTED (`created == updated`, or the reference present pre-edit).**
Aperture-independent, and it encodes the actual insight — a session that doesn't know its sibling
exists *cannot* reference it — instead of proxying it by scan depth. ⭐ Corollary: **#10181 was already
self-repaired before my sweep found it**, so "found a double-post" ≠ "found an unhandled one".

### ⛔ …and my first sweep returned a CONFIDENT FALSE ZERO

Run 1 printed `swept 88 threads; 0 with >1 bot comment`. All 88 probes had **failed**: `sed -E`'s
alternation `(slang|slangpy)` isn't valid in the BRE that plain `sed 's|…|…|'` uses, so every repo
extraction died and the per-thread error was drowned by the summary line. **The zero read as a clean
bill of health for the whole fleet.** Run 2 with a working extractor found 35.

✅ **Fix that caught it: a POSITIVE CONTROL as the sweep's first action** — probe #12367, assert ≥2 bot
comments, `exit 1` if not. *"control OK ⇒ zeros below are real"* is the line that makes a zero
publishable. Same lesson as the whole evening in a different costume: the summary line is written by
me, the control is written by the world.

⭐⭐ **Peer's refinement, adopted: the control must be DISCRIMINATING, not merely present.** A
known-dirty issue asserting ≥2 bot comments proves the sweep can *count* — it proves nothing about the
**exculpatory regex**. That needs its own must-match cell, or a broken regex silently exculpates
everything and the sweep reports a clean fleet: the BRE failure one layer up, wearing a passing control.
⇒ Every *filter* in a sweep needs a cell it must match, not just every *probe*.

### ⚠️ `--limit` on `ncl sessions list`: 421 vs 2297 was SCOPE, not a cap

The peer measured `--limit 2000` → **421** and `5000` → **421** (no cap). I measured `2000` → **2000**
and `5000` → **2297**, all ids distinct. Both correct — different populations:

| scope | visible sessions |
|---|---|
| peer (`cli_scope: group`, slang-triager) | **421** — its own group, complete |
| me (`cli_scope: global`) | **2297** across **19** agent groups |

`--agent-group-id ag-1780667166418-apezq5` returns exactly **421**, confirming it. ⇒ ⭐⭐ **"How many
sessions exist" is scope-relative; two agents can disagree on a population count with neither
mismeasuring.** My "still a page cap" held on my instrument (2000 → exactly 2000 is a clipped page);
their "not a cap" held on theirs (421 < limit). ⛔ **Before reconciling a count with a peer, compare
`cli_scope` — otherwise you debug a phantom instrument bug.** Cf.
[[feedback_broader_read_access_is_not_higher_authority]].

⚠️ Enumerate the population, don't sample it: `ncl sessions list` **defaults to a 200-row head window**
(`--limit 50/200/1000/2000` → 50/200/1000/2000 rows; a nonexistent-group control returns 0, so the
filter is real). My "0 of 10 siblings timed out ⇒ chain-specific" was false *because of that default* —
there were 2 in the day's 32 sessions. Same head-window family as
[[feedback_ncl_sessions_messages_limit_returns_first_n_not_last_n]].

Related: [[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]] (the delivery half — this
is the *reply* half), [[feedback_a_batch_census_needs_the_owner_column_not_the_reply_column]] (measure
OWNER-absence, never reply-absence), [[feedback_publish_a_claim_as_wide_as_your_evidence]],
[[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]],
[[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]],
[[feedback_a_shape_dependent_figure_migrates_between_sibling_shaders]] (what the #12367 sweep found).
