---
title: "slang-rhi PR review: A/C runner skills hard-target the compiler repo — adapt"
type: learning
topic: slang-compiler
source: learnings/1784929061497-slang-rhi-pr-review-a-c-runner-skills-hard-target-.md
---

# slang-rhi PR review: A/C runner skills hard-target the compiler repo — adapt

When `/slang-pr-review` is asked to review a **shader-slang/slang-rhi** PR (or any repo that is NOT the shader-slang/slang compiler), the Reviewer A (`slang-pr-review-runner` `compose-and-run.sh`) and Reviewer C (`slang-clarity-review-runner` `run-clarity.sh`) skills CANNOT run faithfully:

- Both hard-default `REPO_ROOT=/workspace/agent/slang` (the compiler checkout) and `git checkout origin/master`. slang-rhi's default branch is `main`, not `master`.
- `compose-and-run.sh` requires `$REPO_ROOT/REVIEW.md` (exits with error if absent) — slang-rhi has no REVIEW.md.
- Reviewer A's six `.claude/agents/*` subagents and Reviewer C's seven `.claude/skills/slang-review-*` skills are compiler-domain (IR/cross-backend/capability), living only in the compiler checkout — they don't fit an RHI (C++ graphics abstraction) codebase.

Pointing `--repo shader-slang/slang-rhi` at them would review the compiler checkout's master with an RHI diff, or produce domain-mismatched noise, and misrepresent what ran.

**Adaptation that works (used on slang-rhi#802, Jul 2026):**
1. Fetch the PR head into a `wt-<pr>-review` worktree of the real `/workspace/agent/slang-rhi` checkout (`git fetch pull/<n>/head:pr-<n>`).
2. **Reviewer B (Devin) runs natively** — `devin-fetch.sh --url https://github.com/<owner>/<repo>/pull/<n>` reviews any public GitHub PR regardless of codebase. This is the one runner that transfers unchanged.
3. **Reviewers A (correctness) and C (clarity):** dispatch general-domain `Agent`s with repo-appropriate lenses against the real checkout at PR head, cross-checked against sibling code. Not the compiler skills.
4. **Personally verify the load-bearing claims** rather than trusting the fixer's summary.
5. Merge into `combined-review.md` with the same `[Review Verdict]` 5-bullet + machine-readable JSON block; flag the repo-mismatch adaptation in the combined report header for transparency.

Reusable slang-rhi facts confirmed this run: `MTL::ResourceID` is `struct { uint64_t _impl; } _MTL_PACKED;` (metal-cpp macOS15.2_iOS18.2, fetched per CMakeLists.txt:221) — sizeof==8, so `gpuResourceID()._impl` == the whole struct the arg-buffer path memcpy's. `Buffer::resolveBufferRange` clamps offset/size to buffer size (rhi-shared.cpp:60). Metal residency has two modes: residency-set (Apple6+ default, all resources always resident via `registerResource`) vs `!m_hasResidencySet` fallback (per-encoder `useResources`, populated only by the setBinding arg-buffer path — so bindless-only textures aren't covered there).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784929061497-slang-rhi-pr-review-a-c-runner-skills-hard-target-.md`_
