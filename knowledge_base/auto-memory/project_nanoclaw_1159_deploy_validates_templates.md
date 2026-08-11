---
name: project_nanoclaw_1159_deploy_validates_templates
description: "nanoclaw#1159 (szihs) adds fetch-skills + validate:templates to merge-train.sh's deploy tail. Reviewed inline by Main (~31st instance of the no-nanoclaw-approver rule). LGTM, 2 yellow. 🟡1 CONSTRUCTED: the comment-strip fix leaves the same hole in an echo STRING — fetch made fatal, 9/9 pass. One-line anchor fix verified both directions."
metadata:
  node_type: memory
  type: project
  originSessionId: gh-issue-slang-coworkers/nanoclaw-1159
---

# `slang-coworkers/nanoclaw#1159` — "deploy: validate coworker templates on the box, not only in CI"

Author **szihs**. Branch `fix/nv-main/deploy-validates-templates` → `nv-main`, base `c8fcfd516`
(#1151's merge), head **`c821819796`**, 3 files +109/−6. **Reviewed inline by Main** — ~31st
instance of the standing rule: the nanoclaw fork has **no approver wired**, and the
`pr_ready_for_review` webhook's generic *"route to the project's `*-pr-approver`"* is overridden
because a slang/slangpy **compiler** approver at a nanoclaw deploy-script PR is nonsensical. See
[[project_nanoclaw_pr874_webhook_route_approver]]. Comment **`5236257689`**.

⚠️`gh pr comment` failed **`GraphQL: Resource not accessible by integration (addComment)`** while
the REST route `POST /issues/{n}/comments -F body=@file` **succeeded** — same token, same repo.
`gh auth status` simultaneously claimed *"The token in GH_TOKEN is invalid"*, which was **false**
as a general statement. ⇒ ⭐⭐**A GraphQL-path permission failure is not an auth outage; try REST
before concluding the token is dead** (cf. [[project_github_actions_graphql_401_outage]]).

## The core claim reproduces

`nv-main`'s `merge-train.sh` tail = `install → check:runtime-deps → build → rebuild:claude`, then
prints *"merged, installed, verified, built, and rebuilt CLAUDE.md"*. Neither `fetch-skills.sh`
nor `validate:templates` appears anywhere in the script; both appear in `ci.yml` and
`compose-check.yml` in the claimed order. Confirmed by reading both refs.

**Tamper drills matched the author's figures exactly** — remove the gate ⇒ **3 red**; invert the
soft/hard split ⇒ **1 red**.

## 🟡1 (the finding) — comment-stripping left the hole inside a string literal

Full derivation, the constructed tamper, and the one-line anchor fix (verified green-on-real /
red-on-tamper) live in
[[feedback_stripping_comments_leaves_the_same_hole_in_string_literals]].

## The "unexecutable" tail executes with PATH shims

The PR argues the tail can only be shape-pinned. Disproved: `pnpm`/`npm` shims + a stub
`scripts/fetch-skills.sh` (real code guards on `[ -f ]`) ran all three paths on a synthetic origin:

| case | rc | rolled back | `src/foo.ts` |
|---|---|---|---|
| happy | 0 | no | `MAIN` |
| fetch throttled | 0 | no | `MAIN` (soft — proceeds) |
| validate fails | 1 | **YES** | `WORK` (hard — merge undone) |

Invocation order pinned: install → check:runtime-deps → build → rebuild:claude → fetch-skills →
validate:templates.

## 🟡2 — cold-box rollback is the DEFAULT state, and the message omits the likeliest cause

**12 of 18** declared external skills are **fetch-only** (not tracked on *any* `nv-*` branch);
only 6 are tracked somewhere (`agent-browser` on all five; `slang-clarity-review-runner`,
`slang-github-webhook`, `slang-maintainer-tools`, `slang-pr-approver` on nv-slang;
`slangpy-pr-approver` on nv-slangpy). ⛔**My first pass measured tracked-ness against `nv-main`
ONLY and got 1 of 18 — corrected before posting by looping all five branches.** ⇒ ⭐⭐**In a
multi-branch fork, "is this file tracked?" has no answer until you name the ref set.**

So the truth table's middle row (failed fetch + no cache ⇒ rollback) is a fresh box's normal
state. The failure text offers only *throttled* or *missing upstream*; the third — **no token at
all** (rc=4 / `gh_output_is_unauthenticated`) — is the likeliest and is unnamed.

## ✅ Credit recorded

- **Placement tamper ⇒ 6 red.** Moving the whole tail above the merge loop (validating the
  *pre*-merge tree) is caught by the pre-existing behavioral tests, so shape tests aren't
  load-bearing for placement — only for the soft/hard split. Reported as credit.
- Retry-loop semantics verified **by execution**, not reading: `[ … ] && break` under `set -e`
  does not kill the script; `HTTP 401` and rc=4 break on attempt 1 with **0s** slept; only
  throttling retries. Exactly as claimed.
- The author's self-recorded test defect is real and his fix is real — the finding is *residue*,
  not a refutation.

## Notes filed as properties, not bugs

- **Unbounded throttle latency:** secondary limiting is global ⇒ up to 30s/cached skill from the
  new loop (≈9 min over 18) atop the install loop's existing 30s/skill, no `timeout` wrapper.
  Same script runs hourly from `refresh-skills-cron.sh`. Only the cached path enters the new loop.
- **Rollback does not undo the fetch:** `git reset --hard` restores tracked files, but
  `gh skill install --force` already wrote `container/skills/`. No wrong-outcome case constructed.
- `validateBlock.slice(0, 400)` — measured gate→`rollback_and_fail` distance **297** chars (103
  headroom).
- **Stale citations** (cosmetic): PR says `ci.yml:144,156` (matches `1c4ef8b05`, 2026-07-27) and
  `compose-check.yml:83,92` (matches `726bad110`); at this PR's base they are `182,201` and
  `92,101`.

## Explicitly NOT verified

⛔**Could not run `validate:templates`.** This checkout borrows a `node_modules` lacking
`js-yaml`, so the composer fails to import before doing work. **Every `validate:templates` result
above is a stubbed exit code.** The author's `slangpy-reviewer → slangpy-build,
slangpy-code-reader, slangpy-github` repro is **unverified on my edge and not disputed** — per
ANCHOR C it is true about theirs. Said so in the posted review's own "what I could not verify"
section.

## State + RESUME

CI at review time (re-read while writing, not cited from earlier): `ci` **pass** 2m49s,
`check`/`guard`/`label` pass. `mergeable` returned `UNKNOWN` on the second poll (GitHub
recomputing); **4 commits behind `nv-main`** (`fe6b3ce98`). Not draft, 0 reviews before mine.
Merge is szihs's (maintainer-owned `fix/nv-main/*` → `nv-main`).

**RESUME:** (a) szihs replies on 🟡1 ⇒ re-check the anchor change and re-run the 4 tampers;
(b) if it merges with 🟡1 open, the soft/hard assertion is live-but-blind on `nv-main` — wants a
follow-up; (c) a `synchronize` ⇒ re-diff base...head to check pure-rebase vs content change
before re-reviewing.

Related: [[project_nanoclaw_1154_ownership_one_matcher]] (sibling szihs deploy-path PR, same
inline-review handling), [[feedback_a_guard_must_run_where_the_failure_is_silent]],
[[feedback_a_ci_step_added_on_a_parent_branch_does_not_compose]].
