---
title: "Running /slang-pr-review on a non-compiler repo (slang-rhi)"
type: learning
topic: slang-compiler
source: learnings/1789377211919-running-slang-pr-review-on-a-non-compiler-repo-sla.md
---

# Running /slang-pr-review on a non-compiler repo (slang-rhi)

---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789376182175-p00xsa
written_at: 2026-09-14T09:13:31.919Z
---

# Running /slang-pr-review on a non-compiler repo (slang-rhi)

Reviewing a **slang-rhi** PR (not the compiler) via the slang-tuned `/slang-pr-review` workflow works, with caveats:

- **It's diff-based, so `--repo shader-slang/slang-rhi` is enough.** `compose-and-run.sh` / `run-clarity.sh` keep `REPO_ROOT=/workspace/agent/slang` (the compiler checkout) as CWD but fetch the review target via `gh pr diff -R <repo>` and write `tmp/context.json` with the right repo. REVIEW.md is diff-first (reads `tmp/context.json` + regenerates the diff), so Reviewer A/C review the correct slang-rhi diff.
- **Cross-repo context reads are degraded, and the reviewers compensate.** Because CWD is the compiler, local `Read src/...` of slang-rhi files fails; Reviewer A worked around it by `gh api`/WebFetch of the PR head source (e.g. `raw.githubusercontent.com/.../<head_sha>/...`). Fine, but to make the merge solid I grounded the key correctness claims myself against the mounted `/workspace/agent/slang-rhi` checkout via a subagent. Note that mount can be on a stale branch — verify against the fetched PR head (`git fetch origin pull/<n>/head`), not the working tree.
- **slang-rhi Devin (Reviewer B) returns a clean pass fast** (0 bugs/flags/informational; exit 0). Consistent with the "slang-rhi is review-fallback-tier, CodeRabbit+Devin primary" note. Devin's "AI Analysis" block often just echoes the PR description — the genuine signal is the Bugs/Flags/Informational sections.
- **Budget:** cap A and C with `--max-budget-usd` (I used $10 each; a ~3-file diff cost A ≈ $3.6). Default is $30 each — two at default can blow a tight session budget.
- **No `<github-post-authorized />` on a fixer peer-review handoff** → return `combined-review.md` via `send_file` only, no GitHub post. slang-rhi is also typically App-write-limited (`post-back.sh` would 403→exit 3).

Concrete finding worth remembering for slang-rhi Vulkan barriers: `calcAccessFlags` (src/vulkan/vk-utils.cpp) is the ResourceState→VkAccess map; there is a single `ShaderResource` state (no Pixel/NonPixel split like D3D12), and `calcPipelineStageFlags(ShaderResource)` returns the device-wide `supportedShaderStageFlags` (always includes FRAGMENT_SHADER_BIT). D3D12's counterpart is `translateResourceState` (legacy resource-state model), NOT a `calcAccessFlags` — so "mirrors D3D12" is a behavioral analogy, not a literal flag mirror.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789377211919-running-slang-pr-review-on-a-non-compiler-repo-sla.md`_
