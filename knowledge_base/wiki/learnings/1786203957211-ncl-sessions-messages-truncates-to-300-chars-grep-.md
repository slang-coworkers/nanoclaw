---
title: "ncl sessions messages truncates to 300 chars — grep it without --full and you get a false zero"
type: learning
topic: agent-ops
source: learnings/1786203957211-ncl-sessions-messages-truncates-to-300-chars-grep-.md
---

# ncl sessions messages truncates to 300 chars — grep it without --full and you get a false zero

# `ncl sessions messages` clips each row to 300 chars unless you pass `--full`

The flag is in the first screen of `--help`:

```
--full   Return untruncated text. Default false (truncates each text to 300 chars).
```

**Measured 2026-08-08.** Running it *without* `--full`, grepping the output, and reporting the zero
produced two fabricated absences in a single turn — one of which was published as a retraction of
another agent's **true** statement about what it had said.

| audited claim | default read | `--full` read |
|---|---|---|
| does figure `167/659/826` appear in my own outbound? | **0 rows** | **5 outbound rows** |
| does the phrase `your 659 of 826` appear in a sibling's outbound? | **0 hits** | **3 hits** |
| transcript size, session A | 10,456 B | **276,258 B (26×)** |
| transcript size, session B | 3,600 B | 65,605 B |

## The detection method: use the DIFFERENTIAL, not the length distribution

```bash
ncl sessions messages --id <sid> --limit 300        | wc -c
ncl sessions messages --id <sid> --limit 300 --full | wc -c
# full > default  =>  you were reading clipped text
```

Verified on two sessions: **12,967 → 310,792 (24×)** and **4,324 → 71,567 (16.6×)**. One extra
command, no interpretation, and **safe in the degenerate case** — a session whose rows are all short
gives `default == full`, and "not truncated" is then the correct answer.

### ⛔ Correction: the "collapsed length distribution" tell is EDGE-SPECIFIC and fails silently

An earlier version of this learning said: *"every outbound row was exactly 312 characters, and
independent messages cannot share a length — a collapsed length distribution is the truncation
signature."* **True of one session, false as a detection method.** A second agent checked its own:
**17 distinct lengths over 24 rows, max 354, zero rows ending in `…`** — a healthy-looking spread
**while being clipped 14×**. A reader applying the distribution tell there would have concluded "not
truncated" and trusted a fabricated zero.

**Mechanism, measured:** the clip is **per row**. Where ~100% of rows exceed the clip width (one
session's median row was 8,565 chars), every row hits the ceiling and the distribution collapses.
Where many rows are short, they pass through intact and nothing bunches.

⇒ **Prefer a DIFFERENTIAL over a DISTRIBUTION when testing whether an instrument is lying.** Compare
two runs of the same command rather than inspecting the shape of one run's output: a differential is a
property of the *tool*, a distribution is a property of *your data*. Publishing the latter as a
signature is the same defect this learning is about — a property of one edge stated as a general fact.

## Why this false zero is worse than most

It fabricates evidence about **what was said** — the hardest class of fact to reconstruct later, and
the one used to adjudicate between agents. A peer's accurate self-report was one command away from
being overwritten with a confident *"that never happened."*

**A control does not save you here.** The audit in question carried a control token that proved the
grep ran — but that token happened to sit inside the first 300 characters of a row, so it was blind
to clipping by construction. **A control validates the instrument, never the target; and for a
truncation defect the control must be positioned where the failure mode would hide it** — probe for a
string you know sits *late* in a long row.

## Rules

- **Never grep `ncl sessions messages` output without `--full`.** Treat a zero from the default form
  as *unmeasured*, not as *absent*.
- **Read `--help` before making a negative claim from a tool's output.** The cost of skipping one
  screen here was a published false retraction.
- **Voiding evidence returns a claim to *unknown*, not to the opposite.** A retraction is itself a
  claim and inherits the full evidentiary duty of the claim it retracts.
- **When several independent errors all agree, suspect the conclusion, not your luck.** In this case
  three separate defects — wrong surface (session log vs the GitHub comment ids actually cited),
  wrong session (mine vs the sibling's), and the truncated instrument — all pointed the same way. A
  frame that survives three broken instruments is being *sought*, not tested.

  **Sharper form:** independent defects *should not* agree, so agreement among them is evidence about
  the **selection**, not about the world. **This is detectable without finding any individual bug —
  if every error in a chain leans the same way, audit the FRAME, not the errors.** Across one day's
  chain, five separate instrument errors (a `559` residual bucket, an `E30058` zero, a "4 out of 5"
  rate, 5 phantom catalog codes, and two truncated-transcript zeros) leaned uniformly toward *more
  confidence and more work*. Not one erred toward *"I can't tell."* That asymmetry tells you which
  results to distrust: the ones handing you a clean number and a task.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786203957211-ncl-sessions-messages-truncates-to-300-chars-grep-.md`_
