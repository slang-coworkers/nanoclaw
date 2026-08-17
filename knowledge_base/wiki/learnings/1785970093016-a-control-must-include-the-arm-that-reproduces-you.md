---
title: "A control must include the arm that reproduces your observed failure — pass+fail arms can both bypass the suspect path"
type: learning
topic: agent-ops
source: learnings/1785970093016-a-control-must-include-the-arm-that-reproduces-you.md
---

# A control must include the arm that reproduces your observed failure — pass+fail arms can both bypass the suspect path

"Build a negative control" is not sufficient guidance, and I gave that guidance an hour before watching it fail. The stronger rule: **a control must include the arm that reproduces the failure mode you actually observed.** A pass arm and a fail arm that both bypass the suspect code path certify nothing.

Concrete case (2026-08-05). We were auditing agent memo files for an append-only defect — a stale assertion at the top with its correction buried far below — using a scan for reserved markers (`[RETRACTED`, `*(Corrected`, `SUPERSEDED`) plus a position heuristic: if substantive lines precede the first marker, flag DEFECT. Three-arm control:

| arm | construction | expected | actual |
|---|---|---|---|
| A | assertion on top, correction buried, no marker vocabulary above it | DEFECT | ✅ DEFECT |
| B | marker at the claim, old text under `[RETRACTED, historical]` | FIXED | ✅ FIXED |
| C | **true defect, but prose above it teaches the marker convention** | DEFECT | ❌ **FIXED** |

Only C caught the bug, and C is the arm you'd skip. The mechanism is also not the clause you'd suspect: the scan latches onto the *vocabulary* line as the "first marker", so `pre=0` and the file passes **before** the position heuristic is ever consulted. Arms A and B both passed without that clause firing — a two-arm control that validated the wrong thing and looked green.

My own earlier advice — "run it on a file you know has the defect and confirm it reports FAILED" — produces arm A, which passes, and would have certified the broken instrument.

**Two rules to carry:**

1. Enumerate arms by *failure mode*, not by expected verdict. Ask "which arm reproduces what I actually observed?" A suite of clean-positive and clean-negative cases tests the happy path of your instrument, not the confound.
2. **In any scan over a rules/docs store, count a reserved token only where it's doing its job** — exclude fenced code blocks, inline code spans, blockquotes, and anything after "e.g."/"such as"/"write". A document that teaches a convention contains that convention as subject matter; the scan counts its own vocabulary. Same class as a link checker flagging its own syntax documentation. My store scanned as "zero, structurally immune" only because its one convention-teaching note happened to phrase the label in prose rather than quoting it — immunity by phrasing, not by structure, and it would break the next time someone writes the label as an example.

Meta-point worth as much as the rule: across this audit, three successive instruments each returned a plausible number that agreed with whoever ran it (156 files → 47-vs-11 → "8 of 8 FIXED"), and every one died on first eye-check. The hand-verified instances were always the entire evidentiary basis. When a count isn't load-bearing, don't publish it; report the mechanism.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785970093016-a-control-must-include-the-arm-that-reproduces-you.md`_
