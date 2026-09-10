---
name: project_12105_mimalloc_windows_malloc_free
description: PR
metadata: 
  node_type: memory
  type: project
  originSessionId: 8bbc00d6-12db-4102-bab3-edb2d6a8578d
---

PR shader-slang/slang#12105 "Use mimalloc for Slang-owned malloc/free on Windows" (pdeayton-nv, CONTRIBUTOR). Follow-on to the mimalloc-for-core line — see [[project_11925_mimalloc_core_parked]], [[project_12102_mimalloc_download_configure_error]], [[project_12101_mimalloc_all_platforms_parked]].

**Approver verdict (shadow-mode, ledger-only):** WOULD_APPROVE / CLEAN @ head `d50a386239eb`. The "opened"-event head `2c8907bdefec` was force-pushed away before its decision cleared the critique gate — no ledger row for it; only `d50a386239eb` (synchronize) recorded.

- PRIMARY (production claude-code-action @ pinned head, diff 7c0321fef96c): 🟡 4 gaps / 0 bugs — allocator pairing, ZIP overflow guards, ownership-transfer verified memory-safe; all findings doc/comment/test-effectiveness gaps, not correctness bugs.
- Devin 0/0; CodeRabbit 1 pre-existing Cygwin nit. All 6 eligibility clauses pass (v0-shadow-relaxed); 4 primary gaps dispositioned advisory.
- **Human-verdict join: clean agreement** — maintainer jkwak-work APPROVED @ this exact head (2026-07-14T23:55:23Z). WOULD_APPROVE ↔ APPROVED.

**State:** await merge / terminal join. Re-record on merge/close. Windows test-slang jobs were in_progress at decision — policy does not require CI green (relaxed).

**Update 07-15 22:15Z:** `ready_for_review` webhook (draft→ready) — but head ADVANCED to `a29c7d7b609f` (pushed 22:10:48Z), a PURE REBASE onto master (+12 commits, behind 1); all 17 PR-owned files byte-identical to `d50a386239eb` (same diff_hash 7c0321fef96c, codex confirmed identical patch IDs). Approver treated as a fresh revision — new ledger row for `a29c7d7b609f`.

**Update 07-15 22:50Z — RE-DECIDED @ `a29c7d7b609f`: WOULD_APPROVE / CLEAN.** PRIMARY (production claude-code-action, non-stale): 🟡 minor — 1 test-coverage gap, 1 clarity note, 0 bugs; allocator pairing traced end-to-end, sound. Devin 0/0. All 6 clauses pass; both findings advisory. Cleaner than prior head's 4 gaps on identical code (earlier extras were doc-wording, not re-flagged). **Human join: clean agreement** — jkwak-work's APPROVED carried across the pure rebase to point at `a29c7d7b609f`. Primary settled 22:41:56Z (waited out delayed primary, no fallback).

**Update 07-16 07:33Z — synchronize; head → `126161354dfa` (pushed 07:30:20Z), DIFF ACTUALLY CHANGED (not a pure rebase).** Changed-file set 17→19; prior 17 byte-identical, plus two build files:
- `external/CMakeLists.txt`: Debug-only knob — when mimalloc enabled & `MI_DEBUG_FULL` unset, set `MI_DEBUG=1` (down from mimalloc default level-2) to speed Debug while keeping basic heap diagnostics.
- `tools/CMakeLists.txt`: allocator unit-test target `INCLUDE_FROM_PRIVATE slang core` → `LINK_WITH_PRIVATE core` + `INCLUDE_FROM_PRIVATE slang` — the test now actually LINKS core (mimalloc PUBLIC), **directly closing the primary review's test-effectiveness gap** from the prior head.
Real new revision → full clean re-run (fresh harvest + Devin, ~15min debounce, wait delayed primary, clauses + challenger + critique gate, new 4th ledger row). New decision pending.

**Update 07-16 08:05Z — RE-DECIDED @ `126161354dfa`: WOULD_APPROVE / CLEAN** (4th row; new diff_hash `7af5a325f8cb`, was `7c0321fef96c`). PRIMARY: 🟡 minor — 2 test-coverage gaps, 5 clarity items, 0 correctness bugs; re-verified allocator pairing end-to-end + positive proof (miniz `finalize_heap_archive` transfers ownership & NULLs buffer ⇒ no double-free; `items*size` guards correct). Devin 0/0. All 6 clauses pass; all 7 findings advisory. codex confirmed both new build hunks correct. NO human agreement join at decision time — jkwak-work's prior APPROVED was DISMISSED by the content-changing push. Primary settled 07:56:41Z.

**TERMINAL 07-18 00:38Z — MERGED / row-4 VINDICATED.** jkwak-work merged at head `126161354dfa` (2026-07-18T00:31:22Z, squash `aaa07fe2` onto master) = exactly the last-decided row-4 head. A fresh jkwak-work APPROVED landed at that exact head (2026-07-17T20:27:54Z) before merge → **clean agreement** (WOULD_APPROVE ↔ APPROVED); human_verdict=APPROVED recorded on row 4. The 7 advisory findings (2 test-coverage + 5 clarity, 0 bugs) shipped as-is (merged head == decision head, no post-review commits) — confirms the "0 bugs / doc-comment-test-effectiveness gaps only → WOULD_APPROVE" disposition. Chain terminal.
