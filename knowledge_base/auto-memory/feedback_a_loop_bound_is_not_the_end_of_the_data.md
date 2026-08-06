---
name: feedback_a_loop_bound_is_not_the_end_of_the_data
description: "A paginating census that stops at `p <= N` reports a FLOOR as a population — my loop ended at page 25 by its own bound while pages 24/25/26 all still returned 100 rows. Then the uncapped retry exhausted the GitHub installation rate limit (403) and CONTAMINATED the output file with error bodies. Publish 'at least X, enumeration incomplete', and bound a census by TIME not page count."
metadata:
  node_type: memory
  type: feedback
  originSessionId: dd84c1af-a185-41f7-91e7-efd943d575af
---

# A loop bound is not the end of the data

**Measured 2026-08-05.** Auditing 🤖-disclaimer compliance across `nv-slang-bot[bot]` comments, I
paginated `issues/comments` and stopped at `while [ $p -le 25 ]`. I then reported **770 bot comments,
25 gaps** as if that were the population. It wasn't: pages **24, 25, and 26 all still returned 100
rows**. The loop hit **its own ceiling**, not the end of the data.

⭐⭐⭐ **A `for p in 1..N` / `while p <= N` census reports a FLOOR and formats it like a total.** This
is the pagination-cap family ([[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]: a row
count equal to `--limit` plus a constant IS a page) but nastier, because the tell is *absent* — there
is no round number in the output to notice. The only way to see it is to **ask the page after the one
you stopped on**. ⇒ **Every paginating loop must terminate on a SHORT PAGE and say so; if it exits on
the counter, publish "at least X (enumeration incomplete)".**

## ⛔ The uncapped retry cost more than the wrong number

Re-running with `p <= 200` **exhausted the GitHub App installation's rate limit** — dozens of
`403 API rate limit exceeded for installation ID 122982130` — and then:

1. **The 403 JSON bodies were appended into the output file** (`grep -c 'rate limit'` → 42 rows).
   A census file that *looks* like data and contains error text. **Discarded it** rather than filter
   it, because I could no longer say which rows were real.
2. `[: {"message": ... }: integer expression expected` — the `$t` guard received a JSON blob instead
   of a count, so **the loop's own termination check was silently disabled** by the failure it was
   meant to survive.
3. **The limit is shared per installation** — ⭐ **confirmed by the triager's edge and mine reporting
   the SAME `X-Ratelimit-Reset` second (21:36:05Z) off one counter** (theirs `used=118` at ~20:36,
   mine `used=160` minutes later; a single monotonic count, not two windows). So the 403s were real
   and cross-chain — but see the correction below for what the *terminal* symptom actually was.

⛔⭐⭐⭐ **I MISATTRIBUTED MY OWN TERMINAL SYMPTOM, AND TOLD THE OPERATOR SO.** I reported
`gh api rate_limit` → `401 app_not_connected` as the *aftermath of exhaustion*. The triager refused to
diagnose my edge and instead named the ambiguity: that 401 is the **proxy's** shape, not GitHub's 403,
and its body carries **zero numeric fields** — so it cannot be evidence about a quota. Measured with a
per-path control **while the bucket was healthy (5840/6000 remaining)**:

| path | result |
|---|---|
| `rate_limit` | **401 app_not_connected** ← always, quota-independent |
| `repos/shader-slang/slang` | 200 OK |
| `repos/.../issues/8373/comments` | 200 OK |
| `repos/torvalds/linux` | `Bad credentials` ← no gateway rule for that repo |

⇒ **`/rate_limit` is simply NOT ROUTED by the OneCLI gateway on my edge. It 401s always.** It had
nothing to do with the exhaustion; I ran it *because* of the 403s and read its unrelated failure as
their consequence. ⭐⭐⭐ **A diagnostic endpoint that is broken by configuration will confirm whatever
crisis you invoke it during** — and I passed that fabricated causal chain upstream. **Establish an
instrument's baseline BEFORE using it as evidence, especially one reached for only in emergencies.**
⇒ **Read quota from `X-Ratelimit-*` headers on a real request (`--include`), never from `/rate_limit`.**

⚠️ **A second defect in the same check:** my first per-path classifier piped bodies through
`head -c 90`, which **truncated before the `error` field**, so every row fell through to "OK" —
including the 401. **A classifier that inspects a truncated payload silently reports the default
case.** Caught only because `rate_limit` showing OK contradicted the 401 I had just seen.

⇒ ⭐⭐⭐ **The fix for "my bound was too small" is NOT a bigger bound.** Bound a census by the thing
you actually care about (a **time window** — `created_at >= T`), stop on a short page, and treat a
shared API budget as a resource you can exhaust for your peers. Same shape as
[[feedback_a_repeated_turn_error_is_a_fleet_signal_not_a_chain_signal]]: **the retry that feels like
diligence is the one that does the damage** — and that was the *same session*, hours apart, which is
how little a filed rule protects you when the retry feels justified.

⭐⭐ **Guard rule: a numeric guard fed from a network call must be validated before use.**
`t=$(gh api … --jq 'length')` returns *prose* on failure. Check `[[ "$t" =~ ^[0-9]+$ ]]` or the loop
runs unbounded on the first error.

## What survived, and how it was verified

The **page-1 census is sound and independently corroborated.** Triager reported 44 bot comments in a
~15h window (05:41Z→20:26Z), 40 compliant, 4 not. My independent enumeration: **44 rows, OK=40,
GAP=4, identical window** — two separately-run censuses agreeing, ⭐ **which is worth more than either
alone precisely because neither hand-picked the set** (their earlier "5/5" was five hand-chosen
comments, which they retracted themselves).

The 770-row figure and its 25 gaps are **valid as a floor**: every row well-formed (`NF!=4` → 0), gaps
spanning **22 distinct issues**, 5 in June / 14 in July / 6 in August, newest `5196877252` at
**20:18:08Z** — created *after* my 20:15 append, i.e. **the defect is live, not a backlog.**
Compliance over the enumerated span: 96.8%.

⭐⭐ **The triager's self-retraction is the model here:** it withdrew its own per-group inference
("you 5/5 vs #12338 0/3 ⇒ composer defect") on discovering two gaps on issues *its own group* was
handling — and said plainly that it **cannot attribute the author session**, since siblings and
subagents post under the same identity with no outbound row. **Observed artifact, unknown
author-session.** It preferred the weaker true claim to the stronger convenient one, and named why it
missed it: *the number flattered its own group.* ⇒ **Guards aimed at blame don't fire on credit.**

Related: [[project_8373_std430_cbuffer_parser_gate]],
[[feedback_a_rule_absent_from_your_spine_still_binds_the_artifact]],
[[feedback_publish_a_claim_as_wide_as_your_evidence]].
