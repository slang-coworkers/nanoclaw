---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786800523701-kk5goq
written_at: 2026-08-15T17:37:29.727Z
---

# [approver/challenger-miss] Devin subagent extraction can silently drop the Flags section — cross-check the raw devin-page.txt count

## Symptom
On shader-slang/slang PR #12509 (Devin-only fallback tier), the Devin subagent's
`devin-flags.md` reported "0 flags" while Devin's raw panel (`devin-page.txt:140-151`)
actually showed **0 Bugs / 1 Flag / 2 Informational**. The dropped flag — "Clamped
validation no longer detects a genuinely undersized call argument" — was a real signal.
My first synthesized review-doc used the subagent's flag count verbatim, producing a
clean APPROVE / gaps=0 that rounded UP over an unresolved signal. DECISION_REVIEW
(codex) caught it before recording.

## Root cause
The Devin-run subagent (devin-fetch.sh + a summarizing pass) extracts `devin-flags.md`
from the scraped page. Its extraction is lossy: it can render Bugs while OMITTING the
"Flags" section entirely, reporting `## Flags (none reported)` when the raw
`devin-page.txt` has a populated Flag with an "Investigate" marker. The approver then
trusts `devin-flags.md` (or the subagent's returned text) as the flag inventory and
never re-reads the raw capture.

## How to catch it
On the Devin-only fallback tier, DO NOT take the subagent's flag/bug counts as
authoritative. `devin-fetch.sh` still writes the raw `review/devin-page.txt` to disk —
grep it for the panel line (`grep -nE '^[0-9]+ (Bug|Flag)s?$' devin-page.txt`, plus the
lines immediately after each, which carry the flag titles). Reconcile the raw
Bugs/Flags/Informational counts against whatever the subagent returned BEFORE writing
`review-doc.md`. A subagent that returns "no 🔴/bug lines present" is answering a
narrower question (bugs) than the flag inventory — a Flag is not a Bug.

## Fix
1. After the Devin subagent returns, always open `review/devin-page.txt` and read the
   Bugs/Flags/Informational panel directly; synthesize the review-doc counts from the
   RAW page, not the subagent's summary.
2. Pass every non-Informational Flag forward as a 🟡 gap into the challenger (Step 3),
   even when Devin's headline is "0 Bugs" — a Flag is an Investigate marker requiring a
   disposition, not a silent clear.
3. This is the same class as the general maxim "NEVER TRUNCATE A BODY YOU PATTERN-MATCH"
   and "a mechanical check is not self-validating": the subagent's extraction is a
   pattern-match over the page and can miss a whole section — verify against the source.

## Note on the specific flag (transferable challenger lesson)
The flag CLEARED on investigation, but only after reading the code: `validateOperandAccess`
is a pure memory-safety bounds check with no notion of a "semantically correct" argument
size, so a validator that checks `min(slotStride, operand.size)` (exactly what the
executor reads) loses no detection feature — the old `slotStride` over-demand WAS the bug.
Lesson for VM `Call`/arg-sizing PRs: when a reviewer flags "validation got weaker",
confirm what the validator's contract actually is (memory-safety-only vs semantic) before
treating a narrowed check as a lost guard. Related: [[pr-12124-correction]] VM Call
param-slot over-read class.
