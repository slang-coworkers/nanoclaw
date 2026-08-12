# [approver/infra-abstain] Devin retry after 30m timeout flips NO_REVIEW_SIGNAL to a scoreable POLICY row

# [approver/infra-abstain] Retry a timed-out Devin before falling to ABSTAIN_INFRA — especially when a human review is standing

**PR:** shader-slang/slang#11136 @bcb552353da9. Devin-only tier (harvest exit 20, bot-authored fix/gh-8455 branch — expected production skip, NOT a signal gap).

## Symptom
Devin run 1 hit its 30-min self-timeout (`devin-fetch.sh` exit 3, `MAX_MIN=30`), producing no `devin-flags.md`. On the Devin-only tier that means `reviewers_complete=false` → the skill's Step 2 short-circuits to **ABSTAIN_INFRA:NO_REVIEW_SIGNAL** (an INFRA row, EXCLUDED from agreement scoring).

## Root cause
The first Devin run stalled right after the URL rewrite (browser/analysis hang), not a genuine "no analysis available." A clean retry (fresh launch) reached a stable done state in ~1 min and produced a full 212-line confirming analysis (exit 0).

## Why the retry mattered here (scoring-critical)
This PR had a **standing human CHANGES_REQUESTED**. The two abstain reason codes join very differently:
- ABSTAIN_INFRA:NO_REVIEW_SIGNAL → excluded from scoring (a blind-pipeline row).
- ABSTAIN_POLICY:CHALLENGER_CONCERN → scoreable, joins as AGREEMENT against the human's changes-requested.
A *completed* Devin flips `reviewers_complete` to true, lets Step 2 pass, and lets the challenger produce the correct scoreable POLICY row. So when the "not-approved" outcome is already over-determined by other signals (a live human CHANGES_REQUESTED), spending a Devin retry to convert an INFRA abstain into a scoreable POLICY abstain is high-value.

## How to catch it / fix
- Treat a Devin exit-3 timeout with no `devin-flags.md` as *transient*, not terminal — relaunch once (`devin-fetch.sh` again; clear stale chrome profile if it was an exit-4). Only fall to Devin-timeout ABSTAIN if the retry also fails.
- **Gotcha:** `devin-error.txt` is written by run 1 and NOT cleared by a successful retry, so a naive monitor that cats it reports a stale "timeout" note even when the retry succeeded. Confirm success from the RETRY's own log (`✓ Screenshot saved` + `devin-flags.md (N lines)`) and the flags file mtime, not from `devin-error.txt`.
- **Compound-command gotcha:** a `pkill ... ; rm ... ; nohup DEVIN &` one-liner aborted before the `nohup` (exit 144 from cleanup). Launch the retry as its own standalone command.
