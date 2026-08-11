---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786370954147-sggcnr
written_at: 2026-08-10T18:51:11.363Z
---

# [approver/challenger-miss] An empty derived artifact is a claim about the extractor, not the source — grep the raw capture before recording a zero

## Symptom

Deciding slang#12450 (CI: add `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` to one `msvc-dev-cmd` step). The
Devin runner produced `review/devin-flags.md` with an **empty `## Flags` section**. I recorded
"Devin completed, no positive count/liveness token → treat as no-findings", set `gaps=0`, and
synthesized a clean `APPROVE`.

The raw page capture sitting next to it — `review/devin-page.txt`, written by the same runner —
contained:

```
0 Bugs
1 Flag
Step-level env for the node24 force flag        <- Investigate, compile-perf-release-sweep.yml:80-81
MSVC dev-cmd step in common-setup still runs on every OS   <- Informational, action.yml:41-44
```

So Devin **did** emit a positive count token, and its 🟡 flag pointed at *the only functional line
of the PR*. My review doc claimed the opposite. The DECISION_REVIEW critique found it by reading the
page dump I had stopped reading the moment the flags file looked empty.

## Root cause

I have a standing rule for exactly this shape: *"an empty findings section + exit 0 = FALSE CLEAN ⇒
demand a positive token (N Bugs / M Flags)."* The rule fired — but only far enough to **label the
signal weak**. I wrote "no positive token, treated as no-findings, not verified clean", felt
appropriately skeptical, and moved on.

Labelling the absence is not the action the rule asks for. The action is to **go find the token**,
which was one `grep` away in a sibling file. A rule that ends in a caveat instead of a command
produces a well-documented wrong number.

Deeper: `devin-flags.md` is a *derived* artifact. Its emptiness is evidence about the extraction
step, not about what the reviewer found. I treated a transformation failure as a measurement.

## How to catch it

Before recording any zero-finding count from a tool that has both a derived summary and a raw
capture:

1. **Grep the raw capture for the count token itself**, not for findings:
   `grep -aoiE "[0-9]+ (Bug|Flag)s?" <raw>` — a positive token that contradicts an empty summary is
   an extractor bug, and the raw side wins.
2. **Size check.** A 5 KB flags file next to a 10 KB page dump whose findings section is empty is
   suspicious; the summary should not be *smaller in information* than its source in the specific
   place you're about to trust.
3. **Ask what would look different if the extractor had failed.** If "reviewer found nothing" and
   "extraction dropped everything" produce byte-identical artifacts, the artifact cannot support
   either conclusion, and the tie-break lives in the raw file.

## Fix

Corrected the record rather than the conclusion: verdict `APPROVE` → `APPROVE_WITH_NITS`, `gaps` 0 →
1, both findings enumerated with explicit dispositions (🟡 cleared on same-pool runner-log evidence;
ℹ️ out of scope — the missing `if:` OS guard is present at the PR base too and the PR adds no `if:`
line). The decision itself survived, but it was reached over a fabricated zero, and a fabricated
zero is a false-safe waiting for a PR where the flag matters.

**Transferable rule: when a rule tells you a signal is untrustworthy, that is an instruction to go
get a trustworthy one — not permission to proceed with the untrustworthy one clearly labelled.**
