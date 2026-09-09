---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787567759437-1wt3j2
written_at: 2026-08-26T15:39:52.080Z
---

# [approver/human-disagreement] Clean-code abstain grounded only in a self-declared "not for merge" label is a fragile, false-abstain-leaning signal — the merge can flip it with zero code delta

## The case
shader-slang/slang#12577 ("Bindless coverage buffer array"). I recorded ABSTAIN_POLICY /
CHALLENGER_CONCERN three times across three heads (b0c67097969d → 549fda3bd836 → 1f42b751d512),
each time with the SAME rationale: "not a code objection — the code is clean (0 bugs across
production claude-code-action + Devin + CodeRabbit; challenger probe passes; ABI append-safe), but
the PR body self-declares 'Prototype, not for merge as it stands' and defers a carrier
design-direction question to #12541, which I am not positioned to decide."

Then, within ~3h of my last (rev3) abstain, the PR MERGED at head 1f42b751d512 — **my exact rev3
decided head, byte-identical, no new commit**. Timeline: 12:47Z my rev3 ABSTAIN → 13:09Z human
maintainer jkiviluoto-nv APPROVED → author edited the body to REMOVE the "not for merge" line →
15:36Z merged by the author.

## Honest scoring (both readings, per the memory rule against rounding up)
- Falsifiable reading my store prescribes = "material enough not to merge as-is." Under THAT
  reading this abstain is **REFUTED**: the code merged as-is, unchanged, after a clean human
  approval at my exact head. Recorded here as a false-abstain-LEANING human-disagreement — I
  withheld an approval signal on code that was in fact approved and merged untouched.
- The reading that partly rescues it: my abstain's reason was procedural, not code-materiality —
  approving a PR whose OWN body says "not for merge, pending #12541" would have been unsound, and
  a maintainer design call was genuinely outstanding. "A human must look" was satisfied: a human
  looked, approved, and the author retracted the label. So the abstain wasn't a code miss.
- Do NOT let the second reading cancel the first. Net: this is a human-disagreement data point
  that leans false-abstain, not a "confirmed correct" win.

## The transferable signal (sharpen Step-0 recall)
When code is clean on every reviewer axis and the ONLY thing blocking WOULD_APPROVE is an AUTHOR'S
self-declared "prototype / not for merge / WIP" label + a deferred design question:
1. That is the most FRAGILE kind of abstain. It carries no code content; it can flip to
   APPROVE-equivalent the instant the author retracts the label and a maintainer signs off — with
   ZERO code delta. Expect exactly that outcome and don't treat the eventual merge as vindication.
2. The commit-SHA join is clean (same head) yet the disposition flipped entirely via NON-code
   events: a PR-body edit (invisible to a SHA join — a body edit moves no head) + a human
   approval. When joining a merge whose head == my decided head, check the body/reviews diff, not
   just the code diff, to explain a disposition flip.
3. It is still correct to abstain rather than WOULD_APPROVE while the not-for-merge label stands
   (you cannot approve what the author says isn't ready, and a design-direction call isn't yours).
   But log it as the readiness/process abstain it is, distinct from an OPEN_GAP code abstain — and
   expect the human outcome to be APPROVE-equivalent. Repeated identical abstains across revisions
   that only fix nits (as here, 3x) are a tell that the blocker is a label, not the code.
