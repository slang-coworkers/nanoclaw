---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786731670083-vn3pfm
written_at: 2026-08-20T07:24:20.984Z
---

# [approver/challenger-calibration] A documented gap with a placeholder issue link (NNNN) and no pin test is still OPEN — an in-code TODO acknowledging a silent drop does not clear it

**Context:** slang#11225 R2 (@9ed1b14912cc, 2026-08-20). At R1 I abstained OPEN_GAP on a spirv-*extension*-on-GLSL-target silent drop (the GLSL exemption skips all spirv-family caps but getTargetCaps() converts only spirv *version* atoms, so an extension cap is silently dropped — the exact class #4422 exists to fix). At R2 the author reworked the whole PR (added a capability-provenance model to answer a maintainer's architecture objection) AND addressed my gap by... writing a code comment.

**The calibration point.** The R2 code (`slang-target.cpp:446-455`) now contains an accurate, well-reasoned TODO that (a) states the exemption is broader than the conversion it mirrors, (b) correctly root-causes it (predates this function; narrowing just this test would only move the silent drop), and (c) defers it: `TODO(https://github.com/shader-slang/slang/issues/NNNN)`. The issue number is a literal **placeholder `NNNN`** — no real tracked issue — and no test pins the behavior. Reading the comment could feel like "the gap is handled now." It is NOT: the runtime behavior is byte-identical to R1 (still a silent drop), the gap is merely *acknowledged*. Decided ABSTAIN_POLICY:OPEN_GAP again.

**Rule.** When an author responds to a challenger gap with documentation rather than a code change, the gap's severity is unchanged — grade the *behavior at this head*, not the prose about it. Two concrete tells that a "documented" gap is still OPEN:
1. **Placeholder tracking link** (`NNNN`, `#TODO`, `issues/0`, a bare "see issue") — a real deferral cites a real issue number; a placeholder means nobody committed to tracking it.
2. **No pin test** — a genuinely-deferred known gap usually gets a test asserting the *current* (wrong-but-known) behavior so a future fix is forced to update it. Absent that, the next refactor silently inherits the drop.
A diagnostic-bearing gap (missing error) is invisible to codegen-identity checks, so "CI green + no reviewer objection" carries zero bits about whether it was fixed — read the emission path.

**Distinct from** "[approver/false-positive] a bot's 'Addressed in commits X–Y' is a claim, verify at head" (#12439): there the false signal was a *bot/thread* resolution; here it is the *author's own in-code TODO*. Same lesson family (documented ≠ fixed), different surface.

**Also confirmed transferable:** when a PR is reworked across a revision, a reviewer's *informational* flag can go STALE — Devin flagged "session-vs-target distinction inferred by value matching" which was true at R1 but false at R2 (the rework replaced value-matching with an explicit `CapabilitySource` provenance tag on `CompilerOptionValue` that survives `inheritFrom`). Re-verify each carried-over finding against the *current* head's code before counting it.
