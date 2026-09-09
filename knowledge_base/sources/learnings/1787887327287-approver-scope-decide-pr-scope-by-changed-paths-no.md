---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787866405723-205ubp
written_at: 2026-08-28T03:22:07.287Z
---

# [approver/scope] Decide PR scope by changed paths, not branch/repo branding — nv-* fork-syncs

**Symptom / setup:** slang-coworkers/nanoclaw#1350, "Sync nv-slangpy with upstream/main", author `nv-slang-bot[bot]`, base `nv-slangpy` ← head `sync/upstream-nv-slangpy`. The branch name and the `nv-slangpy` branding read as SlangPy work; the orchestrator framed it as an `nv-slangpy` sync. It is NOT SlangPy code: all 64 files (+3970/-189) are nanoclaw agent-framework (`.claude/skills`, `container/agent-runner`, `src/claude-composer`, `scripts/update`, `setup/`). Zero `slangpy/`, `src/sgl/`, `src/slangpy_ext/`.

**Lesson (transferable):** For a repo-scoped approver, *scope is decided by the changed paths at the pinned commit, not by branch name, repo affiliation, PR title, or the dispatch framing.* A `git compare`/`gh pr view --json files` on the top-level dirs settles it in one read and beats any branding signal. Cheap read first, before any harvest/Devin/clauses — a scope exclusion short-circuits before Step 1 and saves the whole review pipeline.

**Calibration outcome (merge join):** decision was ABSTAIN_POLICY / OUT_OF_SCOPE @ dabca043. The PR merged — merged_by `szihs` (human), and the **merged head_sha == my decision commit dabca043** (no follow-up commits). A human maintainer handled it directly through nanoclaw's own process; no slangpy-approver merits verdict was ever needed or wanted. **The out-of-scope abstain held: scope boundary confirmed correct, no gap left.** Abstains are excluded from agreement scoring, and an out-of-scope abstain matched by a clean human merge is the system working as intended, not a disagreement.

**How to catch it next time:** an `nv-*` / fork-sync / bot-authored PR against a fork's config branch is a red flag to check paths before assuming scope — the branding is the misleading part. If `nv-*` framework-sync PRs become a recurring stream (volume >> 1), that's the trigger to consider a dedicated nanoclaw-scoped approver with its own policy; a single one is correctly manual-review.

**Infra note (already documented, not re-filing):** `record_human_verdict` is not a registered MCP tool in the approver container, so this merge join could not be stamped onto the decision row via the instructed mechanism. See prior memory `tool-reply-is-not-the-artifact.md`.
