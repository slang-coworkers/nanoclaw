---
name: Duplicate PRs are a dev↔prod cross-instance collision
description: The 11367/11370/11374/11375 duplicate-PR pairs come from TWO NanoClaw instances (this dev instance + prod) both auto-fixing the same live shader-slang/slang issues as the same nv-slang-bot identity
type: project
originSessionId: 175e1832-2cf0-4ccf-a10a-8b4b78df4659
---
The duplicate-PR pairs on shader-slang/slang (issues 11367, 11370, 11374, 11375) are a **cross-instance collision**, NOT a within-pipeline dedup bug.

**Confirmed via our fixer's session JSONL (ncl sessions messages, 2026-06-02):**
- **`fix/issue-NNNN` DRAFTS = THIS (dev) instance.** Our slang-fixer (group `ag-1779277891574-i5m2gg`) created them — JSONL shows "Draft PR #11386 opened", "PR opened (draft) /pull/11371", report_pr_created(11371), body-amend of #11379, and a relay to push `fix/issue-11374`→#11387. Our instance uses worktrees `/workspace/agent/wt-slang-NNNN` on `fix/issue-NNNN` branches.
- **`dev/slang-fixer/NNNN-*` READY PRs = NOT ours (prod).** Zero references across all 200 of our fixer sessions. Our instance never uses the `dev/slang-fixer/*` convention — the orchestrator itself flagged the mismatch to the fixer ("`fix/issue-11370` does not match the `dev/<coworker-folder>/` convention"). Authored by the same `nv-slang-bot[bot]`; by elimination = the prod instance's slang-fixer. (#11394, #11397, #11398.)
- **#11377 (11374's ready half) is a HUMAN PR** by `jvepsalainen-nv` — our draft #11387 duplicated it.

**Why:** both the dev and prod NanoClaw instances run the slang-fixer pipeline pointed at the SAME live upstream repo, as the SAME bot account, so each opens its own PR for the same triaged issue and neither sees the other.

**INTENTIONAL — operator confirmed 2026-06-02 ("I want dev to continue pushing PR, we would do A/B test with prod").** The dev↔prod dup PRs are a deliberate **A/B comparison**: dev pushes its `fix/issue-*` PR, prod pushes its `dev/slang-fixer/*` PR, both stay open so the operator can compare the two instances' fixes for the same issue. So:

- **Do NOT treat dup pairs as DEGRADED / a problem.** Do NOT close, consolidate, or escalate them for cleanup. The supervisor should classify dev/prod dup pairs as `ab-test` (normal), not `DEGRADED`.
- **The ONE hard rule: keep the two instances' work separate.** This dev instance must only push to its own `fix/issue-*` PRs; NEVER push onto prod's `dev/slang-fixer/*` PRs (and vice versa). Cross-pushing contaminates the A/B data point.
- **Known contamination (2026-06-02), ACCEPTED:** my "#11375/#11402 consolidation" mistakenly dispatched this dev instance to push 2 commits (`274762fe0`, `4f298fe8d`, authored `nv-slang-bot[bot]`) ONTO prod's PR #11398 (`dev/slang-fixer/fix-11375-vm-bool-lit`, base `slang-coworker-nanoclaw[bot]`), making it go green via dev's desc-handle-4 port + #11402 test. **Operator decision: ACCEPT for now (no unwind) — but keep dev/prod strictly separate going forward.** #11375/#11402 is a one-time compromised A/B point; do not repeat. Dev's own #11379 stays open as dev's A/B entry.
- **[MUST going forward] Strict dev/prod PR separation for clean A/B.** When dispatching any fixer/consolidation work, the target PR's branch MUST match this dev instance's convention (`fix/issue-*`). NEVER dispatch a push/commit onto a `dev/slang-fixer/*` (prod) PR. Before any "consolidate onto PR #N" dispatch, check #N's head branch — if it's `dev/slang-fixer/*`, STOP (that's prod's; dev keeps its own separate PR instead).

Attribute dup provenance by **branch convention**: `fix/issue-*`=this dev instance (nv-slang-bot[bot]), `dev/slang-fixer/*`=prod (slang-coworker-nanoclaw[bot]). Earlier "self-inflicted, our bot opened two PRs" notes AND the "isolate to one writer" recommendation are both superseded — the operator wants both writers for A/B.

## #11410/#11422 — dev opened a PR on PROD's branch convention (2026-06-03)

Dev's slang-fixer opened **draft PR #11422 for issue #11410 on branch `dev/slang-fixer/issue-11410`** (prod's convention), authored by `nv-slang-bot[bot]` (dev's identity). Provenance contamination: dev squatting on prod's `dev/slang-fixer/*` namespace — muddies the clean dev=`fix/issue-*` / prod=`dev/slang-fixer/*` A/B discriminator and latently blocks prod's namespace if prod later processes #11410.

**Root cause = my error.** I told the fixer to "use a `dev/slang-fixer/...` branch name (matches the webhook round-trip convention)" — conflating the webhook-routing `dev/<coworker-folder>/` convention (CLAUDE.md GitHub-webhook section) with the operator's A/B separation rule. **The A/B rule wins: dev slang-fixer PRs MUST be `fix/issue-*`.** `report_pr_created` handles webhook round-trip routing — do NOT borrow the `dev/<folder>/` branch name for routing.

**Resolution: accepted-for-now / no unwind** (per the #11375 precedent). Closing #11422 + reopening on `fix/issue-11410` would churn a PR that maintainers (jvepsalainen-nv = now assignee; jhelferty-nv; expipiplus1) are mid-evaluation on. Revisit branch hygiene only after the maintainer evaluation resolves (moot if they close it as dup). Operator may override.

## Ownership test correction (2026-06-08) — branch name is NOT a reliable "ours" signal [IMPORTANT]

The `fix/issue-*`-branch heuristic above is **unreliable for ownership** and caused a near-miss. On 2026-06-08 the supervise board mis-classified two **human** PRs as "ours" because they're on `fix/issue-*` branches: **#11242 (#11002) and #11234 (#11004) are authored by `szihs` (Harsh Aggarwal, NVIDIA — a human) on their OWN fork `szihs/slang`.** Acting on the board, I dispatched a "close our draft #11242" + "push fixes to #11234" — i.e. nearly closed/pushed a human's fork PR. Caught it by checking the author + head repo; aborted before any GitHub write.

Also: a PR can be `nv-slang-bot[bot]`-authored yet live on a fork — **#11337 (#11333)** is bot-authored but head repo is `szihs/slang`, so we likely can't push to it.

**Reliable ownership test before driving / closing / pushing / commenting on ANY PR:** author == `nv-slang-bot[bot]` **AND** head repo == `shader-slang/slang` (NOT a fork). Command: `gh pr view N --json headRepositoryOwner,author,isCrossRepository` or `gh api repos/shader-slang/slang/pulls/N --jq '{user:.user.login, headRepo:.head.repo.full_name}'`. **Branch name (`fix/issue-*`) alone proves nothing** — humans and forks use it too. The supervise board's "ours" classification must apply this test, not the branch heuristic.

## HEAD-commit difference is NOT a cross-instance tell (2026-06-17) [false-positive guard]

On #11613 I saw a bot comment citing master HEAD `da319e61a` when my triager had earlier verified at `03e1cb7a6`, and concluded "different HEAD ⇒ posted by the parallel prod instance." **Wrong.** It was my own dev triager re-verifying at current HEAD two days later (master simply advanced; the operator/dashboard-admin had re-woke it directly to re-verify-at-HEAD-and-post under the retired auth gate). The webhook reached me only as an echo because the post was confirmed on the operator→triager edge (`in_reply_to=11`), bypassing my edge.

**Guard:** a HEAD/commit-SHA difference between two analyses proves nothing about provenance — elapsed time advances HEAD for the *same* instance. Before logging any cross-instance collision, verify via (a) comment **authorship + count** (`gh api .../issues/N/comments` — was there actually a duplicate?), and (b) the **timeline/edges** (did a coworker get woken on a different edge?). One bot comment that matches our own verdict is ours, not a collision. Do not add such cases to the collision log.
