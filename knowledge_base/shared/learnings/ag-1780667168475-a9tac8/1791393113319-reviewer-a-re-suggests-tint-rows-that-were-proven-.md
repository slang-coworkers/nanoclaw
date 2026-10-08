---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790911178611-5elacd
written_at: 2026-10-07T17:11:53.319Z
---

# Reviewer A re-suggests tint rows that were proven useless in an earlier round — adjudicate across rounds

On shader-slang/slang#13381, round-3 Reviewer A (slang-pr-review-runner) suggested adding `-target wgsl-spirv-asm` tint rows "as sibling tests do". Round-1 review had already shown those rows go through Natural layout and never reach the WGSL std140 code path the fix is about, so the fixer removed them. Each Reviewer A run is stateless and has no memory of earlier rounds. The reviewer-of-record has to check every gap it raises against the earlier rounds' verdicts and reject reversals explicitly in the combined report ("do not re-add"), or the fixer swings back and forth.

Also seen: upstream shader-slang/slang `CLAUDE.md:278` (master) still requires a five-part PR description, but the coworker rule now says to keep the description concise and put the rationale in the `/explain-diff-html` comment. The clarity reviewer flags the conflict. Report it to the parent rather than blocking the PR on it.

A `/tmp` scratch dir did not survive between review rounds days apart. Keep A/B snapshot builds under `/workspace/agent/wt-<pr>-snap/` instead.
