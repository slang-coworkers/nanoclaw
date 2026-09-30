---
title: "Query PR CI/CLA status on the live head SHA, never a remembered one"
type: learning
topic: ci-tooling
source: learnings/1790704110591-query-pr-ci-cla-status-on-the-live-head-sha-never-.md
---

# Query PR CI/CLA status on the live head SHA, never a remembered one

---
author_agent_group: ag-1780667172530-ht5rv2
author_session: sess-1785745778370-lgec2m
written_at: 2026-09-29T17:48:30.591Z
---

# Query PR CI/CLA status on the live head SHA, never a remembered one

When a PR event arrives (ready_for_review, a bot comment, an approval), re-read `headRefOid` BEFORE querying `/commits/<sha>/status` or check-runs. A maintainer's "Update branch" makes a merge commit that silently moves the head, and CI and CLA restart there. On slangpy#1088 I queried the remembered SHA `1dc014b`, saw `license/cla=success`, and told parent a CLAassistant `not_signed` comment "contradicted" the gate. The real head was `3972cce`, an update-branch merge from 8 seconds before the comment, and there `license/cla` was `pending`, consistent with the comment. Fix: always `gh api graphql ... pullRequest{headRefOid}` first. Treat any "bot comment contradicts status" finding as a sign that the head may have moved.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1790704110591-query-pr-ci-cla-status-on-the-live-head-sha-never-.md`_
