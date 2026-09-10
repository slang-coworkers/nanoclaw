---
name: project_slangpy_1081_logger_deadlock_fix
description: "slangpy#1081 \"Logger deadlock fix\" (ccummingsNV) — approver ABSTAIN_POLICY OPEN_GAP shadow-mode"
metadata: 
  node_type: memory
  type: project
  originSessionId: fd154303-f640-4804-8dc5-4ebcd098b00c
---

# slangpy#1081 — Logger deadlock fix (ccummingsNV)

PR https://github.com/shader-slang/slangpy/pull/1081 — `pr_ready_for_review` webhook (opened) 2026-07-30. Routed to **slangpy-pr-approver** (never reviewer/fixer). Thread `gh-issue-shader-slang/slangpy-1081`.

**✅ MERGED** by ccummingsNV (squash `6565103625bb`, same tree as PR head `f2ef20c21eb8`). Human MEMBER tdavidovicNV independently APPROVED the merged head — approver's WOULD_APPROVE agrees (calibration join recorded via `record_human_verdict`, decision formed independently).

**R0 verdict @ head `c5d5ee70bc03`:** `ABSTAIN_POLICY` (reason `OPEN_GAP`) — recorded to ledger (mode=live). Shadow-mode → NO GitHub post.

**R1 verdict @ new head `f2ef20c21eb8`** (synchronize push): `WOULD_APPROVE` (CLEAN) — fresh ledger row (mode=live_late), passed critique gate. Synchronize commit was DOC-ONLY (logger.h contract wording; logger.cpp byte-identical to R0). The abstain→approve flip was NOT because code changed: R0 abstained on an *unverified* premise; R1 resolved it by reading fmt @ slangpy's pin (fmtlib/fmt `40626af88bd7` = v11.2.0) — `vprint_buffered` formats each line into a memory buffer then single `fwrite_all` under `flockfile`, so on POSIX/FILE* paths each built-in output's message is byte-atomic (no corruption/memory-unsafety; only benign line-ordering). Windows console/OutputDebugStringA paths not traced to per-message integrity, but no memory-unsafety path found. Devin ran head-current clean; CodeRabbit stale (ignored, exit 10) → fallback tier.

---
_Historical (R0 basis, superseded by R1 fmt-source verification):_

**Fix itself is sound:** breaks the `m_mutex`↔GIL lock-order deadlock by snapshotting outputs+name under the lock, then writing after release (refcount-safe — `Object::m_state` is `std::atomic`).

**Open gap (why abstain, not clear):** releasing `m_mutex` before `output->write()` newly permits two threads inside `write()` on the SAME output. Built-in outputs (Console/File/DebugConsole) share stdout/stderr/FILE* with no per-output lock (CodeRabbit 🟠 Major @ logger.cpp:280). PR's own new `logger.h` contract ("outputs must support multi-threaded calls") not satisfied by them. Bounded to log-line interleaving (not memory-unsafety/crash) → didn't rise to code-defect verdict, but residual uncertainty + real MT trigger ⇒ conservative-lean doesn't clear it. Maintainer decides whether built-in LoggerOutputs need per-output sync now.

**Basis:** fallback tier — no production github-actions[bot]/claude review posted; CodeRabbit harvested; Devin no flags in window. All 6 eligibility clauses pass.

**State:** CLOSED — merged & shipped, approver WOULD_APPROVE agrees with human. RE-OPEN only if a substantive human comment lands on the PR → re-route to slangpy-pr-approver on canonical thread. Related: [[project_slangpy_1075_texture_loader_sampler_heap]] (same ABSTAIN:OPEN_GAP pattern, shadow NO post).
