---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787867970491-5ou9sf
written_at: 2026-08-28T01:57:43.271Z
---

# [approver/infra-abstain] devin-fetch exit 0 is NOT head-current, and the parsed devin-flags.md can silently drop flags — verify against the raw page capture

## Context
shader-slang/slang PR #12537 R2 revision (head a3e6cbd07164, a rename-only push after R1 67f05607), 2026-08-28. Bot-authored ⇒ harvest exit 20 (Devin-only tier). I drafted WOULD_APPROVE on functional merits; DECISION_REVIEW (codex) caught two synthesis defects that flipped it to ABSTAIN_POLICY / NO_REVIEW_SIGNAL.

## Two failure modes, both about trusting Devin's output shape without checking the source

### 1. devin-fetch.sh exit 0 does NOT mean Devin reviewed the pinned head
Symptom: The Devin subagent returned exit 0 with a full analysis. But the analysis had reviewed an EARLIER revision of the PR, not the pinned head. Tells:
- It cited source lines that don't match the pinned head — guard at `:2347-2351`, helper at `:1151-1156` — which were the ORIGINAL revision's line numbers (the pinned head had them at `:2327` and `:1138` after intervening comment/rename pushes).
- It used a PRE-RENAME identifier (`hasRegisteredPayloadWriteback`) that no longer exists at the pinned head (renamed to `hasAlreadyRegisteredPayloadWriteback`).
- `review/devin-commit-status.txt` = `"unknown"` — devin-fetch itself could not confirm the reviewed commit.
Root cause: Devin caches review analysis per PR URL. On a PR that has been re-pushed several times, a fetch can return stale cached analysis of an older revision while still exiting 0. exit 0 = "fetch succeeded", NOT "reviewed the head you pinned".
How to catch it: After a Devin run, VERIFY head-currency before trusting the verdict — (a) read `review/devin-commit-status.txt`; if `"unknown"` treat Devin as unconfirmed; (b) spot-check that the line numbers / identifiers Devin cites actually match the pinned-head source (fetch the file at the pinned commit). A mismatch ⇒ Devin is head-stale.
Consequence: harvest exit 20 (no bot review) AND head-stale Devin ⇒ NO head-current automated review signal ⇒ `reviewers_complete=false` ⇒ ABSTAIN_POLICY / NO_REVIEW_SIGNAL. A clean approver-side source read never substitutes for the missing review tier (see also the pr-12417 lesson: diagnosing Devin as stale IS the abstain condition).

### 2. The parsed devin-flags.md can silently drop flags — cross-check devin-page.txt
Symptom: The subagent's `review/devin-flags.md` (produced by devin-fetch's parser) reported "## Bugs (none) / ## Flags (none)". I synthesized "0 flags, gaps:0" from it. The RAW page capture `review/devin-page.txt:109` actually showed "0 Bugs / **2 Flags**" — (a) CHECK_MIX relies on unverified payload-pointer emission order/formatting; (b) duplicate reads persist for a second register payload of a different type.
Root cause: devin-fetch's HTML→markdown parser extracted the "Bugs" and "Informational" sections but missed the "Flags" section, so `devin-flags.md` under-reported. I trusted the parser's structured output without reading the page it was parsed from.
How to catch it: The Devin page has a header line "N Bugs / M Flags" near the PR summary in `devin-page.txt`. ALWAYS grep that header and reconcile the counts against `devin-flags.md`; if `devin-flags.md` shows fewer flags than the header, read the flags out of `devin-page.txt` directly. Never encode `gaps:0` in the synthesized result from `devin-flags.md` alone.

## Meta
Both defects are instances of the standing genus: the scrutiny I aim at the PR is the scrutiny I owe my own instruments (the fetch tool and its parser). exit-0 and a tidy parsed markdown both LOOK like verified signal; neither is, until checked against the pinned-head source and the raw capture.
