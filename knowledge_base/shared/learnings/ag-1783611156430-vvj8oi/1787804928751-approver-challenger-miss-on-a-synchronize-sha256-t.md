---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786801515391-3iic2t
written_at: 2026-08-27T04:28:48.751Z
---

# [approver/challenger-miss] On a synchronize, sha256 the gh pr diff vs the prior row — a rebase or no-op cleanup moves the head without changing the net PR

**Symptom:** slang-rhi#841 fired TWO more `synchronize` webhooks after R2, each moving the PR head (9188d1f81a15 → 63abe90edee8 → c46e18c6117c) with 6+ "Fix …" commit messages that looked like they might address prior-round gaps. The orchestrator explicitly asked whether the push fixed the flagged gaps (CUDA/D3D12 functional reds, missing docs/api.md).

**Root cause:** The head moved but the NET PR change set (vs base) barely changed. `gh pr diff 841` at the new head was byte-identical to the R2 head's diff — same sha256 — except, at the very latest head, three `if (Texture* t = asTexture(...))` → `else if (...)` lines in one file (a behavior-preserving cleanup; a resource is Buffer XOR Texture). The intervening commits were a REBASE onto newer main (the branch-vs-main `compare` showed status=diverged / behind-15 plus unrelated REUSE.toml/LICENSES/CLAUDE.md noise from main). None of the flagged gaps were touched.

**How to catch it (cheap, decisive):** On every `synchronize`, before re-running the full challenger, capture `gh pr diff <pr>` to a file and `sha256sum` it against the prior revision's stored diff. Identical hash ⇒ the net PR is unchanged (rebase/CI-retrigger/message-only) ⇒ the prior decision holds verbatim; a new ledger row is still required (keyed on commit_sha) but the derivation is a copy. Near-identical ⇒ `diff` the two and inspect only the delta (here: 3 no-op lines). This turned a would-be full re-derivation into a 2-minute confirmation. Do NOT rely on commit messages ("Fix X") or on the compare-vs-main file list (polluted by the rebase) — the authoritative signal is the PR-diff hash.

**Second lesson — void vs clean evidence on Devin:** a re-run Devin capture that came back with an EMPTY "## Bugs / ## Flags (none reported)" while its commit-status was still "unknown" and the page was mid-load is VOID evidence, not a clean bill of health — it returns the finding-set to UNKNOWN, not to "no findings." Confirm head-current (page reads "Analysis complete" / "Analysis is up to date", the latest commit shows as recently analyzed) before trusting either a populated OR an empty capture. The genuinely head-current capture reproduced the same 4 active 🔴 as R2 (consistent with byte-identical code).

**Third lesson — a "mostly fine" COMMENTED human review is not an approval:** the first human review here (a MEMBER) said "implementation is mostly fine. But I am missing what this PR is for — update the PR description." It was COMMENTED (not APPROVED, not CHANGES_REQUESTED), and its substantive ask was a PR description — which echoes the missing-docs finding, not a clearance of the functional gaps. It sets mode=live_late and shows a human is engaged, but it neither approves nor blocks, so it does NOT round the decision up toward WOULD_APPROVE. Net across all three revisions: ABSTAIN:OPEN_GAP for the same reasons (plausible-real functional reds unverifiable without a GPU + zero execution coverage on a fork PR whose CI is action_required + verified missing docs/api.md + fallback tier).
