---
title: "scan.py disposition suppression must apply on all ball branches"
type: learning
topic: misc
source: learnings/1784464263683-scan-py-disposition-suppression-must-apply-on-all-.md
---

# scan.py disposition suppression must apply on all ball branches

**Fixed 2026-07-19 (supervisor Tick 93).** `scan.py::classify` only consulted the human-owned disposition on the `ball=="human"` path (via `we_owe_next_step`). The `ball=="ours"` and `ball=="none"` branches nudged/escalated **unconditionally**, so every maintainer-last or no-comment PARKED chain (advisory:maintainer-driving, awaiting_human, pr_open-held, stood-down, triaged:awaiting-pickup, CI-anchor) re-flagged as `awaiting_us`/`silent-escalate` every tick — contradicting `compute_non_nudge_reason`'s own docstring ("a human-owned disposition never reaches needs_nudge").

**Fix:** hoisted a single `human_owns_disposition(chain)` guard to the TOP of `classify()` (before the ball dispatch) → returns `awaiting_human`, needs_nudge=False on any parked disposition, all three branches. Also widened `HUMAN_OWNED_DISPOSITION` tokens: added `awaiting_human`, `pr_open`, `maintainer-owned`, `maintainer-assigned`, `awaiting-classification`, `lingering session`. Added `BallOursDispositionSuppression` test class (5 cases) locking it; 36/36 pass.

**Impact this tick:** mechanical `needs_nudge` fell 94→77 (bot re-tag) →49→42 (disposition-hoist) →0 (after backfilling verified park dispositions). All 42 mechanically-flagged chains verified against live GitHub as parks (maintainer-assigned/driving, our-PR-awaiting-review, CI-babysitter anchors #12137/#12145, or closed zombie recovery-2). Zero were genuine stalls.

**Two upstream data gaps scan.py still can't see** (require the agent to backfill disposition each tick, or pull-universe to enrich):
1. **pull-universe mis-tags `github-actions` and `coderabbitai` as `is_bot:false`** → their bot comments read as human-last, flipping ball to `ours`. Re-tag known bot logins (github-actions[bot], coderabbitai, CLAassistant) to `is_bot:true` before scanning. `nv-slang-bot` is already correct.
2. **pull-universe emits naive space-separated timestamps** (`2026-07-09 17:15:44`, no Z) from prior-state rehydration → scan.py crashes on naive-vs-aware `max()`. Normalize to ISO-UTC-Z before piping to scan.py.

Both fixes belong in `pull-universe.sh`; until then the supervisor patches the payload in-flight. See [[feedback_scan_py_overflags_bot_logins_dispositions]].

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1784464263683-scan-py-disposition-suppression-must-apply-on-all-.md`_
