---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786369636777-lz4v1b
written_at: 2026-08-10T14:21:07.822Z
---

# [approver/clause-gap] A rate-limited bot review posts a GREEN commit status — never read that green as review coverage

# A rate-limited CodeRabbit review still turns its commit status green

**Symptom.** On shader-slang/slang-rhi#824 the combined status at the PR head
read `state: success` with a `CodeRabbit` context marked `success`, 26 seconds
after the PR opened. `harvest-reviews.py`/`collect-reviews.sh` returned **exit 20**
(`{"found": false}`) — the "production genuinely skips this PR" tier. Those two
facts together invite the reading "no review needed here, and CI is green
anyway."

**Root cause.** CodeRabbit had posted an issue comment saying:

> ⚠️ **Review limit reached** — `@author`, you've reached your PR review limit,
> so we couldn't start this review. Next review available in: 29 minutes.
> You've used all free OSS reviews for now.

The review **never started**. But the bot's commit *status* context is set to
`success` regardless of whether it reviewed anything. So the green is a
"nothing went wrong on my end" signal, not a "I reviewed this and found it
clean" signal — structurally the same false-clean shape as an empty findings
section with exit 0.

**Why exit 20 masks it.** Exit 20 means "no harvestable bot review AND no review
bot still working" — legitimate for fixer/bot-authored PRs where production
review is skipped by design. A rate-limited bot is *not* that case: the review
was intended and was prevented. Exit 20 cannot distinguish "correctly skipped"
from "wanted to review but couldn't", and the rate-limit notice lives in an
**issue comment**, not in `reviews[]` — so nothing the harvest reads mentions it.

**How to catch it.** When harvest returns 20 (or 22) on a PR that is NOT a
fixer/bot-authored/Claude-branch PR, fetch the issue comments and grep the bot's
own body before accepting the skip:

- `mcp__slang-mcp__github_get_pull_request_comments` (read-only; survives the
  critique-gate hook that blocks `gh api .../comments`), or
  `gh pr view <n> --json comments`.
- Look for: `Review limit reached`, `rate limited by coderabbit.ai`,
  `couldn't start this review`, `usage limit`, `free OSS reviews`.

If found: the tier is genuinely **Devin-only**, and you must say so explicitly in
the synthesized review doc — do not let the green `CodeRabbit` status appear
anywhere in the derivation as support. Consider re-harvesting after the stated
reset window if the decision is not time-critical (the notice gives an exact
number of minutes).

**Generalizes.** *A bot's commit status reports the bot's own health, not its
verdict.* Any signal whose green is emitted unconditionally on the bot's success
path — CLA stamps, "review skipped", rate-limit notices — carries zero bits about
the code. Ask of every green: **could it have come out otherwise?** A rate-limited
reviewer's green could not.

Related: the combined-`/status` folding trap (green over zero compiled jobs from
`license/cla` + `CodeRabbit` alone), and the "demand a POSITIVE findings token
(N Bugs / M Flags) plus a LIVENESS token" rule — a never-started review prints
its intended scope the same way a genuinely-clean one does.
