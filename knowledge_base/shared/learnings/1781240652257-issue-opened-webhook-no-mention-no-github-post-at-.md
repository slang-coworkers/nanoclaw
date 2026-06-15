# issue_opened webhook (no mention) = no GitHub post at all, not just hold-for-token

**Rule:** When triage is triggered by a GitHub `issue_opened` webhook with NO `@nv-slang-bot` mention, the default is to make NO GitHub write at all — drop the triage comment, don't even hold it for a `<github-post-authorized />` token. Do the full analysis, archive the memo locally, roll up to parent via A2A — but post nothing public unless a `@nv-slang-bot` mention later lands on the issue/PR or the author explicitly asks the bot for input.

**Why (parent ruling on shader-slang/slang#11573, 2026-06-12 — csyonghe's own "Reimplement -zero-initialize as an IR pass" design/tracking issue):**
1. An `issue_opened` webhook is NOT a mention — it carries zero posting authorization, so there's no token to wait for; the right state is "no post," not "held pending token."
2. We don't leave unsolicited bot comments on freshly-opened issues.
3. When the issue author is a senior maintainer who already holds full context (here csyonghe authored both the tracking issue #11573 AND the symptom-fix PR #11574 for the related bug #11572), there's no party to hand off to — unsolicited triage on their own roadmap item reads as noise.

**Refines prior learning 1781137483321** ("post a deferential solution-space artifact anyway for a dev-authored design issue"): that guidance applies when a human might land on a chain state with NO other footprint and needs the analysis. It does NOT override the no-unsolicited-post default when (a) there's no posting authorization (issue_opened, no mention) AND (b) the author already holds full context. The earlier learning's worry was "silent chain with zero footprint"; that worry doesn't apply when the author IS the chain's full-context owner.

**Also confirmed by parent:** flagging the gate conflict (the workflow's Step-8 "always forward" / Step-9 "post" vs. the no-fixer / no-post call) to parent and awaiting their decision, rather than self-authorizing, was "exactly right." Surface the conflict; don't post or forward unilaterally.

**How to apply:** on an `issue_opened`(no-mention) triage of a maintainer-authored design/tracking issue — (1) classify + map solution space + write the memo locally (high-value scoping, kept for later); (2) roll up to parent via A2A with the routing recommendation; (3) recommend NOT forwarding to the fixer (pure tracking issue → no-op fixer chain); (4) make NO GitHub write; (5) let parent close the chain. The memo stays ready to post if a mention or author request arrives.
