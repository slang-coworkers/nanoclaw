---
name: project_slangpy_1058_cuda_fastmath_downstream_args
description: "slangpy#1058 CUDA precise-transcendentals perf + downstream_args --use_fast_math silently dropped; triaged bug+docs, fixer dispatched"
metadata: 
  node_type: memory
  type: project
  originSessionId: 96b3e1dc-ce18-4fcc-860b-491493ab5e27
---

**slangpy#1058** — [Perf] CUDA target defaults to precise transcendentals (4× slower than fast, 2× slower than Vulkan default on same GPU); `downstream_args=["--use_fast_math"]` accepted but silently no-ops. Reporter tekintatar, slangpy 0.42.0 / NVRTC 13.0 / L40S / Ubuntu 24.04.

**Triager verdict (msg #6, VERIFIED read-of-source):** bug(+docs) / medium / SGL `src/sgl/device` / P2, CUDA(NVRTC/PTX) backend.
- **Root cause of actionable bug:** user `downstream_args` are forwarded to Slang ONLY for D3D12 (`src/sgl/device/shader.cpp:322-326`, link path :1540-1543, both hardcoded `"dxc"`). CUDA branch never iterates them → `--use_fast_math` dropped. `floating_point_mode` plumbed correctly (:397-398), which is why `mode=fast` works.
- **Part 1 (cross-backend transcendental default)** = docs matter, NOT a plumbing bug. Upstream-Slang escalation only if maintainers want the default-policy question raised.
- **Recommended fix A:** add CUDA branch forwarding each arg via `add(DownstreamArgs, "nvrtc", arg)` (tag proven by existing OptiX include :334; CLI form `-Xnvrtc <flag>`). Optional B (warn on unforwardable args — per-target gate silently drops Vulkan/Metal/CPU downstream_args too) + C (docs note for Part 1).
- **Files:** src/sgl/device/shader.cpp:322-336 & :1540-1545; shader.h:187,212; conversion src/slangpy_ext/device/shader.cpp:27.

**State (07-13, [Triage Resolution] msg #12): FIXED, draft PR #1061.** Fixer shipped Approach A — added a `cuda` branch forwarding each `downstream_args` entry via `add(DownstreamArgs, "nvrtc", arg)` in BOTH compile & link paths, + C++/Python docstrings for the CUDA precise-transcendental default (Part 1 = docs-only; default intentionally NOT changed).
- **Draft PR #1061** — https://github.com/shader-slang/slangpy/pull/1061 — isDraft=true OPEN, body `Fixes shader-slang/slangpy#1058`. Held draft pending review.
- **Review:** fixer dispatched to slangpy-reviewer; owns PR follow-up (verdicts + CI webhook-driven to fixer). No verdict yet.
- **Tests:** CUDA-gated `test_cuda_downstream_args_forwarded` (compile+link paths; bogus NVRTC flag → SlangCompileError). SKIPS locally (no CUDA GPU); numeric repro (~1.50→~0.34ms) needs maintainer on L40S. No full local C++ build (fixer worktree 99% disk) — CI is build safety net.
- **GitHub footprint:** fixer's draft-PR 5-bullet on issue (comment 4953898063) — satisfies drafts-held→issue-comment rule. Triager verdict comment 4953786353.
- Triager holding; chain stays OPEN under fixer for review/CI. Main did NOT double-dispatch (triager owns fixer edge). No parent (webhook-originated).
- **CI iterations (07-13):** source fix (shader.cpp CUDA forwarding) correct throughout; 3 CI failures were all test-scaffolding: (1) deferred codegen needed dispatch, (2) `main` entry-point → `main_0` CUDA rename (`cuModuleGetFunction("main")` NOT_FOUND) → renamed to `compute_main` + bogus arg now `--gpu-architecture=compute_999`, (3) macOS skip-guard not platform-aware → gate on `helpers.DEFAULT_DEVICE_TYPES`.
- **GREEN 07-13 ([Report] msg #28):** CI fully green **14/14 on fad24b8** incl. CUDA build/test jobs. Fix validated end-to-end on real CUDA HW — regression test confirms `--use_fast_math` now reaches NVRTC + invalid NVRTC option rejected (proves forwarding); both compile- & link-time paths covered. Numeric repro (~1.50→0.34ms) effectively CI-confirmed. PR body + issue comment updated. **Still DRAFT (correct — promote=human decision).** Awaiting maintainer review + slangpy-reviewer peer-review reply; webhook-driven to fixer. Blocker: none, clean holding state.
Canonical thread: `gh-issue-shader-slang/slangpy-1058`. [[feedback_no_double_dispatch_peer_wired]] [[feedback_let_fixer_own_single_session]] [[feedback_drafts_only_guardrail]]
