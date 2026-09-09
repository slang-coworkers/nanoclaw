---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786364740587-8s4oti
written_at: 2026-08-10T13:28:01.518Z
---

# [approver/infra-abstain] Devin false-clean: a not-found default that renders as "0" is an unfalsifiable clean; plus record_decision reporting success while the host denied it

Two instrument defects measured on slang-rhi#822, both of the same shape: **an instrument reporting its own success, with no independent channel checked.**

## 1. `devin-fetch.sh` FALSE CLEAN (exit 0, zero findings, looked identical to a genuine zero)

The first scrape exited **0** and wrote `devin-flags.md` reading `Bugs: (none reported)` / `Flags: (none reported)`. That was not a clean result:
- The raw page capture contained **zero** occurrences of `bugs`, `flags`, `findings`, or `informational` — no positive token at all. `(none reported)` was the Python `.get()` **default for a section header that was never found**, byte-identical to the genuine-zero sentinel.
- The exit-0 gate needs `heading && summary`. The only thing satisfying `summary` was **`Checks 18/25`** — a GitHub CI counter, unrelated to analysis state.
- The captured "AI Analysis" prose was **verbatim the PR author's own description** (diffed against `gh pr view --json body`).
- Root cause: findings sit behind an unclicked **"View results"** button in the current Devin UI. The script clicks `Commit status` and the `N Bugs`/`N Flags` toggles, but never `View results`, so the panels it tries to expand do not exist yet. Clicking it made `0 Bugs` / `0 Flags` / 4 informational appear at once.

**Fixes for `devin-fetch.sh`:** (a) drop `Checks N/M` from the done-signal — it is a CI counter independent of analysis state; (b) click `View results` **before** the Bugs/Flags toggles; (c) make the genuine-zero sentinel **textually distinguishable** from the missing-section default, so a missing section can never render as a zero.

**Rule:** ⇒ **demand a POSITIVE TOKEN (`N Bugs` / `N Flags` literally present in the raw capture), never an empty section plus exit 0.** A not-found default that renders as `0` is an **unfalsifiable clean** — no observation could distinguish "reviewed, found nothing" from "never ran". Verify the token in the raw artifact, not in the summarizer's output.

**Related propagation error, same root:** the corrected report asserted the page said "Analysis is up to date". It did not — `devin-commit-status.txt` contained literally `"unknown"` and that phrase appears nowhere in the capture. I copied a subagent's past-tense claim into two of my own artifacts without opening the file. A **forwarded verification is still a verification you owe**; the fact that the forwarder had just caught a different error made its next claim *more* credible-feeling, not more true.

## 2. `record_decision` returned success while the host denied the write

The MCP tool returned `Decision recorded: shader-slang/slang-rhi#822@30a5bdfd37af = ABSTAIN_POLICY`. The host then emitted: `record_decision denied: no approval-ledger writers are configured (set APPROVAL_LEDGER_WRITERS)`. The env var is unset in the container. **No `approval_decisions` row was written**, despite an unambiguous success string.

⇒ **A TOOL'S OWN SUCCESS STRING IS NOT EVIDENCE ITS WRITE LANDED.** The confirmation and the refutation arrived on **different channels**; believing the return value means trusting the one party with no independent view of the outcome. Generalizes: **when two channels disagree about my own side effect, the channel I did not author wins.** Practically — after any ledger/DB/remote append, prefer an independent read-back; if none is available, report the write as *unconfirmed* rather than done, and escalate the missing capability. Do not let an infra gap silently convert into a decision that appears recorded but is not.
