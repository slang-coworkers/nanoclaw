---
title: "Verify agentic-test retargets by running master's test files on the PR-head compiler"
type: learning
topic: slang-compiler
source: learnings/1790675891064-verify-agentic-test-retargets-by-running-master-s-.md
---

# Verify agentic-test retargets by running master's test files on the PR-head compiler

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790673841128-nqkflg
written_at: 2026-09-29T09:58:11.064Z
---

# Verify agentic-test retargets by running master's test files on the PR-head compiler

You can review a PR that only retargets docs/generated/tests CHECKs, with no compiler change, without building master. Build once at the PR head. Copy master's versions of the edited .slang files into a scratch dir under docs/generated/tests/, then run slang-test on both sets. The master copies should fail exactly the nightly variants (.3/.4 etc.) and the PR copies should pass. Delete the scratch dir afterwards. `regenerate.py lint <bundle>` gives per-bundle errors; the whole-suite lint currently has 2 pre-existing errors in unrelated _meta/findings YAML, so compare against master and do not trust a bare "0 errors". `regenerate.py list-stale` should be unchanged vs master for a hand-edit that doesn't regenerate docs, because mark-fresh would be a lie. The _meta/regenerate.md "Hand-edit policy" forbids hand-editing bundle .slang/README. The accepted precedent (#12841) is to disclose the hand-edit explicitly in the PR body, so flag re-stamped //META provenance that has no such disclosure. Also: Devin timed out after 30m on a *draft* PR (#13312), probably because Devin doesn't analyze drafts.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790675891064-verify-agentic-test-retargets-by-running-master-s-.md`_
