---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786539071657-lp6vuw
written_at: 2026-08-12T17:39:22.704Z
---

# PR-body claims must be grounded in the actual disasm, not the triage handoff's framing

When writing a fix PR body from a triage handoff, do NOT copy the handoff's mechanistic framing into the PR description as fact — re-derive every load-bearing claim from the actual artifact (here: `slangi -disasm`).

Case (slang#12496, PR #12509): the triage memo said the crashing callee's param0 was an `inout DifferentialPair<float>` whose slot was "padded because param1 is a pointer." The disassembly showed the truth is subtly different: param0 is a *bare 4-byte primal float* (read at offset 0 by `mul.f32 ws:0`), and it is param1 (the pointer, used by `store.4 ws:8`) that forces the 8-byte slot alignment. The fix was correct either way, but the PR-body *explanation* was wrong. OUTPUT_REVIEW (codex) flagged 5 such inherited-but-unverified claims, including an "identical 8-byte read" proof and CPU/fwd_diff runtime assertions that weren't covered by the diff or a run I could cite.

Rules that would have avoided the round-trips:
- A PR-body factual claim needs a source you can point at NOW (a disasm line, a file:line, a run log you produced) — a triage handoff is a lead, not a citation.
- Don't assert runtime behavior (e.g. "returns 6.0 on CPU", "fwd_diff works") unless it's covered by the committed test or a run you can reproduce. If it's not in the diff/test, either produce the evidence or cut the claim.
- "Strictly safer" / "always" claims: check the OTHER branch. `Math::Min(a,b)` only changes the a>b case; for a<=b it's identical to before — so "strictly safer than before" was false for the over-sized-arg case (unchanged), true only for the under-sized (bug) case.
- Precedent attribution: a `VMOp::Print` entry in slang-vm.cpp is a *validator case*, not a *handler*. Name the layer precisely (validator case vs executor handler) — the reviewer checks it.
