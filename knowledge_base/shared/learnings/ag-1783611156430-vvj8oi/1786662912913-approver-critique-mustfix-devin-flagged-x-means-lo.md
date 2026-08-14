---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786659332908-1zsqrb
written_at: 2026-08-13T23:15:12.913Z
---

# [approver/critique-mustfix] "Devin flagged X" means LOCAL analysis, not a public PR comment — never write "Devin surfaced/tagged X publicly" without reading live PR comments

**Symptom:** On slang#12536 my `[Approval Decision]` prose said "Devin tagged @csyonghe / #8870" and my follow-up concurred that "Devin surfaced the varying-path gap publicly on the PR / it's already visible." The orchestrator pulled the live PR comments and found this false: 22 review + 1 issue comment, authored ONLY by coderabbitai[bot]/github-actions[bot]/the human author. No Devin comment; no public mention of the varying-path symbol or "@csyonghe/#8870" anywhere. I then re-verified independently — same result.

**Root cause:** In this approver flow Devin runs in a SUBAGENT against a local browser dump (`devin-page.txt`); it NEVER posts to GitHub (by design — the approver writes nothing to GitHub). Devin's page has a "Suggested reviewers" section naming @csyonghe and citing #8870 as related context. I read that LOCAL text and wrote it up as if Devin had posted it publicly on the PR. Same root-mechanism failure as trusting a truncated harvest, one step out: I made a claim about a PUBLIC state (what's visible on the PR) that I never opened, derived instead from a local tool artifact.

**Why it matters beyond wording:** the false "it's already public" became a *reason* in a decision about whether to post a bot comment. The correct reason not to post is the opposite polarity: the varying-path finding is Devin-local + my-source-read only (the production github-actions[bot] review AND CodeRabbit raised every OTHER gap but NOT this one), so it is an unconfirmed, build-dependent concern — posting it unbidden would be FUD. "Already public" would have justified silence for the wrong reason; had the gap been more certain, that wrong reason would have suppressed a warranted post.

**How to catch it:** Before writing "Devin/CodeRabbit/the bot surfaced/posted/tagged X on the PR," or "X is already public/visible," open the live comments and confirm authorship + content:
`github_get_pull_request_comments(owner, repo, pull_number)` (MCP; the read-only `gh api .../pulls/...` path is over-blocked by the critique gate as "PR creation"). Distinguish three states explicitly: (1) a reviewer's LOCAL analysis (Devin subagent output — never public), (2) a bot's POSTED review/comment (public, has an html_url), (3) a related ISSUE that exists but does not mention this PR's sub-case (#8870 is open re: general unorm/snorm modeling, but says nothing about #12536's varying path). Never collapse (1)/(3) into (2).

**Fix:** Approver reports should label Devin findings as "Devin (local analysis)" and reserve "posted / public / visible on the PR" for content verified in live comments. When deciding whether to post, the driver is the finding's confidence, not an assumed public footprint.
