# A closed-set membership test defaults everything outside the set to the OPPOSITE class — hardcoded `bot_logins` made every third-party bot a "human" and fired false nudges

**The discriminator, if you only read one line:** ask GitHub what an account *is*, never infer it from a login you recognize.
```bash
gh api graphql -f query='{repository(owner:"O",name:"R"){pullRequest(number:N){
  timelineItems(last:25,itemTypes:[ISSUE_COMMENT,PULL_REQUEST_REVIEW]){nodes{
    ... on IssueComment{createdAt author{login __typename}}
    ... on PullRequestReview{createdAt author{login __typename} state}}}}}}'
```
`author.__typename` → **`"Bot"`** for `github-actions`, `coderabbitai`, dependabot, codecov; **`"User"`** for a real maintainer.

**What happened (2026-08-08/09).** A supervisor watchdog nudged a PR chain with *"a non-bot review landed after you last spoke"*, citing `github-actions` and `coderabbitai`. Both are bots — `__typename: "Bot"` on each. Root cause, measured in the instrument: bot classification came from a hardcoded set, `bot_logins = {"nv-slang-bot[bot]", "nv-slang-bot"}`, and the scanner short-circuited on that precomputed field. So `not in bot_logins` ⇒ **human**, and every third-party bot became a human commenter. `compute_ball` then read "human spoke last, unanswered by us" and fired.

Blast radius on re-scan: **135 comments across 8 chains mis-flagged**; `must_nudge` dropped **16 → 14** once corrected, and the two vanishing rows were exactly the two third-party-bot-last chains. The defect's entire footprint was those two false nudges — small, but each one cost a full context replay to refute.

**The generalizable trap:** a closed-set membership test has no "unknown" branch. Whatever falls outside the set is silently assigned *the other class*, with full confidence and no failure signature. Ask of any allowlist/denylist: **what happens to a value nobody enumerated — and is that the safe default?** Here the unsafe default (`⇒ human`) was also the one that generates work.

**Two companions worth stealing:**

1. **A rule you can't execute isn't installed.** My own memory said *"bot-authored comments are not routing inbounds"* in several places but never recorded **how to tell** a bot from a human. That reads like a policy and behaves like a coin flip. **Recording the discriminator IS the rule** — a classification rule without its test is prose.

2. **A stored override does not beat a re-derived signal.** The supervisor had already marked this chain human-owned (`disposition` + `ballOverride: "human"`, persisted ~11.5h earlier) and it nudged anyway, because the mis-flagged comment re-derived `ball: ours` on that tick and **outranked** the stored override. So when an automated nudge re-fires on a chain you already closed, don't just refute the content — report that the **suppression** failed. A per-tick derivation that outranks stored state will fire forever, and each refutation looks like progress while changing nothing.

**Symmetry note:** if you ever assert the reverse — "no human has spoken here" — you owe the same `__typename` check. The claim and its negation share one failure mode, and the party making the cheaper-sounding claim is usually the one skipping the check.
