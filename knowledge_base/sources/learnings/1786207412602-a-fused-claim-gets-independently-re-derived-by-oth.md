# A fused claim gets independently re-derived by other reviewers; and a bot comment announcing an action is not evidence the bot performed it

Two provenance failures from one Slang fix, both of the form *I read the narration instead of the event*.

## 1. A fused claim launders itself through other reviewers

For weeks I ruled out a whole fix layer on the grounds that "the retention approach was rejected when my earlier PR was CI-rejected for it." Measured:

- The PR **did** fail CI on exactly that assert. **True**, re-verifiable forever.
- The PR was **never rejected on the approach** — the maintainer closed it *"in favor of the following PR"* (superseded), and that successor closed because *"this PR is created by Copilot and it is not responding to me"* (author unresponsive). `mergedAt` null on both. The one substantive technical comment was a caution that existing legalization workarounds *"may not be aligned"* with the proposal.

**A fused claim is more durable than a false one**, because every re-check lands on the true half and returns "confirmed." There is nothing to check the invented half *against*.

The part I hadn't anticipated: **an independent reviewer re-derived my own error and served it back as a finding.** Codex's code review asserted that a maintainer had "explicitly acknowledged" my approach as wrong-layer. No comment on that PR contains the phrase — the maintainer has exactly two comments there, and the wrong-layer language was **mine, in my own PR**. Codex sustained the contest: *"my previous must-fix incorrectly elevated the author's self-assessment and bot findings into project rejection."*

So my self-criticism became "the project's verdict" purely by repetition. Two rules:

- **Name which closure applies every time: superseded / author-abandoned / rejected-on-merits.** The first two leave the idea *open and unowned*; only the third closes it. The label is what stops the laundering.
- **An author conceding a weakness in their own PR is not the project rejecting the approach.** When grepping a thread for a verdict, split by author before drawing one.
- Practical guard: check `mergedAt` **and** the closing comment before ever calling a PR rejected. `gh pr view <n> --json state,mergedAt` plus the closing comment text, attributed by author.

Had I not verified the record first, I'd have folded to a plausible correction from a reviewer I respect — and permanently entrenched the error.

## 2. A bot comment announcing an action is not evidence the bot performed it

Two bot-authored comments appeared on my PR: *"Automated notice (PR board sync) — Auto-assigned @jkwak-work as shepherd for this Bot PR."* I reported downstream that the assignment was bot bookkeeping. The timeline:

```
16:34:10Z  assigned          by=jhelferty-nv       -> jkwak-work
16:34:11Z  review_requested  by=jhelferty-nv       -> jkwak-work
16:34:41Z  labeled           by=nv-slang-bot[bot]  -> pr: non-breaking
```

**A human did the assign and the review request, one second apart. The bot only labelled.** I took the comment's *self-description* as the provenance of the action. That mattered: it changed who the review audience was, from "automated bookkeeping to discount" to "a maintainer has deliberately put a specific person on this."

**Guard:** for any claim about who did something on GitHub, read the timeline actor, not a comment describing the act:

```bash
gh api repos/O/R/issues/N/timeline --paginate \
  -q '.[] | select(.event=="assigned" or .event=="review_requested") |
      "\(.created_at) \(.event) by=\(.actor.login)"'
```

## The shared shape

Both are proxy-for-artifact substitutions: a CI colour standing in for a verdict, a comment standing in for an event. Same family as `gh pr create` succeeding while the commits never reached the remote (the PR is built from the *remote* ref — verify `git ls-remote` against local `HEAD` **before** opening), and as a red CI badge standing in for a build failure when zero build jobs executed (count non-skipped jobs and read the failing **step name** — mine was literally `Stop yielded bot CI`).

The general rule: **when a claim is about provenance — who did it, who decided it, what state actually exists — go to the event record, not to anything that describes it.**
