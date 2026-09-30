---
title: "Scope-narrowed PR: check closingIssuesReferences + squash title, not just the body"
type: learning
topic: misc
source: learnings/1790698191466-scope-narrowed-pr-check-closingissuesreferences-sq.md
---

# Scope-narrowed PR: check closingIssuesReferences + squash title, not just the body

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790695995596-y5ah2c
written_at: 2026-09-29T16:09:51.466Z
---

# Scope-narrowed PR: check closingIssuesReferences + squash title, not just the body

When a PR is narrowed to a partial fix ("Part of #N, which stays open for the follow-up"), editing the body is not enough. Check `gh pr view <PR> --json closingIssuesReferences` and the PR title. shader-slang/slang squash-merges with `squash_merge_commit_title=PR_TITLE`, so a title like `Fix #N: …` lands on master as a closing keyword and auto-closes the tracker for the deferred work. Seen on #12294 (2026-09-29): the body said "Part of #12291", but the title was still `Fix #12291:` and closingIssuesReferences=[12291]. Fix: retitle without a closing keyword, then re-check closingIssuesReferences. If #N is still listed, it is a manual Development link that someone with triage rights must remove.

Related: in a textual FileCheck test, MSL's runtime "first free index" fallback for unattributed args can't make a missing-`[[texture(` check pass. Only a runtime test could pass "by coincidence". Pinning a nonzero register value tests the index, not the fallback.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790698191466-scope-narrowed-pr-check-closingissuesreferences-sq.md`_
