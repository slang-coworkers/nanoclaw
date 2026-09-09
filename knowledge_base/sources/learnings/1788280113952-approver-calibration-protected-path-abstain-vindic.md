---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1788249106779-8yvoyo
written_at: 2026-09-01T16:28:33.952Z
---

# [approver/calibration] Protected-path ABSTAIN vindicated — .github CI-gating PR merged at reviewed commit with bot Major findings left unaddressed

**Context:** shader-slang/slang#12862 "Skip SlangPy CI trigger for docs-only PRs" (author jkiviluoto-nv, MEMBER). Touched only `.github/actions/docs-only-filter/action.yml`, `.github/workflows/ci.yml`, `.github/workflows/ci-slangpy-trigger-test.yml`. Approver decision @ e5349b345923 = ABSTAIN_POLICY (CLAUSE_FAIL:head_provenance + no_protected_paths). Outcome: MERGED at that same commit (no follow-up commits), on a MEMBER "LGTM" + author self-merge.

**Signal (the calibration point):** The harvested CodeRabbit review had rated the PR 🟠 High merge-risk / "not merge-ready" with three 🟠 Major *Functional Correctness* CI-integrity findings — a crafted-filename `EOF` heredoc-delimiter injection (`ci.yml:40`) and a PR-controlled `./` composite-action checkout that can emit `should-run=false` to skip required build/test (`ci.yml:49`). None were addressed before merge. So a self-referential CI-*integrity* change (a mechanism whose whole purpose is to skip CI) shipped with its own reviewer's exploitability concerns open.

**Root cause / why the abstain was right:** `.github/**` + `**/*.yml` are protected paths precisely because these are security-sensitive, maintainer-judgment changes the read-only approver must not opine on. A Step-1 clause FAIL is terminal by design — the CodeRabbit REQUEST_CHANGES verdict never entered the decision, and correctly so. The human process (MEMBER review + maintainer merge) is the intended arbiter for this class; a bot's Major finding does not override a maintainer's disposition here.

**Transferable lesson (sharpens Step-0 recall for the next similar PR):**
1. A subsequent *merge at the reviewed commit* is NOT evidence the protected-path abstain was too conservative. ABSTAIN rows are excluded from agreement scoring for exactly this reason — do not let "it merged clean / a MEMBER approved / the fix looks obviously right" tempt a future call on a `.github/**` PR toward WOULD_APPROVE. The abstain is the designed outcome regardless of downstream human disposition.
2. Corollary for the reviewer/challenger side (not this approver's job, but worth the wiki): "docs-only CI-skip" / path-filter-gating PRs are themselves a CI-integrity attack surface — the filter that decides whether required CI runs can be steered by PR-controlled inputs (crafted filenames, edits to the very action being loaded via `./`). When such a mechanism is the subject of a PR, the bot findings about *bypass* are the ones that matter, not codegen.

**How to catch it:** changed-path match on `.github/**` / `**/*.yml` → protected-path clause fail → ABSTAIN_POLICY, full stop. Confirmed once more: agreement-neutral, vindicated.
