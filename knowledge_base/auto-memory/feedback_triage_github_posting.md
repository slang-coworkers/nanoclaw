---
name: Post VERIFIED triage verdicts to GitHub (verified ⇒ post; only unverified/interim are held)
description: Verified triage verdicts (HEAD-checked + repro/claims-confirmed) SHOULD be posted to GitHub as the durable artifact — general policy per operator 2026-06-16. Hold ONLY genuinely-unverified/interim verdicts or a maintainer design-call where an artifact already exists.
type: feedback
originSessionId: b547691e-3292-49b1-87fe-5f5c17f4a532
---

## [SUPERSEDING DEFAULT] 2026-06-16 operator directive — verified verdicts POST, generally

dashboard-admin, after catching me holding 7 verified lego-orch triage verdicts off GitHub: **"Yes [post them], and that remains true for all other issues as well in general. Update your standing memory to allow that."**

**New default: a VERIFIED triage verdict is posted to GitHub as the durable artifact — proactively, no per-instance authorization needed** (consistent with the Jun-8 GitHub-is-primary + Jun-15 be-proactive-artifact directives). "Verified" = repro reproduced OR claims checked against actual repo HEAD (git merge-base). This applies even to **maintainer-assigned** issues and **relayed/triage-input** issues — the root-cause + fix-recommendation is useful to the owner; don't withhold it as mere internal relay.

**HOLD only in two cases:** (1) the verdict is genuinely **unverified / interim / speculative** (the #11483 failure mode — a classification on a stale checkout) — verify first, then post; (2) a **maintainer design-call** where an artifact already exists and a fresh bot interim reply would pre-empt the human decision (e.g. #11505's A/B/C options already posted).

**Still gated (unchanged):** `gh pr ready` flips and **merges** — those remain operator/maintainer-only. Comment hygiene still governs HOW (edit-if-self when nv-slang-bot was last poster; new comment otherwise).

Everything below is the PRIOR, more-conservative framing — retained for the #11483 / token-gate history, but the default above wins: verified ⇒ post.

---

When dispatching a fresh issue to a triage-role coworker (slang-triager, slangpy-triage, etc.), do **not** add an instruction to post the triage verdict/classification to GitHub. The triage role is read-only on GitHub by default.

**Why:** On shader-slang/slang#11483 my dispatch included "Post the triage outcome to GitHub per the usual observability rule." Triage posted a P1 SIGSEGV-crash-on-HEAD classification that turned out to be a phantom — its checkout (b305a4df4) and tested binary (built 5377f3e02) both predated PR #11211's fix commit aaa5f89dd, which already fixed the crash on master. A public retraction comment was then required on the upstream issue. The observability rule's GitHub-comment-required events are *terminal* states (PR opened, resolved-without-PR, blocked, external-handoff). An interim triage classification forwarded internally to fixer is none of those, so the post was premature.

**How to apply:** On a fresh triage *dispatch*, leave out any "post to GitHub" line. Let GitHub posting happen at a terminal/reportable state, by the closest-to-the-state tier — fixer when the PR opens (with `report_pr_created`); triage on an out-of-scope / won't-fix refusal **and** on a *concluded* triage that yields no PR (feature-request awaiting a maintainer decision, advisory, handed-off) — always only after repro/claims-against-HEAD (git merge-base) verification. A bare receipt-acknowledgment to a reporter is acceptable; a specific technical verdict is not, until verified against actual repo HEAD.

**Refinement (confirmed 2026-06-10, supervisor tick 19, slang#11528):** the "don't post" caution targets *interim, unverified* classifications forwarded internally to a fixer — NOT terminal triage artifacts. A triage that has CONCLUDED (path mapped, fixer-ready) but produced **zero GitHub artifact** is itself a reportable state under the prime directive (every chain needs a resumable artifact); the supervisor SHOULD nudge that tier to post a verified 5-bullet, and doing so is correct (slang#11528: triager re-verified the name-collision + vendored SPIR-V enums at HEAD `29e69b0bf`, then posted). The boundary that lets me apply this correctly: **post** when triage concluded AND no artifact exists (e.g. #11528); **hold** when an artifact already exists and the open question is a maintainer *design* call where a bot interim reply would pre-empt the decision (e.g. #11505 — A/B/C options already posted, maintainer-gated → no new interim post). slang-triager flipped its own more-absolute "never post verdicts" stored stance to this same nuanced position the same tick.

**[RETIRED 2026-06-16] The `<github-post-authorized />` token does NOT gate triage/fix posting.** The paragraph that used to be here claimed GitHub posting is gated by a `<github-post-authorized />` token flowing orchestrator → triager → fixer, and that a coworker finding no token should HOLD its post. That was WRONG and caused silent verified verdicts (#11599, #11606, #11613). The token is the **reviewer's** gate only (it lets `/slang-pr-review` post when a human tagged the bot). Triage/fix comments are NOT token-gated: the triager's step-9 5-bullet posts on the bot's own authority once verified at HEAD — correct behavior, not a "gate miss." See `feedback_github_writes_operator_authorized.md` and shared learning `1781405000000-CONSOLIDATED-github-posting-policy.md`. Only `gh pr ready` / `gh pr merge` are operator-gated.