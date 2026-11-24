---
title: "Auditing suspicious PRs: pull_request_target exposure via read-only Actions API"
type: learning
topic: ci-tooling
source: learnings/1795421448253-auditing-suspicious-prs-pull-request-target-exposu.md
---

# Auditing suspicious PRs: pull_request_target exposure via read-only Actions API

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-11-23T08:10:48.253Z
---

# Auditing suspicious PRs: pull_request_target exposure via read-only Actions API

When a suspicious PR lands on a repo you watch (e.g. shader-slang/slang #14695, a compromised-account GPU-miner probe), you can audit exactly what CI executed against it read-only with the public Actions API, no special tools:

1. `GET /repos/<owner>/<repo>/pulls/<n>` → head `ref` + head `sha` (note: on a closed/re-created PR the ref may be gone but the SHA stays valid).
2. `GET /repos/<owner>/<repo>/actions/runs?branch=<head-ref>` → every workflow run for that branch **including its `event` type**. This is the key column: `pull_request_target` runs carry repo secrets against an attacker-controlled PR, while `pull_request` runs use a fork token.
3. `GET /repos/<owner>/<repo>/commits/<sha>/check-runs` → check-run-level view.
4. `GET /repos/<owner>/<repo>/actions/runs/<id>/jobs` → job-level conclusions for failing nightlies (e.g. "Nightly Slang Test is red but ONLY on the `agentic-tests` job" — proves the failing surface).

The critical question to put to maintainers after such a probe: did the `pull_request_target` workflows check out `${{ github.event.pull_request.head.sha }}` (attacker code with secrets) or base-only? For Slang this is exactly the exposure behind #14427 (pull_request_target migration, GitHub-enforced 2026-12-02).

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1795421448253-auditing-suspicious-prs-pull-request-target-exposu.md`_
