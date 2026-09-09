---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-29T13:01:26.909Z
---

# supervise-issues scan.py over-flag is 3 concrete classifier defects, not noise

**Context:** The `/supervise-issues` scan.py reported `must_nudge≈250` with "0 genuine nudges" for 9 consecutive ticks (through Tick 194, 2026-08-29), each dismissed as a "known scan.py over-flag." That framing is wrong — it's 3 fixable code defects, all reproduced with GitHub receipts:

1. **`bot_logins` is a closed 2-entry set** (`nv-slang-bot`, `nv-slang-bot[bot]`) in `scripts/pull-universe.sh` line ~106. `github-actions` (production claude-code-action review bot) and `coderabbitai` lack the `[bot]` suffix in GraphQL author.login, so `is_bot` stamps them False → `compute_ball` reads their comments as *human-last* → ball flips "ours" → false `awaiting_us`. Patching the flags dropped awaiting_us 238→193 (45 false rows). Fix: expand the set to include `github-actions`, `coderabbitai`, `devin-ai-integration`, `CLAassistant`.
2. **`compute_ball` reads only `chain["comments"]` (issue comments), never PR reviews.** An APPROVED draft PR (jkwak/juliusikkala/tangent-vector) still reads as `awaiting_us` because the approval is a review, not an issue comment. ~12 rows. Fix: fold PR reviews/PR comments into the ball computation and treat APPROVED as not-our-ball.
3. **The `ball=="ours"` branch never consults `disposition`** — only the `ball=="human"` carve-out (`we_owe_next_step`) does. So a chain explicitly marked `advisory:maintainer-driving` re-flags every tick the moment a maintainer comments. 39 rows. Fix: check HUMAN_OWNED_DISPOSITION in the `ball=="ours"` path too.

**Durable stopgap** (until scan.py is patched): write a HUMAN_OWNED-token `disposition` (`advisory`/`stood-down`/`triaged: awaiting-pickup`/etc.) into supervisor-state.json for each false-positive chain. pull-universe.sh rehydrates `disposition` (not `github_artifact_url`) each tick, and `we_owe_next_step` honors it — so the write suppresses via the tested path. **The prior 8 ticks audited these off but never persisted the disposition, which is exactly why it recurred.**

**GENUINE signal the "all-false-positive" refrain buried:** among the ~63 fixer-owned no-PR nudge rows, ~14 carry an explicit owed-PR promise in the bot triage artifact ("A draft PR will follow" / "Fix in progress; a draft PR (Closes #N) will follow") with **no PR** (`gh pr list --head fix/issue-N` empty) and a **stopped fixer** — the #12002/#12059 shape the carve-out exists to catch. Lumping them with the parked/analysis chains hid a real backlog. Nudge the never/≤1-nudged ones; escalate the 2×-nudged-still-dark ones to the operator.

**Discriminator that separates promise from parked:** don't grep loosely for "design/maintainer" (nearly every triage mentions them — over-matches). Read the last bot comment's **Blocker/Next** lines: a promise says a *fix PR will follow*; a park says *won't-fix / by-design / handed to maintainer / awaiting-maintainer / deferred*. **Caution:** even the tighter grep over-includes — Tick 194 nudged #12789 whose /slang-plan verdict was actually **Approach C (defer, keep issue as tracking, no PR by design)**; the empty branch was expected. The fixer caught it against live GitHub state. When in doubt on a promise-classified chain, verify the plan verdict before nudging, and retract cleanly if wrong.
