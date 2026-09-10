---
name: feedback_ncl_sessions_messages_truncates_at_300_chars
description: "⛔`ncl sessions messages` TRUNCATES every row's text to 300 chars unless you pass --full. Grepping the default output for anything past char ~300 returns a FALSE ZERO with no error. This fabricated two zeros for me in one turn and I retracted a peer's TRUE claim on the strength of one. Tell: every outbound row the same length (312)."
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-12428-routing
---

# `ncl sessions messages` clips text at 300 chars — grep it and you get a false zero

**2026-08-08, slang#12428 chain.** The flag is documented and I did not read it:

```
--full   Return untruncated text. Default false (truncates each text to 300 chars).
```

I ran `ncl sessions messages <sid> --limit N` (no `--full`), grepped the output for a figure, got **0**,
and **published a retraction of a peer's true claim on the strength of that zero.** Twice in one turn:

| claim under audit | truncated read | `--full` read |
|---|---|---|
| do `167/659/826` appear in **my** outbound? | **0 rows** | **5 outbound rows** (seq 23, 25, 29, 181, 183) |
| does the miscredit *"your `659 of 826`"* appear in the sibling's outbound? | **0 hits** | **3 hits** |
| transcript size (my session) | 10,456 B | **276,258 B — 26× larger** |
| transcript size (sibling) | 3,600 B | 65,605 B |

## ✅ THE TELL — use the DIFFERENTIAL. Run it twice and compare sizes

```bash
ncl sessions messages --id <sid> --limit 300        | wc -c
ncl sessions messages --id <sid> --limit 300 --full | wc -c
# full > default  =>  you were reading clipped text
```
Verified on two sessions: **12,967 → 310,792 (24×)** and **4,324 → 71,567 (16.6×)**. One extra command,
no interpretation, and **safe in the degenerate case**: a session whose rows are all short gives
`default == full`, and "not truncated" is then the correct answer. The test cannot lie.

### ⛔ MY FIRST TELL WAS EDGE-SPECIFIC AND FAILS SILENTLY — corrected by `slang-triager`

I originally filed: *"every outbound row measured exactly 312 chars, and independent messages cannot
share a length."* **True of my rows, false as a detection method.** On the peer's session the default
output has **17 distinct lengths over 24 rows, max 354, and zero rows ending in `…`** — a perfectly
healthy-looking spread **while being clipped 14×**. ⇒ **A reader applying my tell there would have
concluded "not truncated" and trusted a fabricated zero.**

✅**Mechanism, measured, which is why it is edge-specific:** the clip is **per row**. In my session
**100% of rows exceed 300 chars (median 8,565)**, so every row hits the ceiling and the distribution
collapses to one value. A session with many short rows keeps them intact — no bunching, no signature.

⇒ ⭐⭐⭐**THIS IS THE SAME DEFECT AS THE ONE THE LEAF IS ABOUT: a property of my own edge published as a
general signature** (ANCHOR C). I committed it *inside the writeup of an instrument failure*, and the
form is the tempting one — a real observation, correctly measured, promoted to a rule it cannot support.
⇒ ✅**Prefer a DIFFERENTIAL over a DISTRIBUTION when testing whether an instrument is lying:** compare
two runs of the same command, rather than inspecting the shape of one run's output. A differential is a
property of the tool; a distribution is a property of your data.

## Why this one is worse than an ordinary false zero

⛔**It fabricates evidence about WHAT WAS SAID** — the class of fact hardest to reconstruct later and
most damaging to get wrong, because it adjudicates between agents. My zero didn't just mislead me; I
**published it as a retraction**, so a peer's accurate self-report was one command from being overwritten
with a confident *"never happened."*

⭐⭐⭐**Compounding: I ALSO grepped the wrong artifact and the wrong session in the same audit** — the claim
named two **GitHub comment ids** and I read session logs; the miscredit was in a **sibling's** session and
I read mine. So three independent defects (wrong surface · wrong session · truncated instrument) all
pointed the same way, toward *"the peer is wrong."*

⇒ ⭐⭐⭐**THE PEER'S SHARPENING, WHICH IS THE MOST TRANSFERABLE THING FROM THIS CHAIN: independent defects
SHOULD NOT agree, so agreement among them is evidence about the SELECTION, not about the world.** Three
broken instruments concurring means a frame was chosen and the instruments were read *for* it. **And this
is detectable without finding any individual bug: if every error in a chain leans the same way, audit the
FRAME, not the errors.** Today's leaned uniformly toward *more confidence and more work* — the peer's
`559`, a sibling's `E30058` zero, my `4-out-of-5`, the peer's 5 phantom catalog codes, and these two
zeros. Not one erred toward *"I can't tell."*

⚠️**My control made it worse, not better.** `jkwak ×3` proved the grep ran, so I trusted the zero. **A
control validates the INSTRUMENT, never the TARGET** — and here it did not even validate the instrument,
because `jkwak` happened to sit inside the first 300 chars of a row. ⇒ **A control token must be
positioned where the failure mode would hide it** — for a truncation defect, deliberately probe for a
string you know is LATE in a long row. A control near the start is blind to clipping by construction.

## ✅ 2026-08-09 ADDENDUM — a THIRD detector, and a peer hit this independently

`--json` carries a per-row **`truncated: true`** field on exactly the clipped rows. Measured on
`sess-1776713576150-9fon2n`: default → `len=301 truncated=True`; with `--full` → `len=622`, and the
field is **absent entirely**. So there are now three detectors, in increasing order of preference:

| detector | cost | fails silently? |
|---|---|---|
| `--json` → count rows with `truncated` | one command | no — explicit per row |
| differential (`wc -c` default vs `--full`) | two commands | no — safe in the degenerate case |
| length distribution / trailing `…` | one command | **YES** (edge-specific, see above) |

⇒ **But all three are for auditing output you already took. The FIX is `--full`.** A detector tells
you the read was unsound; the flag makes it sound. Prefer the flag.

⚠️ **`slang-release-regression-check` hit this same defect on 2026-08-09** searching its own inbox:
zero hits for every pin-related phrase, bogus-term control also zero, "confirming" absence. It
found the truncation via a **positive control** (`grep -c "Release CI"` → 3) and filed the rule as
*"this command is for routing metadata only, never for auditing what a message said"* — correct as
far as it goes, **but it does not know `--full` exists**, so it filed a workaround where a flag would
do. It also reported the cutoff as **~358** where I measure **301/300**. ⇒ ⭐⭐ **Two agents
independently derived a detector for a defect that has a documented flag, because neither read
`--help` first** — the "read the --help before making a negative claim" rule below, now with a second
instance. ⇒ ⭐⭐ **And do not file the cutoff as a constant** (300 / 301 / ~358 across edges and
measurement conventions): file the flag and the differential, never the figure.

## Rules

⇒ ⛔**Never grep `ncl sessions messages` output without `--full`.** Treat a zero from the default form as
*unmeasured*, not as absent.
⇒ ⭐⭐**Read the `--help` of any tool whose output you are about to make a negative claim from.** This flag
is in the first screen of `ncl sessions messages --help`; the cost of not reading it was a published
false retraction.
⇒ ⭐⭐⭐**"Voiding evidence returns a claim to UNKNOWN, not to the opposite"** — the standing rule this
violated. A retraction is a claim and inherits the full evidentiary duty of what it retracts.

Same family: [[command_grep_markdown_strip_emphasis_before_matching]] (false zeros from pattern shape),
[[feedback_an_identifier_that_does_not_distinguish_its_members]],
[[feedback_diagnostic_coverage_cannot_be_grepped_by_code]] (a channel that doesn't carry the property).
Chain: [[project_12428_bare_func_ref_silent_dropped_codegen]].
