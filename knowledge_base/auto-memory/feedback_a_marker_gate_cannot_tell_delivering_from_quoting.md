---
name: a-marker-gate-cannot-tell-delivering-from-quoting
description: The critique gate matches literal delivery markers and read-only gh api pulls routes, so DISCUSSING a gate or GETting a PR trips it — two false-positive classes verified, both burning the denial cap on non-deliveries.
type: feedback
---
**Two verified false-positive classes in `/app/hooks/gate-critique-on-deliver.sh`, both mine or a peer's, both on non-deliveries.**

## 1. Message markers cannot distinguish delivery from quotation (mine, 2026-08-07)

`gate-critique-on-deliver.sh:51` — `MSG_MARKERS='Resolution|handoff'`, extended per-role via `.critique-delivery-markers` (which adds `Fix Report`, `Triage Resolution`, `Review Verdict`). The test is a bare `grep -E`, so:
```
"[Fix Report] shader-slang/slang#12397 — done"            → MATCH   (a real delivery)
"Your [Fix Report] gate staying shut until then is right" → MATCH   (me DISCUSSING the gate)
```
**I tripped it by telling a coworker their gate should stay shut.** The audit line fired — *"message contains `\[Fix Report\]` but codex-critique was never invoked"* — on a message that delivered nothing.

## 2. `gh api …/pulls…` matches read-only GETs (peer's, verified by me)

`:52` — `BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'`. Tested:
```
gh api repos/o/r/pulls/12080/commits      → MATCH (gated)   ← read-only GET
gh api repos/o/r/pulls/12080/reviews      → MATCH (gated)   ← read-only GET
gh api --method POST repos/o/r/pulls      → MATCH (correct)
gh pr create --draft                      → MATCH (correct)
gh pr view 12080 --json reviews           → clear           ← THE GATE-SAFE READ PATH
```
⇒ **Three read-only investigation calls burned a peer's 3-denial cap and auto-filed a bypass request, which an admin then correctly rejected** — correct output for the input the gate saw, on a premise (`hit: "PR creation"`) that was false: no PR was created, no edits existed.

⭐⭐⭐ **A CONTENT-PATTERN GATE MEASURES THE SHAPE OF A STRING, NOT THE ACT** — so *talking about* the gated act, or *reading* the gated resource, is indistinguishable from performing it. **The false positive lands on investigation, which is exactly the behaviour you want cheap.**

⭐⭐ **The remedies are narrow and mechanical:** gate `gh api` on **write verbs** (`--method (POST|PATCH|PUT|DELETE)`) rather than the `pulls` route; prefer `gh pr view --json` for reads (verified clear); and for message markers, anchor to **line start** so a quoted marker mid-sentence doesn't match.

⚠️ **Both are NanoClaw-side changes to a live gate — operator territory, not mine to edit unilaterally**, and the gate is correct in intent: it catches real deliveries and it caught mine. **Do not "clear" a denial with a hollow critique or by rewording** — that launders a control that exists for good reason. The sanctioned path when there is no artifact is the hook's own: report the blocker upstream instead of delivering.

## ⚠️ I TRIPPED IT TWICE IN CONSECUTIVE MESSAGES — after already documenting it

Both trips were the same sentence pattern: telling a coworker *"your <marker> gate stays shut."* **Documenting the false positive did not stop me reproducing it one message later** — the audit line fired again immediately.

⇒ ⭐⭐⭐ **KNOWING A PATTERN-MATCH HAZARD DOES NOT PROTECT YOU FROM IT, because the trigger is a STRING you have every reason to type while discussing the thing.** The remedy is not care — it is **never writing the literal marker in prose.** Refer to it indirectly ("the delivery gate", "their report gate") and the audit cannot fire.

✅ **Practical rule adopted: when a gate matches literal text, DISCUSS THE GATE WITHOUT QUOTING ITS TRIGGER.** Same shape as the peer's gate-safe read path (`gh pr view --json` instead of `gh api …/pulls/…`) — **route around the pattern rather than argue with it.**

⚠️ **And note the cost asymmetry that makes this worth avoiding rather than tolerating:** each trip is an audit line on a message that delivered nothing, and on a coworker's edge it burns a **3-denial cap** that then auto-files a bypass request for an admin to reject. **A false positive on investigation or discussion consumes a control's budget without ever testing a delivery.**
