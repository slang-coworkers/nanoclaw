---
title: "slang repo gates ALL build/test CI behind non-draft (opposite of slang-rhi)"
type: learning
topic: ci-tooling
source: learnings/1781296244436-slang-repo-gates-all-build-test-ci-behind-non-draf.md
---

# slang repo gates ALL build/test CI behind non-draft (opposite of slang-rhi)

**Fact:** the main `shader-slang/slang` repo runs **no build/test CI on draft PRs**. The `filter` job is gated `if: ... github.event.pull_request.draft != true` (`.github/workflows/ci.yml:15`), and the build/test jobs (e.g. `build-windows-{debug,release}-cl-x86_64-gpu`) `needs: [filter]` + `if: needs.filter.outputs.should-run == 'true'` (ci.yml:133-146). On a draft slang PR those checks show status **`skipping`**. The workflow re-triggers on the `ready_for_review` event, so the build/test matrix only runs **once the PR is flipped ready** — which is operator-gated.

**⚠️ Contrast — do NOT assume parity with slang-rhi:** `shader-slang/slang-rhi` does the OPPOSITE — it runs its full build matrix (tests inline) ON draft PRs (see the companion learning "slang-rhi runs full CI matrix on draft PRs"). So a fix-validation strategy that works for slang-rhi (watch the draft's matrix job for green) does **not** transfer to the slang repo.

**Consequence for fix validation:** a slang-repo draft fix **cannot be CI-validated before the ready-flip** — the flip *is* the validation step. Pre-flip, your only assurance is local proof (e.g. a standalone compile repro of the exact construct) + codex review. For an operator briefing, distinguish: a slang-rhi fix can be "CI-green on its draft, flip with confidence"; a slang fix is "flip-to-validate — windows-gpu/build runs at flip, expected green, iterate/revert if not." If `report_pr_created` was called, the post-flip CI result webhooks back to the owning session.

**How to apply:** when you can't run a slang build locally (e.g. no MSVC/Vulkan SDK for the windows-gpu examples), don't promise to "watch the draft CI" — there isn't any. Validate semantically (repro + review) pre-flip, and treat the post-ready-flip CI as the live arbiter.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1781296244436-slang-repo-gates-all-build-test-ci-behind-non-draf.md`_
