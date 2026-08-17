---
title: "slang triage [Fix Report] may route via parent, not direct to triager"
type: learning
topic: agent-ops
source: learnings/1779884965191-slang-triage-fix-report-may-route-via-parent-not-d.md
---

# slang triage [Fix Report] may route via parent, not direct to triager

# slang triage: [Fix Report] may route via parent, not direct to triager

**Rule:** When a slang-triager chain forwards to slang-fixer and then waits, do **not** assume the [Fix Report] will return on the same direct edge that the [Triage handoff] used. The fix-side session often reports [Fix Report] **upstream to the orchestrator (parent)**, not back to the triager. Heartbeat noise from a stale parked fixer session can simultaneously land on the triager's inbox and look like the only signal. If you only watch the direct triager↔fixer edge, you will miss the actual outcome — possibly by hours — and emit a wrong "stalled" report.

**Why:**
On 2026-05-24 a triage chain for shader-slang/slang#10528 was forwarded to slang-fixer along with a memo. The fix landed at 08:43 IST on 2026-05-27 (PR #11265 Ready-for-Review, CI green) — but slang-fixer's [Fix Report] went to *parent*, not to me. The only direct messages I received afterward from slang-fixer were:
- 12:30 IST heartbeat: "No change (stored=20, new=20). Ending turn silently per watcher Step 5." — looked like benign idle noise.
- 17:51 IST: `[ede_diagnostic] result_type=assistant last_content_type=none stop_reason=end_turn` — looked like a session crash.

I read both as "fix not yet started, then chain crashed" and emitted a `[Triage chain stalled — infra]` report to parent recommending re-dispatch. Parent corrected me: the actual work session had completed and reported up; the diagnostic was from a separate, parked, stale session. Re-dispatching would have been wasted effort and a parallel-fix collision.

**How to apply:**
After forwarding to slang-fixer, before deciding the chain has stalled or failed, run an independent state check:
- `gh pr list -R shader-slang/slang --search "Fix #<issue>" --state all` → does a PR exist?
- If yes, `gh pr view <num> --json state,reviewDecision,statusCheckRollup,headRefOid` → is it Ready-for-Review with green CI?
- Treat heartbeat / `ede_diagnostic` messages on the direct edge as **non-authoritative** about chain progress when an upstream PR exists.
- Only emit a "stalled" report after both edges (direct + PR ground truth) say so.

The triage→fixer→parent topology means fixer's "done" signal naturally goes up the chain, not back across to the triager. Plan for that.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1779884965191-slang-triage-fix-report-may-route-via-parent-not-d.md`_
