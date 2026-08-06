---
name: feedback_an_inline_label_must_not_assert_what_the_command_cannot_show
description: "Echoing \"^^ empty = X is absent\" converts a narrow pattern's silence into a published verdict; label the INSTRUMENT, not the world"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 04a03e1f-29f2-49e9-806a-649c4ec6a031
---

⛔**Never write an inline echo that interprets a command's silence as a fact about the world.** `echo "  ^^ empty = NOT in the PR body"` reads, in the transcript and in any summary built from it, as *established*. But the command only showed **that pattern found nothing** — which is equally consistent with the pattern being wrong.

MEASURED (slangpy#1093, 2026-08-05). I grepped a PR body for my own asset verification:
```
grep -inE '13\.1.*(asset|archive|resolve)|asset.*13\.1|debug-info'   # → no hit for the section
echo "  ^^ empty = my 13.1 asset check is NOT in the PR body"        # ← PUBLISHED A FALSE VERDICT
```
The verification **was** in the body, at line 48, and **more thorough than mine** (six platform paths + six `-debug-info` variants, with `SGL_SLANG_DEBUG_INFO` default-ON line refs). My alternation simply didn't match its wording. Had I not re-read the body directly, I'd have told a peer they omitted work they had actually done better than I did — the [[feedback_a_false_negative_becomes_an_accusation]] shape.

Same turn, same failure class, different command: `awk '{print $2}'` on tab-delimited `gh pr checks` output produced `8 (linux,` as a "status tally." **A nonsense tally is the tell that the parser, not the data, is wrong** — the fix was `-F'\t'`.

**Why:** ⭐⭐⭐**A zero has two parents — the world, and the instrument — and the echo names only one.** Writing the interpretation next to the command makes the weaker branch invisible: nobody re-reads a line already labeled with its conclusion. This is why a control is cheap and mandatory: the same query, aimed at something known present, must return non-empty.

**How to apply:**
- ⭐**Label the instrument, never the world:** `"^^ empty = THIS PATTERN found nothing (pattern may be wrong)"`, not `"^^ empty = X is absent"`.
- ⭐**Before concluding absence from a grep over a document you have not read, read the document** (or grep for a broad anchor you know is present). For a ~7KB PR body, reading it is cheaper than being wrong about a peer's work.
- ⭐**A tally whose categories look malformed is a parser bug, not surprising data.** Re-check the field separator before believing any count.
- ✅**Controls used here, both cheap:** unfiltered `gh pr list` returned 6 PRs while the date-filtered form returned 0 ⇒ that zero was **real**; and the tab-aware `awk` on draft #1088 returned `14 pass / 1 skipping` ⇒ it **can** see non-pass, so #1093's `15 pass` is a measurement. **Run the control on the instrument that produced the zero you are about to act on.**

Sibling rules: [[feedback_publish_a_claim_as_wide_as_your_evidence]] (a claim narrowed on the way to publication), [[feedback_no_evidence_names_where_you_looked]] (an evidence gap is a claim about your search surface), and the newly-corrected-instrument rule — a fresh fix's first finding deserves *more* suspicion, not less.
