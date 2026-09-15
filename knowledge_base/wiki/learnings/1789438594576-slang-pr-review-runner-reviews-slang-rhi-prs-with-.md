---
title: "slang-pr-review-runner reviews slang-rhi PRs with real source context via vendored external/slang-rhi"
type: learning
topic: slang-compiler
source: learnings/1789438594576-slang-pr-review-runner-reviews-slang-rhi-prs-with-.md
---

# slang-pr-review-runner reviews slang-rhi PRs with real source context via vendored external/slang-rhi

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789437337859-ke71x3
written_at: 2026-09-15T02:16:34.576Z
---

# slang-pr-review-runner reviews slang-rhi PRs with real source context via vendored external/slang-rhi

When running `/slang-pr-review` on a **shader-slang/slang-rhi** PR (mode `pr`), the runner works even though slang-rhi has no `REVIEW.md` / `.claude/agents`:

- Keep `REPO_ROOT` at its default `/workspace/agent/slang` (the slang checkout owns the REVIEW.md + 6-subagent pipeline and the clarity skills). Pass the target repo via `--repo shader-slang/slang-rhi --pr <N>`. The review target is `gh pr diff <N> -R shader-slang/slang-rhi`.
- **The slang checkout vendors slang-rhi at `external/slang-rhi/`**, so Reviewer A's subagents (and Reviewer C) get REAL slang-rhi source context, not diff-only — e.g. on #868 the correctness reviewer read `external/slang-rhi/src/vulkan/vk-buffer.h` / `vk-buffer.cpp` and cited exact lines (`m_api(nullptr)` default; `createBufferFromNativeHandle` never calls `init()`) to independently confirm the fix was complete (only 2 `m_buffer.m_api` derefs in `src/`, both closed). Caveat: the vendored copy is a pinned submodule, so it may lag PR head by a few commits — fine for reviewing surrounding source, verify against `gh pr diff` for the exact changed hunks.
- `gh` reads public slang-rhi fine even when `gh auth status` reports `GH_TOKEN invalid` — read ops on public repos succeed; only writes need a valid `pull_requests:write` token.
- Reviewer C's `run-clarity.sh` isolates in its own `wt-clarity-*` git worktree off `origin/master`, so A and C can run concurrently against the shared slang checkout without `.git/index.lock` collisions. The worktree is auto-removed by an EXIT trap on clean exit.
- Peer fix-review handoffs (request arrives directly from `slang-fixer`, no `<github-post-authorized />` marker) → GitHub post-back is a no-op; return combined-review.md on the peer edge only. Do not multicast the peer task to the Orchestrator/parent.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789438594576-slang-pr-review-runner-reviews-slang-rhi-prs-with-.md`_
