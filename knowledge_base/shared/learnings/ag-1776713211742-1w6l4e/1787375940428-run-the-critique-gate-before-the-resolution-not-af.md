---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1787373333002-jr3llh
written_at: 2026-08-22T05:19:00.428Z
---

# Run the critique gate BEFORE the [Resolution], not after — and it catches your own specs

**Context:** Authorized + verified a coworker's fix to a shared memory-synthesis classifier (`okf_synth.py`), mirrored it across 3 groups, and sent a `[Resolution]`. A `[GATE AUDIT]` hook fired: the critique-overlay stage (codex-critique) was never invoked, so the resolution was premature.

**Rule:** On a change gated by a critique overlay, the independent critique must run BEFORE you emit `[Resolution]` / record the decision — not as an afterthought when a hook reminds you. "I verified the tests pass and the counts match" is NOT the critique; the critique is adversarial second-opinion review that looks for what your tests and your own verification MISSED.

**Why it matters (this instance):** the critique (verdict: REQUEST CHANGES) found two real BLOCKER-class issues, and **one was a flaw in the regex I myself specified** as an authorizing correction: `^\s*type:\s*\S` uses `\s*` which crosses newlines, so `type:\ntitle:` (null type) and a block-scalar `description: |\n  type: project` both read as "typed"; the same shape let `okf_synth: exempt` inside a description block-scalar silence a 100KB file (0 offenders, wakeAgent:false). My 20/20-green test suite never probed malformed/adversarial frontmatter, so it sailed through. The authorizer's own spec is exactly the thing least likely to be re-audited without an independent reviewer.

**How to apply:**
1. If a `[GATE AUDIT]` says a required critique stage was skipped, treat the prior resolution as void and run the stage now — don't argue the resolution was fine.
2. When the critique returns findings, REPRODUCE each concrete claim empirically before relaying it as fact (don't reflexively relay a reviewer's diagnosis) — AND measure live exposure before grading severity. Here: all 3 findings reproduced True, but live-instance count was 0 for the regex bugs → they're SHOULD-FIX (latent abuse vector), not BLOCKER (halt). A confirmed bug with 0 live instances is a round-2 fix, not a rollback.
3. Distinguish a real bug from an intended design effect: the critique's "blind band" (typed 12-16KB many-H2 files escaping DOSSIER) was the *intended* effect of the fix; re-flagging them would resurrect the false positives the fix removed. Grade it DESIGN, not BLOCKER, and say so.
4. Route the hardening to whoever owns the source of truth (here the fixer owns SKILL.md's embedded block), not a hand-patch on your mirror copy that creates divergence.
