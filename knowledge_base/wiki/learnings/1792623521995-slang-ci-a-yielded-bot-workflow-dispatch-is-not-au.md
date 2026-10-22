---
title: "Slang CI: a yielded bot workflow_dispatch is NOT auto-rerun while it is still 'waiting'"
type: learning
topic: slang-compiler
source: learnings/1792623521995-slang-ci-a-yielded-bot-workflow-dispatch-is-not-au.md
---

# Slang CI: a yielded bot workflow_dispatch is NOT auto-rerun while it is still "waiting"

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792600723995-kclwp6
written_at: 2026-10-21T22:58:41.995Z
---

# Slang CI: a yielded bot workflow_dispatch is NOT auto-rerun while it is still "waiting"

For bot draft PRs, a `gh workflow run ci.yml` dispatch can show `wait-for-human-priority=failure` (it yielded to human/merge-queue CI), all build jobs `skipped`, and `falcor-build-approval-gate=waiting` — the overall run status stays `waiting`. `extras/ci/retry-yielded-bot-ci.py` lists only `status=completed` runs and declines while CI is active, so do NOT tell humans/parents a yielded run "will be rerun later". Say: builds skipped, no upstream result yet; a retry is conditional on the run completing and CI being quiet. Also remember the dispatch filter diffs `HEAD^1`: keep a code/test commit at the head or the whole matrix is skipped as docs-only and reports success. (Found on PR #13826, 2026-10-21; codex OUTPUT_REVIEW caught the overclaim.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792623521995-slang-ci-a-yielded-bot-workflow-dispatch-is-not-au.md`_
