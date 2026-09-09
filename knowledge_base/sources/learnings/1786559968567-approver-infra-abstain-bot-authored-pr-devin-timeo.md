---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786557673652-u9x19x
written_at: 2026-08-12T18:39:28.567Z
---

# [approver/infra-abstain] bot-authored PR + Devin timeout = automatic NO_REVIEW_SIGNAL

**Symptom.** shader-slang/slang#12468 (author `nv-slang-bot[bot]`, a genuine one-line SPIRV emit fix that a human — jvepsalainen-nv — APPROVED at the exact decided head) resolved to ABSTAIN_INFRA(NO_REVIEW_SIGNAL). The pipeline produced zero review signal even though the change was clean and human-approved.

**Root cause — two independent gaps stacking, both structural for this PR class:**
1. `collect-reviews.sh` exit 20: no bot review to harvest, because production `claude-pr-review.yml` (github-actions[bot]) AND CodeRabbit both *skip bot-authored branches by design*. A PR authored by `nv-slang-bot[bot]` will NEVER have a primary/secondary bot review to harvest. (Note: the author-bot's own COMMENTED review entry on the PR is NOT a production review — harvest correctly ignores it.)
2. `devin-fetch.sh` exit 3: Devin did not reach a stable done state within its 30-min deadline (`devin-error.txt`: "timeout: Devin did not reach a stable done state within 30m"). No `devin-flags.md`.

No bot review AND no Devin signal ⇒ `reviewers_complete:false` ⇒ Step 2 short-circuits to ABSTAIN_INFRA. This is the WHOLE ballgame for bot-authored PRs: they *depend entirely on Devin* (the only head-current signal), so any Devin timeout on such a PR is an automatic infra abstain. This class will recur on every fixer/bot-authored PR whenever Devin is slow.

**How to catch it / what it costs.** The infra-abstain rate is a quality gate driven to ~0. Bot-authored PRs are a systematic contributor: they have exactly one possible signal (Devin) and it is best-effort. When Devin times out, the pipeline has nothing, regardless of how correct the change is.

**Fix / mitigation options (for the procedure owner, not a single-PR fix):**
- The 30-min Devin deadline is a hard wall for bot-authored PRs; consider a longer `--max-minutes` specifically when harvest=exit-20 (Devin is the sole signal), since a timeout there is fatal rather than merely losing a redundant secondary.
- Do NOT let a clean challenger read or a pre-existing human APPROVE tempt a WOULD_APPROVE — the skill forbids substituting self-review for the missing doc; investigation only adds caution. ABSTAIN_INFRA is the correct, honest state.
- Subagent hazard observed: the Devin subagent backgrounded the fetch and returned a premature non-answer ("I'll wait...") while the script kept running ~20 more min. The `devin-flags.md`/`devin-error.txt` on disk + the script's own exit code (via `EXIT_CODE=$?` in the bg output file) are authoritative, NOT the subagent's reply. Poll the file/PID, don't trust the subagent's summary.

**Calibration note.** Human approved this exact head cleanly; the change (unwrapAttributedType at slang-emit-spirv.cpp:821, monotonic toward correctness) was almost certainly fine. The abstain is a pipeline gap, not a code judgment — exactly what NO_REVIEW_SIGNAL is for.
