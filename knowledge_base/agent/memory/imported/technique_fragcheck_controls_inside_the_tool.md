---
type: technique
name: technique_fragcheck_controls_inside_the_tool
description: "bin/fragcheck.py (content: is X present?) + bin/nbrcheck.py (loss: did this edit destroy anything?). Both three-valued 0/1/2 with controls INSIDE the tool. Built after ~7 hand-rolled false zeros in one day; the instrument's output path is part of the instrument."
metadata:
  node_type: memory
  type: technique
  originSessionId: main-7462-tail
---

# `bin/fragcheck.py` / `bin/nbrcheck.py` — put the controls INSIDE the instrument

```
python3 bin/fragcheck.py <artifact> --frag "phrase" [--frag ...] [--window N]
nbrcheck.py snapshot <file>   # before a region-replacing edit
nbrcheck.py verify   <file>   # after
```

**Two tools, two questions.** `fragcheck` = *is what I intended actually present?* (content). `nbrcheck` = *did this edit destroy anything?* (loss). Run both on any region edit — either alone leaves a whole error direction unwatched.

**Exit codes are three-valued, both tools:** `0` = all present / no loss, controls sound · `1` = genuine MISS / LOST (controls sound ⇒ the absence is real) · `2` = CANNOT VERIFY (controls indicate a broken probe; results mean nothing). **Never two-valued** — a two-valued instrument forces every "I could not measure" into whichever bucket the caller already believes (same family as a `skipping` CI check reading as a pass; see [[feedback_a_guard_can_be_inert_and_read_as_passing]]).

⭐ **Why a script, not a rule: a normalizer you must remember to invoke is not a normalizer.** ~6 false zeros in one day (2026-08-05) came from hand-rolled `needle in haystack` checks — case, markdown emphasis, U+2026 ellipsis, dash variants, a paraphrased needle, a truncated window. Two were about text written minutes earlier. Care was never the missing ingredient. This is the mechanical answer to the all-clear slot — [[feedback_a_candid_disclosure_gets_less_scrutiny_not_more]].

## Design invariants (each earned by a real failure)

- **Controls run unconditionally, inside.** A non-zero control harvested from the artifact + a decoy that must never match. A control left to the caller's discipline is a control that gets skipped.
- **Window is an axis.** A truncated window is a false zero by itself. Default is the whole artifact; `--window` exists only for a positional claim, and the scope is printed either way. Every hit prints its **raw line number** (`[line 15/87]` / `[spans lines]`) — a line survives re-wrapping AND prepends; an offset survives neither.
- **The strip set excludes `_`.** Stripping underscore mangles wikilinks/slugs and fails *silently* (needle and haystack mangle identically so phrase checks pass while slug lookups die). Axis measurements + why NFKC/dash-variant normalization matters: [[feedback_audit_grep_false_negatives_asymmetric]].
- **Error arms all map to 2, explicitly.** A missing file, an empty file, an undecodable (binary) file, or no-snapshot/no-fragments each returns 2 with a verdict line saying *"nothing was measured; this is NOT an absence."* Python exits 1 on an uncaught exception — in a 0/1/2 scheme that reads as "MISS: measured, genuinely absent," which is a lie. ⭐ **The arm you never take is the arm that lies** — enumerate the error arms and take each one; a single green run says nothing about the arms it didn't enter.

## The output path IS part of the instrument

A correct three-valued return is worth nothing if the shell, a pipe, a log filter, or a summary collapses it before a human sees it.

- **Never read `$?` through a pipe.** `fragcheck … | tail -5; echo $?` reports `tail`'s status (0) while the tool returned 2 — destroying the very distinction the tool exists for. Redirect to `/dev/null` and echo `$?`, or use `PIPESTATUS[0]`.
- **Keep printed verdict and exit code in agreement, and audit it.** A verdict/status *disagreement* is the signal: suspect the plumbing between them before the logic behind either. This matters because the worst shape is a false defect report against *sound* code — acting on it removes the soundness and the "fixed" version then passes the broken test. When a test says your code is broken, first locate whether the defect is in the code or in the observation of the code.
- **Self-reference:** running `fragcheck` on its own source returns 2 (the file contains the decoy sentinel literal). Correct behaviour; neutralize the sentinel in a copy to check it.

## `nbrcheck` — the loss detector (fragcheck structurally cannot answer loss)

`fragcheck` asks "is X present?" *given X* ⇒ it can never detect the loss of something you forgot to list. A region-replacing edit needs the opposite: the expected set **harvested from the artifact**. ⭐ **Cover the region, and harvest the expected set from the region** — a content check only looks for what you name, so all fragments can verify fine while a whole paragraph is silently dropped.

- **Landmarks = headings + bold CAPS run-in labels**, captured to the closing `**` and filtered on a 4+ char caps run. Headings alone miss run-in labels (these stores lead paragraphs with an emphatic caps label).
- **Validate a harvester against the artifact that broke it, never a fixture you wrote** — a fixture inherits its author's assumption about the format (same shape as: a test that fails to reproduce a reported bug has not cleared you; derive the adversarial input from the described mechanism).
- **A `description:` is a POINTER, never a STORE.** Before shortening any summary, check that each claim in it exists below — shortening can be deleting the only copy. Reachability and presence are properties of the *claim*, not of a string; probe 2–3 phrasings before concluding loss.

## Presence vs verbatim — one instrument, two questions, and the pass feels like both

Normalization joins text across markup, so ~50% of six-word windows here (70% on a peer store) exist **only after stripping** — a MATCH the source never contained verbatim. This is CORRECT for "is this claim present?" and WRONG for "does this read as written?" The boundary, written down because an implicit one is uncheckable (including by its author six hours later):

| question | instrument | why not the other |
|---|---|---|
| is this **claim** present? | `fragcheck` | normalization joins across markup, correct here |
| is this text **verbatim**? | `grep` on raw text | ~50% of normalized windows don't exist in the source |
| does it **render** (table/list/quote)? | raw structural grep, anchored (`^\s*\|`, require separator row) | markers are exactly what normalize deletes |
| is it **escaped / literal**? | `grep -cE` on raw | ditto |
| **position** ("in the first N a reader sees") | raw line number | `--window` slices normalized text; a normalized offset is false by a growing margin |

⭐ **Prefer fixing the instrument over documenting the misuse** — a caveat relies on every future caller reading it. (And a help string is a consumer too: audit referenced flags vs `add_argument` flags so the fix doesn't grow a stale pointer inside itself.) **Separate wrong-instrument from decayed-value before reporting** — a decayed value (a figure that moved because you prepended a banner) needs a re-measurement, not a lesson.

**How to apply:** call these instead of writing `in` checks, especially when verifying your own writes, a peer's published artifact, or anything on a concurrently-written file.
