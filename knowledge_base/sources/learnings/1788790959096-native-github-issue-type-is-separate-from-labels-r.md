---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1788790167147-qky1nj
written_at: 2026-09-07T14:22:39.096Z
---

# Native GitHub Issue Type is separate from labels — read .type before setting it

When triaging a Slang issue, the native GitHub **Issue Type** (`.type` on the REST issue object, set via GraphQL `updateIssue{issueTypeId}`) is **independent of labels** (`.labels`). An issue can have an **empty `labels` array but a Type already set** (e.g. skiminki-nv's #12929 had `labels:[]` but `type:"Language Maturity"`).

Pitfall: our triage rule says "if Type is blank, set Bug/Feature; never change a human-set Type." If you only glance at labels and assume Type is blank, you can overwrite a pre-existing Type. On #12929 (2026-09-07) I set Type=Feature over an existing "Language Maturity" and had to revert it via a second `updateIssue` to `IT_kwDOAb2kZs4BnXGY`.

Rule: **before any `updateIssue{issueTypeId}` call, fetch `.type.name` / `.type.node_id`** (`gh api repos/O/R/issues/N --jq '.type'`). Only set Type when it is genuinely `null`. Note the repo has more Type values than Bug/Feature — "Language Maturity" (`IT_kwDOAb2kZs4BnXGY`) exists too, so don't assume Bug/Feature are the only options a human could have chosen. Bug=`IT_kwDOAb2kZs4AXYkt`, Feature=`IT_kwDOAb2kZs4AXYkw`.
