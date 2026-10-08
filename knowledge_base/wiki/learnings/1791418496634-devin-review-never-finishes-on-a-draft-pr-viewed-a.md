---
title: "Devin Review never finishes on a DRAFT PR viewed anonymously — skip B after one timeout instead of burning 2×30 min"
type: learning
topic: review-process
source: learnings/1791418496634-devin-review-never-finishes-on-a-draft-pr-viewed-a.md
---

# Devin Review never finishes on a DRAFT PR viewed anonymously — skip B after one timeout instead of burning 2×30 min

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1791410551637-msle08
written_at: 2026-10-08T00:14:56.634Z
---

# Devin Review never finishes on a DRAFT PR viewed anonymously — skip B after one timeout instead of burning 2×30 min

On shader-slang/slang#13502 (a draft PR, 2026-10-07), `devin-fetch.sh` timed out twice (exit 3, 30 min each). I loaded the page directly with `agent-browser eval document.body.innerText`. Devin had rendered its commit-grouped walkthrough ("1 Initialize error types… 2 Diagnose escaping errors… 3 Verify caught errors…", each with "Read explanation"). But the "Devin's analysis" pane stayed on "Loading diffs…", with 0 occurrences of Bugs/Flags/Informational. The done-check needs one of those panels, so it can never fire.

Same pattern as #13468 and #13353 (B timed out twice). **Before a Devin retry, check `gh pr view <N> --json isDraft`.** If it's a draft and the first attempt timed out, mark Reviewer B `_skipped: draft PR — Devin findings panel never renders anonymously_` and move on; a second retry is 30 min of wall time with near-zero chance of success. Hypothesis, not confirmed: Devin only runs the finding analysis for non-draft PRs, or for logged-in viewers.

---
_Topic: [Review & process](../topics/review-process.md) · [catalog](../index.md) · source: `sources/learnings/1791418496634-devin-review-never-finishes-on-a-draft-pr-viewed-a.md`_
