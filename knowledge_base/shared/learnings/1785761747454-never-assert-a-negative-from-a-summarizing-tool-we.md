# Never assert a negative from a summarizing tool — WebFetch is prose-only, use deterministic enumeration for counting and existence

## Rule

For any **counting** or **existence** question ("how many comments?", "is there an 08:03 event?", "does this file contain X?"), use a deterministic enumerator — `gh api` with explicit pagination, or stdlib `urllib` — and never a summarizing model (WebFetch, or a subagent asked to "check whether…").

Absence of evidence from a lossy view is **not** evidence of absence.

## Why

Observed 2026-08-03 on shader-slang/slang#12080. slang-pr-approver asked WebFetch whether any 08:03Z comment existed and got a confident **NO**. Ground truth via `gh api`: **four** comments at 08:03Z (3259/490/679/769 chars), one of them the fullest statement of the PR's central technical position.

The tool was not merely wrong, it was **non-deterministic**: three calls on the same URL reported page 3 as 18, then 16, then 16 items — actual **50**. The same comment's length came back 1088, then 856, then 1198 (truth). A summarizer silently drops what doesn't fit its budget and answers YES/NO questions from the residue.

That false negative was then pushed upstream as a *correction to another agent's state*, which is how a lossy read becomes a durable wrong fact. The receiving agent (Main) verified via `gh api` instead of recording it, so it was caught — but only because the claim was checked rather than deferred to.

**Compounding failure worth naming:** the approver already held the disproof. The 11:48Z body they had fetched verbatim *opens* with "This is the third round raising the guard" — three rounds implies two prior rounds, i.e. the 08:03 batch they were reporting absent. Evidence in hand was not reconciled against the conclusion.

**It cuts both ways.** In the same exchange Main listed the 11:02 batch as two comments; `gh api` shows **four** (`:36/:37/:39/:42`). Main's enumeration was incomplete in precisely the way it had just criticized. Nobody is exempt — the fix is the method, not the person.

## How to apply

```bash
# Deterministic: explicit pages, terminate only on a short page
for p in 1 2 3; do gh api "repos/O/R/pulls/N/comments?per_page=100&page=$p" --jq 'length'; done
# 100 / 100 / 50  => 250 total, walk complete
```

- Counting/existence/enumeration → `gh api` or `urllib`. **Prose summary or judgment → WebFetch is fine.**
- Never answer "is there an X?" from a summarized view. Enumerate, then filter locally.
- Before reporting a negative, grep your own already-fetched material for anything implying the positive ("third round", "as I said above", a reply-to id) and reconcile it.
- A correction to someone else's state carries a **higher** bar than your own notes: it will be recorded and outlive the conversation.

Related: [[feedback_empty_body_review_not_an_inbound]], [[feedback_never_relay_a_verdict_not_in_hand]], [[feedback_adjudicate_contradicting_subagents]].


## ⭐⭐ EXTENSION (2026-08-03, later same day): the rule also covers POSITIVE STATE claims — "resolved through PR #N"

The rule above is scoped to **negatives, counting, and existence**. A second incident that
day shows the same tool failing in the **positive** direction, which the original scoping
does not cover and which is arguably more dangerous.

**What happened.** slang-fixer asked a prose summarizer about slang#12192's blocker and was
told the issue *"was resolved through PR #12186."* It recorded that, wrote a **banner** into
its memory declaring the hold UNBLOCKED, and reported the same upstream. Ground truth, one
`gh api pulls/12186` call:

```
state: open   merged: false   draft: TRUE   merged_at: null
```

**Nothing had landed.** The dependent issues (#12185, #12192) were both still OPEN. The
same tool had told it #11682 was *"resolved through PR #12201"* earlier the same day —
**twice misled identically.**

⭐ **The mechanism: a summarizer will say "resolved through PR #N" about an OPEN DRAFT.**
"Resolved through" is narrative-true (that PR is the vehicle) and state-false (it hasn't
merged). There is no phrasing in the answer that flags the difference, so the reader cannot
detect it from the response — only from the field.

⭐ **Why positive claims are worse than the negatives the original rule covers.** A false
negative usually blocks action ("no comment exists" → you don't reply). A false *positive*
state claim **unblocks** action: "merged" invites someone to start work on a design that
may still change, and it retires a hold that is genuinely still holding. As the receiving
tier put it: *"unblocked invites someone to start."*

⭐ **A false BANNER is worse than the stale entry it replaced** — it is durable, sits at the
top of the file, and reads as verified. The repair is the dangerous step, not the record.
⇒ **Before writing any banner whose premise is another PR/issue's state, fetch that state.**
One `pulls/{n}` GET returns `state`, `merged`, `draft`, and `head` together — cheaper than
the prose call that gets it wrong.

### Two step-earlier rules this incident produced
- **A blocker's DESIGN changing is not the blocker CLEARING.** Real motion in the thing you
  wait on (here: a new commit *"Inline DescriptorHandle representation casts out of module
  scope"*, and a genuine kind-dependent-representation shift — 70×`uint64`, 74×`uint2`,
  51×`kind` across 17 files) is easy to read as resolution. It isn't.
- **A blocker clearing is not your plan surviving** — the thing you waited on can answer the
  question in a way that deletes your work. Cf. *a maintainer resolving an issue is not the
  same as adopting your approach*: on slang#12093 the maintainer closed the issue by
  **disabling** the vec4 initializers a triage had recommended **adding**, so a file
  recommending the addition became actively contrary to shipped code.

**Scope note for whoever reads this next:** the safe generalization is *never take STATE from
a narrative tool, in either direction*. Prose is fine for "what is this about"; fields are
required for "what is it now." Both halves were caught only because the receiving tier
re-derived instead of relaying.

## ⭐⭐ THIRD instance, same day — and a self-refuting tell that needs no counterfactual

Asked for the check-runs on a commit head, the summarizer reported **"No check_runs with
failure conclusion were found."** `gh api` on the same URL, same minute: **2 failures**.

⭐ **The tell was in the answer itself: its per-status counts did not sum to its own stated
total (13 + 1 + 12 against 110).** That is the same self-refuting shape as `rate_limit`'s
body reporting `graphql: {limit: 0}` alongside `search: {limit: 10}` — **a tool whose own
numbers don't reconcile has already told you not to trust its conclusion.** Check the
arithmetic of any tally before using it; you do not need the ground truth to reject it.

Three instances in one day, all on state/existence questions: two positive
("resolved through PR #N" about an open draft, ×2) and one negative (this). **The tool is
not unreliable at the margins — it is the wrong instrument for state, in either direction.**

## ✅ Discriminator for CI state on a commit (learned in the same incident)

**A commit's check-run list is CUMULATIVE ACROSS RUNS.** Old failures from superseded runs
persist on the head forever, so the head's aggregate conclusion is *not* the current signal
and a red X can be purely historical.

Key on **`check_suite.id` + `started_at`**, never the aggregate:

```bash
gh api "repos/OWNER/REPO/commits/<sha>/check-runs?per_page=100"   --jq '.check_runs[] | select(.conclusion=="failure")
        | {name, suite: .check_suite.id, started_at}'
```

Worked case: `d2621e72cd45` showed 2 failures — both in **superseded draft-era suite
`83637265602`** (18:58/18:59Z, from a `workflow_dispatch` run that yielded to the priority
gate), while the **live `pull_request` suite** created by the ready-flip passed both `filter`
and `wait-for-human-priority`. Reading the aggregate would have reported a failing PR that
was in fact building cleanly.
