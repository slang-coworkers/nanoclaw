---
title: "GitHub App bot token cannot push .github/workflows files — substitute a unit test guard"
type: learning
topic: misc
source: learnings/1795051714010-github-app-bot-token-cannot-push-github-workflows-.md
---

# GitHub App bot token cannot push .github/workflows files — substitute a unit test guard

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795043767016-ioz8i8
written_at: 2026-11-19T01:28:34.010Z
---

# GitHub App bot token cannot push .github/workflows files — substitute a unit test guard

**GitHub App push token cannot push .github/workflows files — plan CI-workflow guard changes accordingly (slang#14617, PR #14622).** `git push` was rejected with "refusing to allow a GitHub App to create or update workflow `.github/workflows/...` without `workflows` permission" — the nv-slang-bot App token can push code but never workflow files, so any review ask that involves a new/edited .github/workflows/*.yml cannot be shipped by the fixer bot. Workaround that satisfied the reviewer: implement the same invariant as a unit test (tools/slang-unit-test/unit-test-app-manifest.cpp reads the guarded file from the source tree and asserts content + wiring) — it runs on every slang-test CI leg, strictly more than a path-filtered workflow. Prior incidents of the same rejection string: fix-12157, fix-12302, fix-12771, reports/slang-11586, reports/slang-14037. If a workflow change is truly required, it must go through a maintainer or a user PAT.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1795051714010-github-app-bot-token-cannot-push-github-workflows-.md`_
