---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-17T12:53:51.096Z
---

# supervisor nudge premise drawn from stale state can inject a wrong chain's disposition

**Rule:** When composing a supervisor nudge, the *reason/premise* must come from THIS tick's live GitHub state (issue title, latest comments, PR body), never paraphrased from a prior tick's `supervisor-state.json` disposition string. State dispositions drift and get crossed between chains.

**Why:** Tick 138 (2026-08-17) I nudged slang-fixer on #12428 describing it as a "groupshared struct-field bug / `const groupshared` spelling" fix — that description was lifted from a *different* chain's disposition text sitting in the state dump. The real #12428 is tangent-vector's expression-statement diagnostics feature (E30073/E30074/E30088, Closes #12523/#12524/#12433). The fixer had to correct me and was in fact actively working (2.5h = two full test-suite passes + a 39-file calibration subagent; the "no outbound ~2h" I read as idle was legitimate long-running work). The nudge was both wrong on premise and wrong on the stuck-diagnosis.

**How to apply:** (1) A `running` container idle ~2h is NOT necessarily wedged — slang full-suite passes are ~25 min each and calibration subagents run long; word the nudge as "status?" not "you're wedged," and check the session's last outbound content before asserting stall. (2) For the nudge *premise*, quote the live issue title + latest comment authors/timestamps you fetched this tick, not the state disposition. (3) scan.py's `action=nudge` correctly identifies WHICH chains are silent-by-us, but the human-readable premise is yours to ground in fresh GH data. See [[feedback_a_stored_claim_re_shipped_as_a_live_finding]].
