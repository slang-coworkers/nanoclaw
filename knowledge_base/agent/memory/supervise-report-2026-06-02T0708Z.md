# Issue-chain supervision — 2026-06-02T07:08Z (07:00 cron fire)

**Re-verification run.** No material change since the 06:11Z fire. 11 chains in flight, 0 silent/stuck, 0 new nudges, 0 new escalations. GitHub observability intact for every chain. Verdict: **DEGRADED** — sole degrader is the 4 duplicate-PR pairs awaiting an operator dedup decision.

## What I verified this run (GitHub API @ 07:08Z)

- **All 8 dup-pair PRs still OPEN** — 4 drafts (#11386, #11371, #11387, #11379) + 4 ready (#11394, #11397, #11377, #11398). No merges, no closes → **operator has not yet acted** on the cleanup escalation (raised 03:37Z for 3 pairs; 4th pair #11374 folded in 06:11Z). First escalation is ~3.5h old — under the 4h hard re-surface threshold, so I did **not** re-fire (anti-pattern: don't loop a pending decision).
- **Shipped PRs all still open:** #11389 (11356), #11373 (11372), slang-rhi#765 (762), nanoclaw#522 (511).
- **All originating issues OPEN** (11339, 11356, 11366, 11367, 11370, 11372, 11374, 11375, 11399).
- **11399** still has no PR; fixer last observed building at 06:35Z (~33m ago, under 60m fixing threshold). Build ETA (~20m) has slightly elapsed but not stuck — leave alone, watch next tick.

## The 4 duplicate-PR pairs (pending operator)

Each pair = a manual `fix/issue-NNNN` **draft** + an automated `dev/slang-fixer/fix-NNNN-*` **ready** PR for the same fix. Root cause: 2026-06-01 manual dispatches created drafts on top of the automated slang-fixer pipeline's PRs (cross-path duplication).

| issue | draft (close) | ready (keep) | note |
| --- | --- | --- | --- |
| 11367 | #11386 | #11394 (reviewers jhelferty-nv, bmillsNV) | one-line `-render-feature bindless` |
| 11370 | #11371 | #11397 (reviewer bmillsNV) | OutputLinesEXT / isoline-tess |
| 11374 | #11387 | #11377 | readNone derivative carry-gate |
| 11375 | #11379 | #11398 (reviewers bmillsNV, jvepsalainen-nv) | kIROp_BoolLit in slang-emit-vm. **#11379 also has `desc-handle-4.slang` test that #11398 lacks — port it before closing #11379.** |

**Recommendation (unchanged):** close the 4 drafts, keep the 4 ready PRs, add a dedup guard so manual dispatch checks for an existing `dev/slang-fixer/*` PR before opening a draft.

## Other chains (all healthy / leave alone)

- **11339** (triage) — AWAITING_HUMAN, proposal posted, awaiting @jkiviluoto-nv sign-off. 2 nudges used, comment present.
- **11356 / 11372** (fixer) — SHIPPED pr_open (#11389 / #11373), no dup. Sessions heartbeating.
- **11366** (triage) — CLOSED-HANDED-OFF, needs org-GHCR-admin (@jkiviluoto-nv). Verdict comment present.
- **slang-rhi-762** (fixer) — SHIPPED pr_open (#765), idle 2.9d, work done.
- **nanoclaw-511** (nanoclaw) — SHIPPED pr_open (#522).

## Next tick

- Re-check the 4 dup pairs for operator action; if first escalation crosses 4h with no action, consider a single re-surface.
- Watch 11399 for a PR or a stall past the 60m fixing threshold.
