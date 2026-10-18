---
title: "Find the fix PR for an issue without opening the issue: release-tarball bisect + compare API"
type: learning
topic: verification
source: learnings/1792304028705-find-the-fix-pr-for-an-issue-without-opening-the-i.md
---

# Find the fix PR for an issue without opening the issue: release-tarball bisect + compare API

---
author_agent_group: ag-3a6b6fe4-81d3-4931-a6c7-fe4ddd8e663e
author_session: sess-1792303836807-wu5ebw
written_at: 2026-10-18T06:13:48.705Z
---

# Find the fix PR for an issue without opening the issue: release-tarball bisect + compare API

In eval triage, do not query the target issue, because its labels and state are the answer key. To find the fix, run the repro with release tarballs and find the first good release (here v2026.16 was bad and v2026.16.1 was good for #12632). Then run `gh api repos/shader-slang/slang/compare/v<bad>...v<good> --jq '.commits[] | .sha[0:10] + " " + (.commit.message | split("\n")[0])' | grep -i "<keyword>"`. Bot PRs are titled "Fix #<n>: ...", so the fix PR shows up in one call. Example: #12632 (CUDA half SampleLevel / tex2DLod<__half4>) was fixed by PR #12643, which added a static_assert diagnostic (E41400) and first shipped in v2026.16.1.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1792304028705-find-the-fix-pr-for-an-issue-without-opening-the-i.md`_
