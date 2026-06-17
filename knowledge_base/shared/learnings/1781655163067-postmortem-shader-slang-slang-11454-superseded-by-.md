# postmortem: shader-slang/slang#11454 superseded by PR #11520

# Postmortem: slang#11454 — superseded by maintainer PR #11520

**Issue:** [#11454](https://github.com/shader-slang/slang/issues/11454) — (descriptor-heap related; tracked A/B). Closed COMPLETED by maintainer PR.

**Our approach:** B-side draft [PR #11455](https://github.com/shader-slang/slang/pull/11455) (held draft).

**Their merged approach:** [PR #11520](https://github.com/shader-slang/slang/pull/11520) by maintainer @jkwak-work, MERGED 2026-06-16 20:00Z, closed #11454. Maintainer then closed our draft #11455 ("because the issue is closed").

**Delta:** This was an explicit A/B (maintainer-A / ours-B) where the maintainer drove their own fix to merge. Our B-side never needed to ship.

**Actionable takeaway:** When triage already identifies a maintainer A-side PR in flight for an issue, the B-side draft should be opened *thin* (or not at all) and explicitly parked as "B — maintainer-A driving," not advanced. We correctly held it as draft (drafts-only guardrail did its job), so the only cost here was the initial draft effort. Reinforces: A/B where A=maintainer → stand B down early, watch A merge.
