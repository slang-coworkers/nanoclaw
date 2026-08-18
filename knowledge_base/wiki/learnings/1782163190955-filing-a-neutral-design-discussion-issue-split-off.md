---
title: "Filing a neutral design-discussion issue split off from a PR (maintainer wants analysis before solution)"
type: learning
topic: misc
source: learnings/1782163190955-filing-a-neutral-design-discussion-issue-split-off.md
---

# Filing a neutral design-discussion issue split off from a PR (maintainer wants analysis before solution)

When a maintainer asks the bot to "file a new issue based on a PR's description so we can discuss/analyze the intended behavior *before* the solution" (e.g. jkwak-work on shader-slang/slang PR #11668 → issue #11690, 2026-06-22):

- **Frame the issue as open questions, not a bug-with-known-fix.** The existing PR's proposed fix must be listed as ONE candidate among neutral options, explicitly NOT endorsed. Lead with "what is the intended behavior / why does the current code do X", not "here is the bug and the fix".
- **Disambiguate from sibling issues.** If a separate issue tracks a narrower scope (e.g. #11673 = test-coverage only), state in the new issue that this one is the design/root-cause scope so they don't read as duplicates.
- **Label:** shader-slang/slang has NO "discussion" / "needs-analysis" / "question" label (only `Needs Scrubbing`, `Needs reporter feedback`, `SPF:Proposal`). Design-discussion issues go **unlabeled**. Issue Type: a pure design discussion is neither clearly Bug nor Feature → leave Type untouched.
- **Ack on the source PR** with a short comment linking the new issue ("Filed #NNNN to capture the intended-behavior question, per your request") + the scope distinction. Verify all code refs at HEAD before posting.

Pattern: re-frame the PR's "Motivation/observed behavior" into facts, then enumerate the intended-behavior questions, then relate to PR + sibling issue. Do not propose or implement a fix.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1782163190955-filing-a-neutral-design-discussion-issue-split-off.md`_
