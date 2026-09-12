---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-09-12T03:00:38.195Z
---

# supervise-issues: awaiting_us is ~90% false-positive at scale — bot-last mislabeled, draft-held PRs the real bottleneck

**Measured tick 219 (2026-09-12):** of 53 routable `awaiting_us` nudges sent, ~40 coworkers replied with **live-verified GitHub state** and ~90% were false positives. scan.py classifies "our bot was the last actor + issue still open" as `awaiting_us` (ball=ours → needs_nudge), but in reality the ball is with a **human maintainer** or the chain is **terminal/by-design-silent**. This inflates must_nudge ~50–120/tick and fires a false-nudge storm every 12h.

**The real buckets behind "awaiting_us":**
1. **Draft-held PRs (dominant, ~16 this tick):** fixer opens a bot PR as *draft* by default → Slang CI `wait-for-human-priority` gate marks all jobs `skipping` → maintainers never see it in the review queue → it ages 18–27 days with zero human engagement. The ONLY unblock is `gh pr ready`, which fixers treat as **operator-gated** and refuse to self-run. So the whole pipeline dead-ends at "reviewed, draft, waiting for a promotion nobody is authorized to do." *This is the highest-value systemic fix: either grant fixers ready-flip authority, or route a periodic operator batch-approval of clean draft PRs.*
2. **Approved/green PRs awaiting maintainer merge** (bot-last after CI/approval) — correctly `awaiting_human`.
3. **Closed-at-triage with intentionally-suppressed GitHub comment** (core-team-member-authored ops/perf sub-issues, e.g. epic #12941 children #12942–12962) — no bot outbound by design → look "silent" forever. Need a terminal disposition, not a nudge.
4. **Terminal:** deleted issues (HTTP 410, e.g. #12624 — GraphQL "Could not resolve" and NOT auto-archived), closed-not-merged PRs, PRs that aren't ours (core-team member's own PR, no bot mention).

**Fix for the tooling:** scan.py `classify()` should treat bot-last (`ball=='human'`) as `awaiting_human` unless a fixer genuinely owns an artifact-less dark chain — the current fixer-owned carve-out is over-firing on draft-held PRs (a draft PR *is* the resumable artifact; it's awaiting a human, not us). Also: (a) map a deleted-issue (410 / GraphQL-unresolvable) to terminal-archive; (b) recognize a `stood-down:closed-at-triage`/suppressed-post disposition class.

**Operational response that works:** don't send 40 per-chain acks (echo-noise). Instead (1) set human-owned dispositions in supervisor-state.json (`advisory:maintainer-driving`, `stood-down:draft-held`, `closed-by-us:...` — tokens scan.py's HUMAN_OWNED_DISPOSITION honors → next tick classifies awaiting_human, no nudge); (2) send ONE consolidated operator escalation with the draft→ready batch + the genuinely-stuck operator-gated acks (a maintainer-ack on the slang-rhi coop-mat2 PR had been escalated Sep-3 and never relayed — 199h). Nudges are not wasted though: a minority (#12405, #12653, #12608, #12987, #12549) productively woke real fixer/triager work (rebases, re-dispatches).
