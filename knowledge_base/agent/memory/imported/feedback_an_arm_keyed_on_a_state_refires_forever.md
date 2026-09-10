---
name: feedback_an_arm_keyed_on_a_state_refires_forever
description: "My gate arm 'an open PR exists from that branch' stays TRUE for the PR's whole life, so it re-dispatched a completed review every 6h. Key gate arms on the TRANSITION, or pin the value already acted on (REVIEWED_SHA). Also: a filter's silence never distinguishes 'nothing happened' from 'I excluded it'."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dd6c5348-62db-4101-8b01-d603c9d1d751
---

# An arm keyed on a STATE re-fires forever; only a TRANSITION is an event

**Instance (gate `i12440-fix-pr-gate-8e14`, 2026-08-11).** The arm that fired read:

```bash
elif [ -n "$fixbrprs" ]; then wake=true; reason="pr_from_fixer_branch:${fixbrprs}"
```

`fixbrprs` = open PRs whose head ref is `fix/issue-12440`. That predicate went true when the fixer
opened #12464 and **stays true until the PR merges or closes** — days, possibly weeks. The arm's
instruction was *"dispatch slang-triager to review the diff"*. So the gate would re-dispatch a
review that had already completed, once every 6 h, indefinitely, each fire looking exactly like a
fresh event.

⇒ ⭐⭐⭐**"X exists" is a state; "X came into existence" is an event. A gate arm written as the
former reports the event on every fire for the rest of the state's life.** The wake data even
carried the answer — `fix_prs: "12464"` was identical to the previous fire — but nothing compared
fires.

## The two shapes that fix it

1. **Key on the transition:** `pr_MERGED` / `pr_CLOSED` / `human_review:<login>:<STATE>` /
   `pr_back_to_draft` — each is a change, not a standing condition.
2. **Pin what you already acted on** when the interesting thing is *movement* of a state:

```bash
REVIEWED_SHA=c5ff51285a64        # head the completed review covered
elif [ "${prhead:0:12}" != "$REVIEWED_SHA" ]; then wake=true; reason="pr_head_moved:${prhead:0:9}"
```

Now the PR's continued existence is silent and only new commits wake it. The pin is the cheap
general form: **compare against the value your last action consumed, not against emptiness.**

Also re-key the silence arm when the waiting party changes. The old one measured hours since *our
verdict comment* and would have nudged the fixer — which had already delivered. Re-keyed to hours
since the PR became ready-for-review, and renamed `no_human_review_<N>h_ESCALATE_OPERATOR`, because
the party that can act is a human maintainer. ⇒ ⭐⭐**A silence arm names a tier. When the work moves
tiers, the arm is pointing at the wrong one and will nudge someone who is done.**

## ⭐⭐⭐ And the replacement's clean reading was wrong TWICE — the must-hit found both

The new arms depend on *"is there a human review/comment?"*. My first filter excluded automation by
testing the author login for `bot`. It returned `wakeAgent:false`. Both defects were invisible in
that `false`:

1. **`jhelferty-nv`** — a human-named account — posts `pr-board-sync` notices whose body says *"do
   not reply to this comment"*. The name test admitted it, so the gate woke on automation as a
   human. ⇒ **automation is a property of the BODY, not the account name.**
2. Running the filter **forward** until it produced a non-empty result surfaced **`coderabbitai`**,
   then **`CLAassistant`** — review bots whose logins contain no `bot` substring, each of which
   would have woken the gate as a maintainer verdict.

The control only terminated on a real person (`jvepsalainen-nv`, a substantive SHA correction on
#12448) after both exclusions were added.

⇒ ✅**For any "no X yet" gate, run the filter FORWARD to a true positive before trusting its
silence.** An over-broad exclusion and a genuinely quiet target are byte-identical in the negative
reading. Testing only that it returns `false` on the target proves nothing about whether it *can*
return true. Same family as
[[feedback_a_control_returning_zero_is_unproven_until_a_must_hit_fires]] and
[[feedback_a_negation_arm_reads_a_failed_probe_as_the_event]] (the earlier defect on this very
gate — a bare negation over a failed probe).

## Second instance (2026-08-30, slang#12411) — a peer's gate, same defect, caught before it fired

A triager armed a Sept-5 gate to post **one** gentle follow-up to a silent maintainer:
`today ≥ Sept 5 AND zero reviews AND zero inline comments AND no jkwak comment after Aug 22 11:52Z`,
cancelling on a returned review or a jkwak reply. ⛔ **Its own follow-up comment satisfies no cancel
condition** — not a review, not a jkwak comment — so all conjuncts stay TRUE after posting, and every
12h supervisor sweep re-posts, until the maintainer independently replies. Exactly "never two pings"
defeated by the gate not recording its own firing, aimed at a human maintainer (worse: noise from a
bot account).

⭐⭐⭐ **Live re-verification does NOT save this**, and that is the counter-intuitive core: the
conditions genuinely *are* still true on sweep N+1, so re-checking them confirms "should post." **Only
a record of having fired distinguishes "should post" from "already posted."** Re-verify handles
genuine cancels (a review/reply arrived); the latch handles "I already did it." You need **both**, not
either.

✅ **Fix (adopted by the peer): a self-latch as a fourth conjunct** — `AND followup_posted is UNSET →
post once, THEN write followup_posted:<ISO-ts>` to the durable memo. The flag survives compaction and
the sweep reads it, so it stops the re-fire even if both silence conjuncts stay true for weeks. This
is the general shape of the [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] /
ANCHOR F family: **a one-shot whose trigger its own execution does not falsify MUST carry a durable
spent-state flag.** Same cure as this leaf's REVIEWED_SHA pin — pin what you acted on, or the arm
re-reads a still-true state as a fresh event.

Chain: [[project_12440_getstringhash_nonliteral_crash]], [[project_12411_coopvec_bfloat16]]
