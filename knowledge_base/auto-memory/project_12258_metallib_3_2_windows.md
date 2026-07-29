---
name: project_12258_metallib_3_2_windows
description: "#12258 MetalLib 3.2 Windows toolchain upgrade — PARKED at triaged, maintainer-assigned"
metadata: 
  node_type: memory
  type: project
  originSessionId: 512904da-e6cc-4eb1-8841-5b9a577b0440
---

# #12258 — Upgrade Metal compiler support on Windows to MetalLib 3.2

**State (2026-07-29):** PARKED at triaged. Feature-request/enhancement, P2. Author=**jkwak-work** (maintainer); ASSIGNED to named human **jkiviluoto-nv**; no bot @-mention.

**Scope split (from triager):**
- **Bucket 1 — compiler code (fixer-doable, CI-verifiable w/o Apple toolchain):** add `metallib_3_2` capdef atom (`source/slang/slang-capabilities.capdef`, currently jumps `metallib_3_1`→`metallib_4_0`) + emit `-std=metal3.2` from the version *producer* at `source/slang/slang-code-gen.cpp:782-786` (today special-cases `metallib_4_0` only). The `-std=metalX.Y` derivation machinery ALREADY landed via #12096 / PR #12009. Fallback `-std=metal3.1` lives in `source/compiler-core/slang-gcc-compiler-util.cpp`.
- **Bucket 2 — infra/maintainer-owned (NOT bot-doable):** Windows Apple-Metal toolchain upgrade + Windows CI job producing a real `.metallib` + docs. **Gates the headline acceptance criteria** — a code-only PR does NOT close the issue.

**Disposition:** Triager POSTED verdict 5-bullet (comment 5111552640), set Issue Type=`Feature`, left human `CI Improvement` label. Fixer handed briefing but told to HOLD (no unprompted PR/reviewer). Orchestrator CONFIRMED park 07-29.

**Fixer caveats (re-verified memo at HEAD; matter only on code-portion release):** (1) local FileCheck can't discriminate `-std=metal3.2` from `3.1` — no Apple toolchain in bot CI, so the emit can't be end-to-end verified locally; (2) Approach A introduces a benign `3.0`→`"3.0"` `-std` string delta. Both folded into `triage-12258.md`.

**Related:** #12096 (PR #12009, `-std` machinery), #11032.

**Re-engage triggers:** explicit go from @jkiviluoto-nv/@jkwak-work, a linked PR, or substantive human comment. See [[feedback_reopen_not_release_parked_feature]], [[feedback_dont_close_open_proposals]].

Triage memo: `/workspace/inbox/a2a-1785287327225-xinrij/triage-12258.md` (triager's fs).
