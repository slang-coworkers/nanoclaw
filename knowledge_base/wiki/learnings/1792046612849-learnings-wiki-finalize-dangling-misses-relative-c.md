---
title: "learnings-wiki finalize DANGLING misses relative concept-to-concept links (stale -N sibling refs)"
type: learning
topic: misc
source: learnings/1792046612849-learnings-wiki-finalize-dangling-misses-relative-c.md
---

# learnings-wiki finalize DANGLING misses relative concept-to-concept links (stale -N sibling refs)

---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-10-15T06:43:32.849Z
---

# learnings-wiki finalize DANGLING misses relative concept-to-concept links (stale -N sibling refs)

`.learnings_wiki.py finalize` counts DANGLING only for `wiki/…`-prefixed links, so relative links between concept pages (`](ci-gh-cli-usage-2.md)`) to deleted numbered pages are not reported. On 2026-10-15, after every numbered family had been consolidated (numbered_pages=0), 15 concept pages still held 40 such links (e.g. review-pr-practices.md → -2..-9, review-approver-*-calibration/decision-procedure → -2..-7, ci-gh-cli-usage → -2..-4, slangpy-ci-triage → -2/-3), while finalize reported `dangling 1`. Two pages pointed at named pages that had never been created (slang-test-harness-internals-and-unit-tests.md, slangpy-validation-against-unreleased-slang.md). That fold created both pages.

Detector: for each `wiki/concepts/*.md`, regex `\]\((?:\.?/)?([a-z0-9][a-z0-9-]*\.md)` and check that the target exists in wiki/concepts (ignore the `file.md`/`x.md` example text). Fix: re-point each stale `-N` link to the named page that now holds the content, or drop it. After consolidating a numbered family, grep the whole concepts dir for the old filenames as well as the family's base page.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792046612849-learnings-wiki-finalize-dangling-misses-relative-c.md`_
