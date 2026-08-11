---
name: feedback_refuting_specifics_while_inheriting_vocabulary
description: "A memo titled 'the issue's root cause was WRONG' inherited the word 'phantom' from that same discredited framing and shipped it as the correction — sound receipts, over-broad conclusion. Test named claims with the one command."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 459ba2b5-8eb9-4397-8c52-1aaf0ac14a83
---

# Refuting a claim's specifics while keeping its vocabulary is not a refutation

**2026-08-11, shader-slang/slang#12062.** Two of my memos carried a false mechanism for a
board-sync 422. One of them is *titled* **"the issue's own stated root cause was WRONG"** — and
then, in the very next bullet, stated the corrected cause as *"a server-side **phantom**
requested reviewer (removed/renamed bot App whose node id no longer resolves)."*

**`phantom` came from the discredited framing.** The issue title said stale/phantom node. The
triager demolished the *specifics* with real receipts — and kept the *word*. I stored it. It sat
there ~2 weeks and came within about one approval of landing in `pr-board-sync.yml` as a code
comment, i.e. durable wrong documentation in the one place a future reader trusts.

**Falsified by one command:**

```
gh api graphql -f query='{node(id:"BOT_kgDOCnlnWA"){__typename ... on Bot {login databaseId}}}'
→ {"__typename":"Bot","login":"copilot-pull-request-reviewer","databaseId":175728472}
```

Live Bot. Not phantom, not stale, not removed, not renamed. Real mechanism: **GitHub resolves a
*Bot* node sitting in the PR's review-request set *as a User*** — which is what
`Could not resolve to User node` literally says. The error text was accurate the whole time;
the memo was the unreliable narrator.

## The structural trap

⭐⭐⭐ **The receipts were sound and the conclusion was still over-broad.**
`grep` / `git log -S BOT_kgDOCnlnWA` → EMPTY genuinely proves *"no hard-coded id in the YAML."*
That is a **different proposition** from *"the id does not resolve."* One is about our repo, the
other about GitHub's server state — and no amount of grepping our repo can reach the second.
Nothing in the evidence was wrong; the leap between the two propositions was never noticed
because the inherited word already supplied the answer.

⇒ This is why "I refuted that" feels like immunity and isn't. A refutation licenses confidence
in the *replacement*, which typically gets less scrutiny than the thing refuted.

## Rules

1. **A node id, error string, flag name, or API code named in a memo or code comment is a
   FALSIFIABLE CLAIM with a one-command test.** Run it before storing, and again before citing.
   Cheap: one `gh api graphql`, one `--help`, one grep of *their* surface not ours.
2. **When you refute a claim, diff your replacement's VOCABULARY against the original's.** A word
   carried across is a premise you did not re-derive. Ask: which observation of mine independently
   produced this word? If none — it is inherited, not concluded.
3. **State which proposition your evidence reaches.** "Absent from our repo" ≠ "does not exist
   server-side." Write the scope next to the receipt.
4. **A wrong *why* in source is worse than a wrong commit message** — history vs documentation.
   Weight comment-claim verification accordingly; DRY makes it worse, because consolidating
   rationale to one site concentrates a false mechanism at the single point of trust.

## Credit and the second-order miss

Caught by **slang-fixer** (re-derived instead of re-asserting), re-verified by **slang-reviewer**,
who logged their own half as *"Reviewing a comment's style is not verifying its factual claim"* —
they had graded the comment on sibling idiom / why-not-what / placement and never resolved the id.
**Neither catch was mine.** I held the false mechanism in two memos and only went looking because
the reviewer flagged an unrelated stale *hash*. ⇒ **A peer's correction about artifact X is the
trigger to audit everything else you stored in that chain** — the flagged item is rarely the only
one, and the audit I ran found a mechanism error strictly worse than the hash drift I was asked about.

Related: [[feedback_a_stored_claim_re_shipped_as_a_live_finding]],
[[feedback_voiding_evidence_returns_to_unknown_not_to_the_prior_claim]],
[[project_12062_board_sync_422_maintainer_blocked]].
