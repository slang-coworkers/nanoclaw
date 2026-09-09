---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1783957284686-c8ztio
written_at: 2026-08-11T14:32:08.156Z
---

# [approver/clause-gap] A widened policy clause moves the work from Step 1 to Step 3 — it does not discharge the concern (protected_paths cut to one glob 2026-08-04)

## Symptom

shader-slang/slang#12084 had **two prior ABSTAIN_POLICY rows**, both `CLAUSE_FAIL:no_protected_paths` on the same file. Re-gating the same PR, same file, **same byte-identical diff** produced the **opposite clause result**: 6/6 pass, `no_protected_paths` = *"1 changed path(s), none protected"*.

Nothing about the PR changed. The **policy file** changed.

## Root cause

`/workspace/extra/approver-policy/APPROVAL_POLICY.json` was widened on **2026-08-04** to `policy_version: v0-shadow-wide` (human sign-off recorded in the file: `haaggarwal`). `protected_paths` went from 8 globs — including `.github/**`, `**/*.yml`, `**/*.yaml`, `cmake/**`, `external/**`, `**/CMakeLists.txt` — down to **only** `**/slang-tag-version.h`. Caps also widened: `max_total_lines` 400 → 8000, `max_files` 30 → 150.

Stated rationale (worth knowing, it is good reasoning): in shadow mode the approver never auto-approves, so a Step-1 terminal FAIL "protects nothing and only destroys measurement signal". Measured over 232 decisions: 53% were ABSTAIN_POLICY; of 82 abstains that later carried a decisive human verdict, **91% were approved**; `no_protected_paths` fired exclusively on `.github/**` (32 cases).

⭐⭐⭐ **THE LESSON: AN ABSTAIN IS A FACT ABOUT (diff × POLICY VERSION), NEVER ABOUT THE DIFF ALONE.** "We already abstained on this PR, it's a stale replay" is a shortcut that re-emits a decision the policy of record no longer supports. **Re-read the policy file on every re-gate; do not replay a clause result.** Note the outcome *label* here was still `ABSTAIN_POLICY`, but the reason changed completely (`CLAUSE_FAIL` → `OPEN_GAP`) — so even "same answer as last time" was not a licence to skip the work.

## The part that actually matters

The same policy file says, verbatim: **"MUST BE RE-TIGHTENED BEFORE ANY ENFORCEMENT: at enforcement, `.github/workflows/**` is a supply-chain surface."**

⭐⭐ **A WIDENED CLAUSE IS NOT A DISCHARGED CONCERN — IT RELOCATES THE WORK FROM STEP 1 TO STEP 3.** Treating `no_protected_paths: pass` as the end of the analysis is how a widening-for-measurement turns into a measurement of nothing. I ran the supply-chain probes by hand instead:
- new action dependency? (no — reused the *identical* pinned digest already present in the file; verify by confirming the digests match, not just that both are pinned)
- trigger widening? (no — `on:` unchanged, no `pull_request_target`)
- new secret reach? (**YES — this is where the real finding was**, see the gate-algebra learning; it became the `OPEN_GAP`)

**The vindication is the point:** a genuine supply-chain gap existed on this file and surfaced *only* because Step 3 did the work the widened clause no longer does. Under the old blanket clause it would have been hidden behind a generic path FAIL and never found. So the widening is simultaneously (a) correct policy for buying signal and (b) load-bearing on the challenger actually doing the work.

## How to catch it

- On every decision, read `policy_version` out of `clauses.json` and treat it as part of the decision's identity. A row without its policy version is not comparable to a later row.
- Verify **which** policy file governs. `eval-clauses.py:266-281` resolution order: `--policy` → `<ws>/policy/APPROVAL_POLICY.json` → `/workspace/extra/approver-policy/APPROVAL_POLICY.json` (group-mounted) → bundled default next to the script. **The bundled default is the CONSERVATIVE one (`v0-shadow`, 8 protected globs, 400-line cap); the mounted one is WIDE.** Confirm no per-PR staged policy exists before asserting which applied — they give opposite answers on `.github/**`.
- ⚠️ **A `pass` on a clause whose predicate was deleted is not the same fact as a `pass` on a clause that was evaluated.** Read the evidence string. Same for `ci_green_on_sha`: under `require_ci_green: false` it prints `pass` with evidence *"policy does not require CI green"* — that is **vacuous**, and it is not evidence CI is green. Enumerate `actions/runs?head_sha=<head>` yourself for any approve-direction call.
- Prior shared-wiki guidance saying protected-path abstains on trivial CI edits are well-calibrated and "don't lobby for a carve-out" is **superseded for the clause mechanics** — but superseded **by the policy owner**, not by an approver's judgment. The underlying supply-chain reasoning is still correct and is now Step 3's job.
