---
name: project_nanoclaw_kb_sync_pr_autoref_noop
description: Nightly kb-sync PRs in slang-coworkers/nanoclaw auto-merge in seconds and have no approver — no-op the pr_ready_for_review webhook
metadata: 
  node_type: memory
  type: project
  originSessionId: 658467b7-46b7-4128-8fe6-ddbb7ee43e48
---

The `slang-coworkers/nanoclaw` repo emits a nightly automated PR titled `knowledge_base sync <date>[: <variant>]` (author `nv-slang-bot`, base `nv-coworkers`) — an automated snapshot of coworker memory + learnings with PII scrub applied. It **auto-merges within ~3-8 seconds** of opening.

**Match on title + author + base, NOT on head branch.** The head branch varies by which nightly job produced it — observed `kb-sync-<yyyymmdd>` and `kb-wiki-fold-<yyyymmdd>` (the `/learnings-wiki` synth+fold variant, title suffix `: wiki-synth fold`). A head-branch-keyed rule silently fails to recognize the class on a new variant and would route a merged data snapshot to an approver.

A `github.pr_ready_for_review` webhook for these arrives with the generic task "route to the *-pr-approver". **Do not route it.** Reasons:
- It is already `state: closed` / `merged` by the time the webhook lands (bot self-merge).
- The nanoclaw repo has **no `*-pr-approver` coworker** in Main's destinations — only `slang-pr-approver` / `slangpy-pr-approver` exist, scoped to their repos (see [[project_nanoclaw_pr874_webhook_route_approver]]).
- It is a data-only snapshot, not code.

Action: **no-op** (already-merged automated data snapshot, no applicable reviewer). Verify state first — if a future kb-sync PR ever lands *unmerged*, re-evaluate. Related: [[feedback_webhook_dispatch_by_event]].

Confirmed instances (each verified `merged` before no-op): #1063 `kb-wiki-fold-20260804` (2026-08-04, 3s open→merge); #1070 `kb-sync-20260805` (2026-08-05, **13s** open→merge, merge commit `92d7670e`, 538 files +34786/−938); #1073 `kb-wiki-fold-20260805` (2026-08-05, **2s** open→merge — fastest observed, merge commit `beba3713`, 909 files +46093/−2458).

⛔**#1073 adds a SECOND truncation surface the #1070 lesson did not cover: the FILES listing and the DIFF BODY truncate independently.** Asserting `listed == changedFiles` (909/909) proves the *path census* is complete and says nothing about whether the *content* you scanned is complete — a short diff fetch would yield a clean PII scan over a fraction of the added lines, silently. ⇒ **Assert BOTH: `listed == changedFiles` for the census AND `added-content-lines == additions` for the body** (`grep '^+' diff | grep -v '^+++'` → 46093 == reported `additions`). Two independent bounds, two independent assertions; neither substitutes for the other. Same family as [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]] — *"I ran a control"* answers the matcher question only.

**Data-only verified for #1073 (full 909):** top-level 100% `knowledge_base/` (459 `wiki/`, 402 `sources/`, 48 `shared/`); extensions **909/909 `.md`** — zero code/workflow/config (matcher for `.ts/.js/.py/.sh/.yml/.toml/Dockerfile/package.json/.github` → 0, positive control fired 5/5).

**PII scan of all 46,093 added lines (controls fired on planted signal for every matcher — email 1, secret 5/5, bearer 2/2):** email-shaped **14, all bot `noreply`** (`nv-slang-bot@users.noreply.github.com` ×6, `noreply@anthropic.com` ×6, `noreply@github.com` ×2); **non-bot emails 0**; secret-shaped (AWS/`ghp_`/`gho_`/`github_pat_`/`sk-ant`/`xox*`/PRIVATE KEY/JWT) **0**; bearer/authorization headers **0**; 3 `REDACTED` markers present ⇒ the body's scrub claim is corroborated by artifacts, not just asserted. Path-shaped hits are all benign and explained: `/home/node` ×24 (container workspace path, same in every instance), `0.0.0.0:10254` ×2 (OneCLI loopback port, already cleared in #1070), `/users/jhelferty-nv` ×2 — ⭐**not a filesystem path: it is a `GET /users/<login>` GitHub API path quoted inside prose, and the login is a PUBLIC GitHub handle.** ⇒ **A `/users/...` match is ambiguous between an API route and a macOS home directory — read the surrounding line before classifying it as a leak;** the regex cannot tell them apart.

⛔**#1070 exposed a REAL instrument trap in the "data-only" check: `gh pr view --json files` returned exactly 100 of 538 paths — a PAGE, not the population — and `--paginate` DIED AT PAGE 2 on a OneCLI GitHub 401, leaving a 100-file listing that looked like a complete census.** Both failures are silent and the truncated set was 100% `knowledge_base/` ⇒ it would have "confirmed" data-only from 19% of the diff. ⇒ **Enumerate with explicit `?per_page=100&page=N` in a loop and ASSERT `listed == changedFiles`** (538/538, 538 unique) before making any all-files claim. Direct instance of [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]] — a positive control on the *matcher* passes happily while the *input set* is truncated.

**Data-only verified for #1070 (full 538):** top-level 100% `knowledge_base/` (362 `shared/`, 171 `auto-memory/`, 5 `agent/`); extensions 534 `.md` / 3 `.txt` / 1 `.json` (`agent/memory/supervisor-state.json` — supervisor tick state, data). Zero code/workflow/config paths. Every matcher run with a positive control that fired.

⭐**Worth repeating because the repo is PUBLIC (`visibility: PUBLIC`) and the PR body only ASSERTS the PII scrub:** scanned all 34,786 added lines — email-shaped **7, all bot `noreply`** (`nv-slang-bot@users.noreply.github.com`, `noreply@anthropic.com`, `noreply@github.com`); secret-shaped (AWS/`ghp_`/`sk-ant`/`xox`/PRIVATE KEY) **0**; OneCLI vault project-path tokens **0**; internal hosts **1** = `0.0.0.0:10254` inside a diagnostics table (loopback port, not a secret). Controls fired on planted signal (1 email, 4 secrets, 1 vault path, 3 internal hosts) ⇒ the zeros are measured, not inert. **Scrub claim holds for this instance; re-check per instance rather than trusting the body text.**
