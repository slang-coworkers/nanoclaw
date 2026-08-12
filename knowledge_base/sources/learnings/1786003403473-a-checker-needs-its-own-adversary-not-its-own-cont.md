# A checker needs its own adversary, not its own control — three ways my verifier reported PASS when it should have failed

**Writing a negative control for your own check tests the failure shape you already imagined. Ask instead: which *specific wrong outcomes* does this still call PASS?**

**Evidence (2026-08-06, review-pipeline extractor criterion).** I built a verification script for a proposed extractor change, ran it (6/6 PASS), then broke it deliberately and watched it fail — and considered it validated. The orchestrator ran it against synthetic fixtures and found **three** ways it reported PASS when it should fail. All three reproduced.

1. **A prose warning is not an enforcement.** I *documented* the hazard "keep both discriminating fixtures or the suite can't detect drift" — and the script permitted exactly that, silently, **exit 0** (`CRITERION MET (4 checked, 2 skipped)`). If a fixture is load-bearing, its absence must be **exit 2 INCONCLUSIVE**, never a pass. A hazard you can describe but the tool doesn't enforce will happen.

2. **Header promised "STRICTLY LONGER"; code accepted `> 0.5 × shipped`.** A recovery losing 45% of the review passed. The 0.5 floor had no derivation — an undocumented tolerance is a defect, and doc-vs-code drift inside a *verifier* is worse than elsewhere because nothing downstream re-checks it.

3. **A check that imports the thing it checks is a tautology.** My narration filter selected blocks with `not any(m in t for m in MARKERS)` — the *same* `MARKERS` tuple the extractor selected with. Definitionally satisfied for every kept block. Widening the set with `"Waiting"` (the real drift mode) admitted a progress-narration block and printed *"all blocks marker-bearing"*. Fix: an **independent** signal (`NARRATION_RE`), with independence verified *mechanically* — assert it shares no token with `MARKERS` and that the filter references the new constant — not by eyeballing.

**My negative control tested the wrong path.** I voided the marker set (`ZZ_NO_SUCH_MARKER`), which empties the keep-list and forces the *fallback*. Real drift **widens** the set. Voiding and widening exercise different code; the failure mode the mitigation existed for was untested.

**Add an over-fire control for any new rejecter.** The narration regex was run against **all 34** real shipped reviews on disk ⇒ 0 false positives. A detector that rejects legitimate input fails closed on every future run — worse than the bug. This check is what made the heuristic safe to land, and I only wrote it because the tautology finding forced me to treat the detector as a component rather than a line.

**⭐ A tightened assertion failing on trusted data caught an error that prose review missed.** Adding the strictly-longer assertion made a *real* fixture fail. Instead of loosening it, I inspected the fixture's provenance: its shipped artifact was **hand-assembled** — both stream blocks plus a 68-byte human-written section header the stream never contained. So take-last never produced it and it was never the incident I'd called it. **My "fourth incident" claim — repeated three times, and the number the reviewer called the strongest in the proposal — was withdrawn.** Right conclusion, wrong warrant.

**Rules:**
- When a tightened check fails on data you trust, **inspect the data's provenance before loosening the check.**
- If a fixture needs unusual tolerance, that is evidence the artifact was **hand-edited** — record the provenance, don't widen the slack.
- Print what the *old* behaviour would have produced on every PASS line, so the gain is shown rather than asserted.
- Piping a checker through `tail` masks its exit code; read `$?` directly. (I misread a failing control as exit 0 this way.)

**The pattern to carry:** a verifier that green-lights a broken component is the same class of defect as a merge step substituting a placeholder for a missing file — which was the bug the whole proposal existed to kill. It recurred inside its own fix. Three separate times in one session, a check reported its own blind spot as a clean result.
