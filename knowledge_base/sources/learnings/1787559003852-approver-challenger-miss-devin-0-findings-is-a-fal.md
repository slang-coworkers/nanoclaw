---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1787555780825-ep1t8p
written_at: 2026-08-24T08:10:03.852Z
---

# [approver/challenger-miss] Devin "0 findings" is a false-safe unless the analysis actually COMPLETED (Checks x/x)

**Symptom.** On slang-vscode-extension#74 (fallback Devin-only tier — no production review bot runs on that repo), my Devin subagent reported "0 bugs / 0 flags / 0 informational" and I synthesized a WOULD_APPROVE review doc from it. The codex DECISION_REVIEW gate refused it: the scraped Devin page literally said **"PR analysis in progress"** with **"Checks 1/3"** and commit-status **"unknown"** — the zeros were in-progress PLACEHOLDERS, not a completed clean verdict. On re-poll the analysis progressed and surfaced **1 real Bug** ("User cancellation shown as an error notification", browserClientMain.ts:26), which I then verified in source. The decision was BLOCK, not WOULD_APPROVE.

**Root cause.** `slang-pr-review-runner/scripts/devin-fetch.sh`'s `DONE_EXPR` treats the mere *presence* of a `Checks N/N` substring (any N) plus the AI-analysis heading as "done". On a page showing "Checks 1/3", that substring is present, so the scraper exits early and scrapes placeholder zeros. Both my Devin runs returned in ~80–140s — far under the timeout — because the scraper hit a false-terminal, not because Devin finished. A "0 findings" from an incomplete analysis is a negative that could NOT have come out otherwise ⇒ it carries **zero bits** (the classic false-safe / dead-control pattern).

**How to catch it.** Before trusting any Devin "0 findings", verify the analysis GENUINELY completed: the "Checks" counter must show **x == y** (e.g. "Checks 3/3"), the literal text **"PR analysis in progress" must be ABSENT**, and no "Generating…" placeholder. Require it stable across two polls. An incomplete Devin with zero findings is NOT a clean review — treat it like a Devin that hasn't run: keep polling, or (if it never completes and there is no bot review) ABSTAIN_POLICY:NO_REVIEW_SIGNAL. Never round an in-progress placeholder up to "clean".

**Fix.** (1) The two-tier critique gate did its job — codex, reading the scraped `devin-page.txt` itself, caught what my subagent's summary hid. Keep passing codex the raw scraped page, not just the subagent's digest. (2) `devin-fetch.sh:109` should require the Checks counter's two numbers to be EQUAL (x==y) before declaring done, not just match `Checks\s*\d+\s*/\s*\d+`. Filed as a scraper bug to watch.
