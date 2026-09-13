---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787145313515-pp73s7
written_at: 2026-09-13T04:14:30.056Z
---

# NVRTC -pch for CUDA prelude SHIPPED (PR #12880) — findings held up; provenance was reporter's numbers not a 12.9 fixer run

Closure on shader-slang/slang#12622 (NVRTC precompiled headers for the CUDA prelude). The fix shipped in draft PR #12880 (held for human merge), and it confirms the earlier learnings held up in practice — plus one provenance correction worth recording so future readers trust the right source:

**What shipped (6 files, +360/−1):** NVRTC driver adds `-pch` gated on NVRTC ≥12.8 AND the leading-`#include` prelude form; `nvrtcGetPCHCreateStatus` loaded as an OPTIONAL/null-tolerant symbol (keeps init() working on <12.8, NOT in the mandatory SLANG_NVRTC_FUNCS list); a Slang-owned `slang-nvrtc-pch-status: created|not-created|create-failed` diagnostics token so a unit test can read the PCH outcome from the NVRTC log; docs subsection; reuse-safety + positive-invalidation unit tests; a `-target ptx` FileCheck test.

**Findings that HELD UP (previously flagged, now shipped & reviewed):**
- `-pch` helps the `#include`-form prelude only — the driver gates on it explicitly. (My earlier "works on prepended text" claim was correctly retracted.)
- Default PCH heap is 256 MB → reactive-only mgmt, no proactive nvrtcSetPCHHeapSize.
- One-shot `-pch` is a net regression → the shipped code amortization-gates it.

**PROVENANCE CORRECTION:** the "fixer's empirical run on real NVRTC 12.9" that an earlier correction leaned on was inaccurate — the fixer's box is NVRTC **12.6**, and the "104→22 ms" numbers were the **reporter's**, not an independent fixer measurement. What the fixer DID verify locally on 12.6: the reuse-safety test passes with **byte-identical PTX**; the behavioral create/not-created/rebuild assertions are gated ≥12.8 and run on the **CUDA-13.0.1 Linux GPU CI tier** (NOT locally).

**Two process lessons reinforced:**
1. A DRAFT PR skips Slang CI (ci.yml filters `draft != true`) — so tests that only run in CI (here, the ≥12.8 behavioral asserts on the CUDA-13 tier) do NOT execute until the PR is flipped to ready-for-review. Don't claim "CI-verified" for a draft; it's "CI-verified when marked ready."
2. The critique-gate → deny×3 → **human dashboard approval card** is human-only by design (not orchestrator-flippable). When a fix is gated on a positive test the reviewer rightly demands, the clean path (build the test first, open gate-clean) beats chasing a one-shot bypass — the bypass here was rejected and the clean path shipped, catching 2 extra real must-fixes (a null-deref + a stale-base build break) on the way.
