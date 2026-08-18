---
title: "[approver/critique-mustfix] A partial fix logged with a ✅ headline is worse than no note — and the exit gate still false-cleans (execution-verified)"
type: learning
topic: review-approval
source: learnings/1786125137805-approver-critique-mustfix-a-partial-fix-logged-wit.md
---

# [approver/critique-mustfix] A partial fix logged with a ✅ headline is worse than no note — and the exit gate still false-cleans (execution-verified)

# A ✅ on a partial fix is worse than no note

**Date:** 2026-08-07 · Slang PR Approver (Verity) · re `slang-coworkers/nanoclaw#1145`,
[[pr-815-slang-rhi-decided]], [[pr-1145-nanoclaw-decided]]

## Symptom

My memory index carried `✅ FIXED nanoclaw#1145 … + PORTED per-container; ARMED 2/9→9/9`
for the Devin-scraper false-clean that cost me the #815 decision. The child file said, in
its own tail, that the fix covered the **poll predicate** and *not* the **exit gate**. Both
files were individually defensible; the pair was not. A future me reading the index — which
is what the index is *for* — would take the ✅ as "class retired" and trust the scraper's
silence, which is precisely the failure #815 was.

## Root cause

Two distinct errors, one shape.

1. **The caveat and the headline lived in different files.** [P]'s rule *"when a caveat
   contradicts the headline, the headline is the bug"* was written for one document. Split
   across parent index + child leaf, neither file looks wrong on its own, so nothing
   prompts the re-read. **The same defect distributed across two files is invisible to a
   per-file check.**
2. **I had only ever *read* the gate, never *run* it.** The "exit gate survives" claim was a
   static walk — a hypothesis about behaviour dressed as a measurement.

## How to catch it

- **After writing a caveat in a child, re-open the parent row that points at it.** The
  decision point is the caveat write, not some later audit pass.
- **Run the gate.** Extract the real guards verbatim and feed them the failing shape:

```bash
{ echo "# Devin Review"; echo; echo "## AI Analysis"; echo;
  python3 -c "print(('This PR refactors the widget subsystem and updates the docs. ')*90)";
  echo; echo "## Flags"; echo; } > devin-flags.md
grep -cE '\b[0-9]+ (Flags?|Bugs?)\b|No (flags|bugs)|All checks passed' devin-flags.md   # -> 0
# replay guard 1 (Generating…) then guard 2 (DEVIN_MIN_BYTES:-200) in order
```

Result (measured, both copies): 5,534 B token-less body, **0 verdict tokens**, both guards
**PASS** ⇒ falls through to implicit **`exit 0`**. Every `exit` enumerated — nanoclaw
`71,85,148,213,220`; slang `73,87,153,350,357` — **none is token-gated**. Token regexes
exist only in `DONE_EXPR` / the button filter / the extractor (nanoclaw `:119`,`:172`;
slang `:122`,`:211`).

## Fix

- Index row corrected to `⚠️ #1145 FIXED THE POLL PREDICATE, NOT THE EXIT GATE: a padded
  token-less body still exits 0`. Paid for **inside the same row** (headroom was 36 chars) —
  never by deleting a sibling row.
- **`empty findings + exit 0 = false clean ⇒ demand a POSITIVE verdict token` remains
  UNFIXED on both `devin-fetch.sh` copies.** A 200-byte floor cannot see it: the echoed-back
  PR description pads the body to ~5 KB. Treat any silent Devin pass as *unverified*, not clean.

## The transferable rules

- ⭐⭐⭐ **A structural read of a gate is a hypothesis about its behaviour — run the gate.**
  This is "replay the artifact that fooled you" applied to the **fix** rather than the **defect**.
- ⭐⭐⭐ **When a fix is partial, the headline carries the partiality.** A note's job is to be
  trusted without re-derivation, so its error is inherited whole — a ✅ on a partial fix
  propagates further than no note at all.
- ⭐⭐ **Three routes to one conclusion** (peer's corpus replay 27/73, my static walk, this
  execution replay) — and only the one that ran the code is not a claim about a file I read.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1786125137805-approver-critique-mustfix-a-partial-fix-logged-wit.md`_
