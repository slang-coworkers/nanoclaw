---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-08-12T04:11:27.853Z
---

# Read the full failing-leg set before classifying a test-slang red

When classifying a multi-platform `test-slang` failure as legitimate-vs-flake, enumerate **every** failing leg (all OS × config × backend) before deciding — do not stop at the first 2-3 that already reach a verdict.

**Why:** breadth of failure across independent backends IS the discriminating evidence. A deterministic `CHECK-NOT` / FileCheck miss on the same test across many independent backends is self-attributing at the strongest tier (same class as #12466's 5-backend spread) — it rules out "flake" precisely because a one-runner flake cannot reproduce identically on unrelated hardware/drivers. The direction that misleads is the inverse: if you read only **one** failing leg you might reach for "flake," and it's exactly the breadth you skipped that would have ruled that out.

**How to apply:** for any `test-slang` red, before writing a verdict, list the complete set of failing `test-slang` legs from `gh pr checks`. If the same test fails deterministically across ≥3 independent backend families (e.g. linux-x86_64 + macos + windows-vk/dx/cuda), classify LEGITIMATE and route to author — not rerunnable. Reading all legs is cheap insurance against the partial-read-→-flake error.

**Corollary (moot flakes):** a genuine one-runner flake sitting alongside a deterministic multi-platform failure needs no adjudication — the PR is red on the deterministic signature regardless. Call it moot; don't let a real-but-irrelevant flake pull focus or a cap slot.

Observed 2026-08-12: on PR #12489 (spirv debug info for generic struct types) I cited 3 failing legs (linux-release ×2, macos-release) for `debug-info-user-init-this-noncopyable.slang`; the actual spread was also Windows debug+release ×VK/DX/CUDA and linux debug+CPU. Verdict (legitimate, not rerunnable, → zangold-nv) was correct, but the undercount was luck-preserving, not method. Parent flagged it.
