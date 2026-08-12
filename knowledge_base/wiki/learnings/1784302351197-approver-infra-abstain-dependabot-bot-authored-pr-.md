---
title: "[approver/infra-abstain] dependabot bot-authored PR: harvest exit 20 + Devin timeout = guaranteed NO_REVIEW_SIGNAL"
type: learning
topic: review-approval
source: learnings/1784302351197-approver-infra-abstain-dependabot-bot-authored-pr-.md
---

# [approver/infra-abstain] dependabot bot-authored PR: harvest exit 20 + Devin timeout = guaranteed NO_REVIEW_SIGNAL

**Symptom:** shader-slang/slang#11892 (dependabot bump golang.org/x/net 0.49.0→0.55.0 in /extras/scaler, transitive `// indirect` Go deps, 28 lines) forced ABSTAIN_INFRA / NO_REVIEW_SIGNAL despite all 6 eligibility clauses passing. Both review signals were absent: `harvest-reviews.py` exit 20 (no harvestable bot review) AND `devin-fetch.sh` exit 3 (full 30-min timeout, no `devin-flags.md`).

**Root cause (a STRUCTURAL infra gap, not a transient flake):** dependabot PRs are *bot-authored*, so the production `claude-pr-review.yml` pipeline **genuinely skips them by design** — harvest exit 20 is expected and permanent for this PR class, not a race to WAIT+re-harvest (that's exit 22). That leaves **Devin as the SOLE possible review signal.** When Devin also times out, there is *nothing* to decide from → NO_REVIEW_SIGNAL is unavoidable. This differs from `[approver/false-safe]`: the correct call here is ABSTAIN, never self-review the bump (hard invariant), and never round up to WOULD_APPROVE.

**How to catch it / anticipate:** For any `dependabot[bot]` (or other bot-authored) PR, expect harvest exit 20 up front — the primary tier is structurally unavailable, so Devin is load-bearing. Devin's `--max-minutes 30` means a stuck fetch burns ~30 min of wall-clock before exit 3. Budget for it: arm a monitor on the devin-fetch pid exit with a ≥30-min window (shorter monitors just time out repeatedly — I re-armed 3×). If Devin's own review backend is slow/unavailable for a whole class of PRs, EVERY bot-authored dep bump will infra-abstain, inflating the infra-abstain rate that's supposed to trend to ~0.

**Fix / mitigation ideas (for the harness owner, not this session):** (1) A dep-bump-specific lightweight signal (e.g. a scripted go.mod/go.sum consistency + advisory-DB check for the bumped module versions) could give Devin-independent coverage for the bot-authored-dep-bump class — the change is mechanically simple (version strings + hashes) and doesn't need a full LLM review, so it's a good candidate for a deterministic clause rather than a review signal. (2) Retry Devin once on exit 3 for this class before abstaining, since it's the only signal. Until then, bot-authored dep bumps will reliably ABSTAIN_INFRA when Devin is unavailable — that is correct behavior, just a recurring named defect.

**Precedent:** dependency-bump triage note (`1782244083021-dependency-bump-pr-triage-cross-platform-check-pro.md`) covers *submodule* bumps where CI proves innocence; but Slang CI has NO job that builds `extras/scaler` (standalone Go tool), so CI green is orthogonal here — it can't substitute for the missing review signal the way real-hardware CI did in PR 797 (`[approver/human-agreement] real-hardware-CI-substitutes-timed-out-Devin`). That substitution only works when a CI job actually exercises the changed code; for `extras/scaler` none does.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1784302351197-approver-infra-abstain-dependabot-bot-authored-pr-.md`_
