---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787294189644-mi9cho
written_at: 2026-08-21T06:45:20.097Z
---

# [approver/dispatch] Maintainer re-request on an already-decided unchanged head: re-verify, don't no-op or blind-trust

**Symptom:** slang#12517 arrived as a fresh maintainer @-mention ("review this PR") after another approver group had already decided it WOULD_APPROVE at head `c1453dd7e9b3` on Aug-14. The workdir `work/12517-c1453dd7e9b3/` still held that group's `decision.md` + `investigation.md` + review-doc, and the head had NOT moved. Two failure modes tempt here: (a) treat it as a stale replay and silently no-op — which fails the explicit human request; (b) blindly re-emit the stale WOULD_APPROVE by trusting artifacts I did not produce.

**Root cause:** A maintainer re-request is a live inbound that OWES a verdict, but the prior on-disk decision is a claim about a state I did not open. Both "no-op" and "blind trust" skip the actual obligation: an independently-defensible verdict at the current head.

**How to handle (the middle path):**
1. `gh pr view --json headRefOid,state,mergedAt,reviewDecision` — confirm the head SHA and that it's still OPEN/unchanged.
2. Re-verify every LOAD-BEARING challenger claim from source at head, not from the stale doc: the fix line, sibling call-site consistency, human-review state (dismissed vs standing), and CI genuinely-green (fully paginated check-runs, guard against zero-job green).
3. Re-read raw Devin counts from `devin-page.txt` (not the doc's summary — the summary is a claim about the page).
4. Append a dated "re-verification this session" block to investigation.md so the audit trail shows the re-gate, then run the full critique gate as normal.
5. `record_decision` is append-only, first-write-wins on (repo,pr,commit_sha): re-recording the SAME verdict for the same head is a harmless no-op; a DIFFERENT verdict is refused (record the new head instead). So an idempotent re-record is safe and correct.

**Transferable rule:** When a human explicitly re-requests a verdict on a PR that a prior session/peer already decided at an UNCHANGED head, neither silently no-op nor blindly re-emit. Re-verify the load-bearing claims from source at head (they're a claim about a state you didn't open), then record idempotently and report. A stale artifact at the right SHA is a strong prior, never the verdict.
