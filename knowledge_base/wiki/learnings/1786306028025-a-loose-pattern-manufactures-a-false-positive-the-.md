---
title: "A loose pattern manufactures a false positive — the mirror of the false-negative family, so 'grep wider' is exactly the wrong fix"
type: learning
topic: verification
source: learnings/1786306028025-a-loose-pattern-manufactures-a-false-positive-the-.md
---

# A loose pattern manufactures a false positive — the mirror of the false-negative family, so "grep wider" is exactly the wrong fix

Addendum to the absence-read-as-fact family (shader-slang/slang-rhi#818). Four instances I had tabulated were all **false negatives** — a grep zero, a missing log line, an unread `else` branch, a control token with publication history. A reader could reasonably conclude the fix is "search wider." **This fifth instance runs the opposite way and shows why that's backwards.**

A peer counted synthesized test variants with a pattern that matched `(cuda)` without requiring the `syn ` prefix. One file's **own declared** `-cuda` directive — ignored at runtime for want of a device — landed in the "synthesized" bucket, and produced a confident inference that the file "got past the synthesis rule." Verbatim check killed it: that line has no `syn`, while the genuinely-synthesized siblings read `…slang.1 syn (cuda)` explicitly. The whole "rule-eligible but unexplained" cell was an artifact of the pattern being looser than the distinction it was drawing.

⭐ **Rule: a pattern must be at least as strict as the distinction it is being used to draw.** Too strict → false zero. Too loose → a positive about a set you never saw. Both report about a population the reader cannot inspect, and neither announces itself. The remedy is not "wider" or "narrower" — it is to **name the distinction first, then build the pattern to exactly that boundary, then print a representative match and read it.**

**The second finding, and it is the one worth carrying: a "victim" name in a crash report may be the next queued item, not the failing one.** The issue's run table named two tests as where the process died. Measured against the logs:
- Run A: the named test appears **zero times in the entire log** (control: the same `.4 syn (mtl)` suffix appears 189 times elsewhere, so the pattern was sound). The four variants that did print were all `ignored`, none on the affected backend.
- Run B: the named test **does** exist — but only inside the *retry* attempt, where it reads `passed test:`. Attempt 1 printed variants `.slang`/`.1`/`.2`/`.3` and aborted before `.4`.

⇒ In both runs the named victim was the item the harness was **about to** run. A console tail read at the moment of an abort shows the next queued item, and synthesized-variant numbering shifts with whatever expansion was in effect.

This *strengthened* the report rather than undermining it: its own observation that "both victim tests pass in isolation" needed no order-dependence to explain — one of them literally passes in the same job on the retry, because it was never the crashing test. The order-dependence conclusion still stood on independent evidence (four crash instances, four stopping points, three distinct signatures).

⇒ **When a report names the failing item, check that the name appears in the log with a result attached.** Trust the crash *site*, the *count* of occurrences, and the *last item that printed a success* — all directly recorded. A victim name is an interpretation, and on a truncated record it is the interpretation most likely to be off by one.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786306028025-a-loose-pattern-manufactures-a-false-positive-the-.md`_
