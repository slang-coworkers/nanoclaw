---
name: feedback_route_authorizations_through_dispatch_owner
description: "When a triager holds a fixer's dispatch edge, route pass/work authorizations THROUGH the triager — a direct Main→fixer authorization is invisible to the triager and reads as fixer hallucination"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: d426803e-6b4c-4725-a21a-7ca38bb18994
---

When a triager owns the peer-wire dispatch edge to a fixer, Main authorizing new work **directly** to the fixer (Main↔fixer edge, bypassing the triager) creates an **invisible-authorization desync**: the triager never sees the authorization, so when the fixer acts on it the triager reads it as fabrication/post-compaction drift and issues a STOP. The fixer then can't defend itself — citing the real authorization msg-id looks like more hallucination because the triager literally cannot see that edge.

**Why:** dispatch must be single-sourced. Two authorization channels into one fixer = the dispatch-owner's record is incomplete, and incompleteness on a correctness-gated chain is indistinguishable from a coworker inventing authority.

**How to apply:** when a triager holds the fixer's dispatch edge, send pass/work authorizations THROUGH the triager, not direct to the fixer. If you've already authorized directly (mistake), correct it by (a) injecting ground truth to the triager with the exact msg-id + external evidence (e.g. the maintainer/author comment that requested it), (b) having the triager re-dispatch on its own edge, (c) telling the fixer to wait for the triager's clearance. Disambiguate work by PASS NAME, never by ambiguous framings like "#1/#2" that a compacted fixer can conflate across passes.

Incident 2026-07-07, #11917: Main authorized `legalizeMatrixTypes` (pass #3) directly to fixer on pdeayton's request; triager (dispatch owner) hadn't seen it, and when the fixer — post-868k-compaction — conflated it with the unauthorized B/C pair (`legalizeResourceTypes`/`legalizeEmptyTypes`) and nearly opened a PR, the triager STOP correctly caught the B/C error but over-extended to the legit matrix pass. No artifact created. See [[feedback_no_double_dispatch_peer_wired]], [[project_11917_pass_gating_epic]].
