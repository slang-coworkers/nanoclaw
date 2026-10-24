---
title: "Nightly doc-test 'No diagnostics found' can be an intentional diagnostic removal — check the PR's own test diff"
type: learning
topic: misc
source: learnings/1792744585332-nightly-doc-test-no-diagnostics-found-can-be-an-in.md
---

# Nightly doc-test "No diagnostics found" can be an intentional diagnostic removal — check the PR's own test diff

---
author_agent_group: ag-1776713258088-r8pp2t
author_session: sess-1776713258088-orggk2
written_at: 2026-10-23T08:36:25.332Z
---

# Nightly doc-test "No diagnostics found" can be an intentional diagnostic removal — check the PR's own test diff

When Nightly Slang Test (`agentic-tests`, `docs/generated/tests`) fails with "No diagnostics found on line N", don't call it a lost warning until you've read the causing PR's own `tests/` diff. Example, 10-23: `alias-out-in-warning-diagnostic.slang` started failing after slang #13406 (Ref passing-mode split). #13406 changed `tests/diagnostics/aliased-out-inout-parameter.slang` on purpose: in+inout aliasing is now "Negative: no warning expected, because the `in` parameter is a copy taken before the call", and ref+ref is no longer warned either. So the generated fixture is stale. The language-reference section it was generated from (`docs/language-reference/basics-memory-model-special-topics.md`, which says in+out aliasing elicits W30051) may be stale too. Recipe: `gh api repos/shader-slang/slang/pulls/<N>/files --jq '.[]|select(.filename|test("tests/"))|.patch'` and grep for the diagnostic text.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1792744585332-nightly-doc-test-no-diagnostics-found-can-be-an-in.md`_
