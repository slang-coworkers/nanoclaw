---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786966663639-3y1j9a
written_at: 2026-08-17T15:06:01.200Z
---

# [approver/clause-gap] eval-clauses.py compare API 404s on a MERGE-COMMIT head — manufactures spurious ABSTAIN_INFRA on no_protected_paths + tier_eligible

## Case
shader-slang/slang#12539 @ `d9ce4ff5d65d9d688b0eb22909074139798f461c`. The PR head was a **merge commit** (`Merge remote-tracking branch 'upstream/master' into fix/...`, two parents). `eval-clauses.py` computes both `no_protected_paths` and `tier_eligible` from `repos/{repo}/compare/{base_ref}...{sha}` (`:204`). That call returned **HTTP 404 Not Found** — so BOTH clauses came back `unevaluable`, which the skill maps to `ABSTAIN_INFRA:CLAUSE_UNEVALUABLE`.

## Why this is a distinct failure from the known compare-truncation gap
Prior art `1785863597767` covers `compare` **truncating per-file counts to 0/0** on a *large* PR — that fails toward FALSE ELIGIBILITY (undercount). This is the opposite direction and a different mechanism: a **hard 404** on a merge-commit head makes the clauses *unevaluable*, failing toward a FALSE ABSTAIN_INFRA. The 404 reproduced with the branch tip parent (`81540620...head`) and the base-ref-oid parent (`d7f2f0cb...head`) too — it is the merge-commit head as the compare endpoint, not the base choice.

## Root cause (mechanism, not just symptom)
GitHub's `compare/A...B` uses `...` (three-dot = merge-base..B). When B is itself a merge commit that merged the very base branch in, the endpoint can 404 rather than return the diff. The changed-file set is still fully computable — GitHub itself computes it for the PR (vs the merge base) and exposes it on `pulls/{n}` / `gh pr view --json files`.

## How to catch it / recovery
- An `unevaluable` on `no_protected_paths`/`tier_eligible` whose evidence string contains `compare: ... 404` is NOT a real infra void — it is a recoverable fetch shape. Do NOT let it manufacture ABSTAIN_INFRA.
- Recover the authoritative changed-file list from `gh pr view <pr> --repo <repo> --json files,additions,deletions,changedFiles` (GitHub-computed vs merge base). Hand-check paths against the loaded policy's `protected_paths` globs and sizes against `max_total_lines`/`max_files`, and mark the clauses `pass` with a `hand_verified` note.
- This is an instance of the standing rule: **a failing/void fetch is a claim about the request, not about the world — probe the endpoint's domain and recover the datum another way before abstaining.** (Same family as the bare-`--paginate` OneCLI-proxy 401 that makes `collect-reviews.sh` return exit 21.)

## Fix (for the script, if touched later)
`eval-clauses.py` should fall back to `pulls/{pr}/files` (paginated) or `gh pr view --json files` when `compare` 404s, so a merge-commit head does not zero out the two path clauses.
