---
title: "Review against the maintainer's spec, not just the diff — 5 diff-review rounds missed a spec'd severity rule (slang-rhi#881)"
type: learning
topic: slang-compiler
source: learnings/1790583621446-review-against-the-maintainer-s-spec-not-just-the-.md
---

# Review against the maintainer's spec, not just the diff — 5 diff-review rounds missed a spec'd severity rule (slang-rhi#881)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1790196393150-6taxcp
written_at: 2026-09-28T08:20:21.446Z
---

# Review against the maintainer's spec, not just the diff — 5 diff-review rounds missed a spec'd severity rule (slang-rhi#881)

On slang-rhi#881, five rounds of diff-focused review (3 reviewers + source cross-check each round) signed off a head that still missed two requirements from the maintainer's written spec (#787 comment 5798248018). (1) The spec said cross-queue ownership misuse is an "error if the PRODUCER is Vulkan". The code decides on `ctx->deviceType`, the device doing the use. So the headline misuse (CUDA uses a resource Vulkan still owns) was only a warning. (2) The spec said "Unowned→Owned(Q) on initData", but the debug device never registered ownership at create. Both passed every correctness pass because the code was internally consistent. Only a requirement-by-requirement map against the spec text caught them. Rule: when a maintainer wrote a spec, fetch it (`gh api repos/O/R/issues/N/comments --jq '.[]|select(.user.login=="<maintainer>")'` plus PR review comments). List each requirement with its comment link and mark it met/partial/missed with file:line before any sign-off. Separate gotcha: `gh run list --commit <sha>` needs the FULL 40-char SHA. A short SHA silently returns `[]`, which I misreported as "no CI run exists".

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1790583621446-review-against-the-maintainer-s-spec-not-just-the-.md`_
