---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786989400334-cxstzf
written_at: 2026-08-24T18:57:44.736Z
---

# [approver/critique-mustfix] CORRECTION: #12574 R2 is ABSTAIN, not APPROVE — "maintainability 🟡 clears" misfired on a load-bearing guard

**Corrects my earlier same-session learning** "[approver/confirmed] R1 OPEN_GAP … closed by a falsifiable test on re-gate" for shader-slang/slang#12574 @8bca04ad5479. That note's point #1 (R1's COM gap was closed by a falsifiable test) is CORRECT and stands. Its point #3 — "maintainability-flavored 🟡 gaps clear under conservative-lean" — was applied wrongly here and led me to draft WOULD_APPROVE. The DECISION_REVIEW critique (codex) caught it; the corrected decision is **ABSTAIN_POLICY / OPEN_GAP**.

**The error.** The production review flagged two 🟡 gaps. One was the obfuscation guard at `slang-lower-to-ir.cpp:12178` (`if (isLinkageNameObfuscated(context, decl)) return false;`). I cleared it as "belt-and-suspenders" citing the author's comment that removing it leaves output byte-identical. **But that byte-identical claim is scoped to ONE of two cases:**
- *Same-request obfuscation* (owning module hashed by the same compile): search misses → falls through → byte-identical. Tested, genuinely redundant. ✅
- *Precompiled module* (a non-obfuscated **precompiled** module, symbols under ORIGINAL names, imported into an obfuscated compile): the search FINDS the interface, the emitted declaration is hashed by `addLinkageDecoration`, prelink pairs by mangled name → mismatch → `SLANG_RELEASE_ASSERT`/crash. Here the guard is **load-bearing**, and `tests/obfuscate/imported-interface-obfuscated.slang:7` EXPLICITLY states it does not pin the guard.

So the guard is untested for a plausible supported input (precompiled modules + `-obfuscate` are both shipped) with a hard-abort blast radius → OPEN_GAP, the same class as R1's gap. Not a BLOCK (the code is correct today).

**Transferable rule.** When an author's "removing X is byte-identical / X is just defensive" comment clears a gap, **check the scope of that claim against the branch's inputs**: a guard can be redundant on the tested path and load-bearing on an untested sibling path. "Maintainability 🟡" is a reviewer's label, not a license to clear — re-derive reachability + blast radius for the SPECIFIC untested scenario (here: precompiled+obfuscate), not the one the test happens to cover. A guard that only *looks* defensive because the test only exercises the case where it's redundant is exactly where a false-safe hides. Also: two independent reviewers (production Claude, and codex at critique) both named this same site — convergent flags on an untested load-bearing guard should raise, not lower, scrutiny.
