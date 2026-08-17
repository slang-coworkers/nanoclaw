## 🩺 Issue-chain supervisor — Tick 167 · 2026-08-15 12:00 UTC

**362** in-flight (open) · **525** closed-archived · 16 🆕 / 37 🔼 / 309 • · **33 must-nudge → 32 sent + 1 phantom skipped**

### ⚙️ Root-cause fix shipped this tick (self-modification — please review)
~15 PR chains had been re-firing `awaiting_us` "human spoke last" nudges every tick, immune to coworker replies. **8 fixers + the triager + pr-approver independently reported the same cause; I verified it with my own GitHub receipts:** `jhelferty-nv`'s `pr-board-sync-assignment` **do-not-reply** notices post as `type=User`, and `scan.py`'s administrative-comment filter (which matches those on comment *body*) was **inert because `pull-universe.sh` never fetched/emitted comment `body`**. Added `body` to all 3 GraphQL selections + 3 emit sites in `pull-universe.sh`. Functional diff confirms the board-sync comment now classifies `ball='human'` (parked) vs `'ours'` (nudged) before; all 33 scan.py tests pass; genuine reviews (e.g. tangent-vector's CHANGES_REQUESTED on #12421) unaffected. **Effective next tick.** Learning recorded.

### Actionable chains this tick (all 33 nudge/escalate rows)

| repo/issue | pr | last-us | state | Δ | → owner |
|---|---|---|---|---|---|
| slang-12336 | 12336 | 13h | awaiting_us | 🆕 | slang-fixer |
| slang-12421 | 12421 | 16h | awaiting_us | 🆕 | slang-pr-approver |
| slang-12547 | — | 13h | awaiting_us | 🆕 | slang-fixer |
| slang-12548 | 12548 | 9h | awaiting_us | 🆕 | slang-pr-approver |
| slang-12549 | — | 14h | awaiting_us | 🆕 | slang-fixer |
| slang-12550 | — | 13h | awaiting_us | 🆕 | slang-fixer |
| slang-12553 | 12559 | 2h | awaiting_us | 🆕 | slang-triager |
| slang-12554 | — | 6h | awaiting_us | 🆕 | slang-fixer |
| spec-61 | 61 | 15h | silent ⚠ESC | 🆕 | slang-pr-approver |
| slang-12307 | 12310 | 2h | awaiting_us | 🔼 | slang-fixer |
| slang-12371 | 12382 | 23h | awaiting_us | 🔼 | slang-fixer |
| slang-12387 | 12552 | 2h | awaiting_us | 🔼 | slang-triager |
| slang-12391 | — | 23h | awaiting_us | 🔼 | slang-triager |
| slang-12406 | — | 23h | awaiting_us | 🔼 | slang-triager |
| slang-12428 | — | 18h | awaiting_us | 🔼 | slang-triager |
| slang-12428/maintainer-directive | — | 2d | awaiting_us | 🔼 | slang-triager |
| slang-12443 | 12479 | 23h | awaiting_us | 🔼 | slang-fixer |
| slang-12482 | 12504 | 23h | awaiting_us | 🔼 | slang-fixer |
| slang-12483 | 12508 | 1h | awaiting_us | 🔼 | slang-fixer |
| slang-12484 | 12538 | 23h | awaiting_us | 🔼 | slang-fixer |
| slang-12485 | 12519 | 23h | awaiting_us | 🔼 | slang-fixer |
| slang-12496 | 12509 | 1h | awaiting_us | 🔼 | slang-fixer |
| slang-12498 | — | 23h | awaiting_us | 🔼 | slang-fixer |
| slang-12525 | 12533 | 23h | awaiting_us | 🔼 | slang-fixer |
| slang-12532 | 12537 | 22h | awaiting_us | 🔼 | slang-fixer |
| slang-12540 | — | 24h | awaiting_us | 🔼 | slang-fixer |
| slang-11612 | — | 61d | silent ⚠ESC | • | slang-triager |
| slang/slang-12371 | — | 8d | silent ⚠ESC 🚫SKIP | • | slang-triager |
| slang-12458 | — | 32h | awaiting_us | • | slang-triager |
| slangpy-222/upstream-slang-rhi | — | 35h | awaiting_us | • | slangpy-fixer |
| slang-vscode-extension-70 | — | 46d | awaiting_us | • | slang-fixer |
| slang-8822 | — | 47d | awaiting_us | • | slang-fixer |
| slang-9125 | — | 8d | awaiting_us | • | slang-triager |

### 📋 Summary
- **Status:** 362 in-flight chains, **32 nudges sent** (19 slang-fixer · 9 slang-triager · 3 slang-pr-approver · 1 slangpy-fixer), 2 operator-escalations flagged below. `worktree-vol: 43G free (/workspace), 171G free (/ephemeral)` — no GC pressure. CI cells not enriched this tick (pull-universe CI-lane fetch was skipped for cost; classification used activity/ball only).
- **Verdict:** The dominant pattern (~15 of 33) was **false-positive nudges** from the board-sync-body defect above — now fixed at the source. Confirmed *true* positives that correctly woke stalled work: #12550/#12554 (fixer actively mid-fix, draft PRs imminent), #12458 (triager releasing fixer for a PR), #12421 (real `tangent-vector` CHANGES_REQUESTED — author/reviewer loop owns it).
- **Next-action:** Two chains genuinely silent ≥4h → **operator escalation**: **spec#61** (PR #61, approver ABSTAIN_POLICY:OUT_OF_SCOPE recorded — merit is a maintainer language-design call, no code-review signal; ~15h) and **slang#11612** (silent **61d**, 4 prior nudges + 2 prior escalations, no artifact — a genuine abandon/close candidate). Neither is bot-actionable.
- **Blocker:** Several approved+green PRs (#12508 #12519 #12483 #12496) are **maintainer-merge-gated** — fixers report done, awaiting a human merge/ready-flip they're barred from. #12538/#12504 draft PRs await operator `gh pr ready` authorization (previously escalated 08-14). Falcor CI lane on #12519's chain needs a **maintainer to approve the `falcor-ci` protected-environment deployment** (`current_user_can_approve=False`) — reported by fixer, purely an authorization step (master shows test-falcor green).
- **Phantom/invariant note:** `must_nudge=33` but **32 sent** — the 1 gap is `gh-issue-slang/slang-12371`, a **malformed-key phantom** (repo `slang/slang` doesn't exist; owner `shader-slang` was dropped by a prior tick's composed key). It was **deliberately not nudged** (waking a disconnected session risks a repeat of the 08-07 spurious-comment incident); its **real** counterpart `shader-slang/slang-12371` WAS nudged. Documented gap, not a silent drop → not a SUPERVISOR INVARIANT VIOLATION.
