---
name: reference-slang-mcp-is-an-independent-github-instrument
description: "A gh 401 is path-classed (REST works / GraphQL 401s), not global — and slang-mcp is a second, independently-credentialed GitHub reader."
metadata: 
  node_type: memory
  type: reference
  originSessionId: 49738ebf-cac0-45e5-9cd8-f14d4d7db648
---

## First: a `gh` 401 is almost never global — classify it by path

**Corrected 2026-08-04** (I got this wrong on a supervisor board; `slang-triager` caught it).
The failure I called "GitHub auth is down fleet-wide" was a clean split:

| path class | example | result |
|---|---|---|
| **REST — works** | `gh api repos/<o>/<r>/issues/<n>`, `.../issues/<n>/comments`, `gh run list --workflow ci.yml` | **200**, `X-Ratelimit-Limit: 6000` |
| **GraphQL — 401** | `gh api graphql`, `gh pr list --head`, `gh pr view --json`, most `gh <x> view --json` | **401 Bad credentials** |
| **token introspection — 401** | `gh auth status`, `gh api rate_limit` | **401** `app_not_connected` + a OneCLI `connect_url` |

⛔ **`gh auth status` and `gh api rate_limit` are NOT capability probes.** They describe the *token*;
under OneCLI's per-path credential injection they fail while the data paths the proxy does inject for
succeed. My three probes all happened to land in the 401 class (two introspection + one
GraphQL-backed `gh issue view`), and `pull-universe.sh` dying on all 623 batches looked like
corroboration — but it is GraphQL-first too. **One backend's failure, counted four times.**

⭐ **Probe the operation you intend to perform, and show a positive control before claiming
unavailability.** Cost of getting this wrong: 6 CI cells reported `⚠️ unread` when all 6 were
computable, and a real `❌ stale` rebase nudge (#11004) went missing for a tick.

**What is genuinely GraphQL-only** (so unavailable during this failure mode): `mergeStateStatus`
(⇒ cannot compute `✅⤵️ BEHIND`) and `closedByPullRequestsReferences` (⇒ Step-7 superseded-PR
postmortem detection). Say *those* are unread — not CI as a whole.

## Second: `slang-mcp` is an independent reader

The `slang-mcp` MCP server (`mcp__slang-mcp__github_get_issue` / `github_get_pull_request` /
`github_get_pull_request_reviews` / `github_list_issues` / `github_search_issues`) **holds its own
credential**, separate from the OneCLI `gh` injection, and kept working through the above. Useful as
the second instrument when `gh`'s GraphQL class is down: it returns issue/PR bodies, comments,
review state, assignees, and the draft flag.

It does **not** cover `gh run list` CI conclusions or `gh pr list --head` — but per the table above,
`gh run list` is REST and usually still fine, so reach for it directly.

⭐ **So "GitHub is unreachable" is nearly always the wrong conclusion — name the failing path class,
and use the second instrument to decide whether the fault is the credential or GitHub itself.**
Corollary to the standing rule that capability-negatives must be re-probed each round (I once
asserted a `GH_TOKEN` 401 six times after it had cleared).

⭐ **A coworker contradicting your infra claim with a verbatim probe + status code is data.**
Re-derive immediately; do not restate the nudge. See
[[feedback_consistency_is_not_completeness_in_review]] on not bridging a gap with a plausible
substitute.
