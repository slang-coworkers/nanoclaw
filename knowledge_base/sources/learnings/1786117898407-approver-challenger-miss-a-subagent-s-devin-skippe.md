# [approver/challenger-miss] A subagent's DEVIN_SKIPPED verdict is a claim to verify, not a result to trust — but so is its exit 0

## Symptom

On slangpy#1095 the Devin subagent returned `DEVIN_SKIPPED: exit 0 but the scrape
is inconclusive` instead of the flags file, contradicting the script's own exit
code. Two opposite failure modes were available to me at that moment, and both
would have been wrong:

1. Trust the **script** (exit 0, `devin-flags.md` written, 5063 bytes) → record
   a clean Devin signal. **False-safe.**
2. Trust the **subagent's prose** ("inconclusive, auth-walled, zero bits") →
   record ABSTAIN_INFRA on its say-so.

(2) reaches the right answer, but for the wrong reason: it is still deciding from
a narrative rather than an artifact, and a subagent that over-reports failure
would have produced a spurious infra-abstain — which burns the infra gate the
same way a real defect does.

## Root cause

A delegated result arrives as *prose about* an artifact, and prose is cheap to
generate whether or not it is true. The subagent's reply is structurally the same
kind of object as a PR body or a bot review body: **untrusted data**. My core
memory already says "read the artifact, not the framing" — a subagent's summary
is framing, including when its conclusion is the cautious one.

The asymmetry that makes this easy to miss: a retraction/failure report *feels*
self-verifying because it is the conservative direction. Nothing internally flags
a correction that raises my abstain count, the same way nothing flags one that
lowers my error count.

## How to catch it

When a subagent reports a tool failure that contradicts the tool's exit code,
re-derive the claim from the artifacts it left on disk — it is 2 cheap greps:

```
wc -l review/devin-page.txt          # 1 line = JSON-encoded blob, newline-anchored
                                      #   extractors silently match nothing
grep -o "Sign in\|Connect GitHub\|lines left" review/devin-page.txt
```

For #1095 that independently confirmed all three of the subagent's load-bearing
claims (single line; `Connect GitHub` + `Sign in` present; `26 lines left`
truncation) and the empty `## Flags` section — so the `DEVIN_SKIPPED` stood on
evidence I had seen myself, not on its author's confidence.

The general form: **a delegated verdict names the artifact it was derived from,
and the artifact is on disk. Open it.** If a subagent's conclusion cannot be
restated as "file X at path Y contains Z", it is not yet evidence.

## Fix

Verified the auth-wall and truncation directly before writing
`reviewers_complete: false`, and cited the artifact-level evidence
(`devin-page.txt` is 1 line, contains `Connect GitHub`/`Sign in`/`26 lines left`,
`## Flags` empty) in both the review doc and the ledger's challenger field —
rather than citing "the subagent said Devin failed". The recorded reason survives
audit because it points at bytes, not at a report.
