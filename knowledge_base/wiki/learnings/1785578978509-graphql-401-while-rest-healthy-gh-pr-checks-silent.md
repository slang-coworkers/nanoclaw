---
title: "GraphQL 401 while REST healthy — gh pr checks silently false-greens a CI sweep (recurred 2026-08-01)"
type: learning
topic: ci-tooling
source: learnings/1785578978509-graphql-401-while-rest-healthy-gh-pr-checks-silent.md
---

# GraphQL 401 while REST healthy — gh pr checks silently false-greens a CI sweep (recurred 2026-08-01)

## Signature (recurrence of the App-token-refresh gateway split; see project_github_gateway_actions_graphql_401)

On 2026-08-01 ~10:00Z the GitHub gateway was in a **partial** state during a Slang CI-babysitter sweep:
- `gh auth status` → "The token in GH_TOKEN is invalid."
- **GraphQL 401**: `gh api graphql -f query='{viewer{login}}'` → `Bad credentials (HTTP 401)`.
- **REST 200 (fully healthy)**: `gh api repos/...`, `.../pulls/N`, `.../commits/<sha>/check-runs`, `.../actions/runs`, and **`gh run rerun <id> --failed` all succeeded.**

## The trap this creates

`gh pr checks <N>` and `gh pr view <N>` are **GraphQL-backed**. When GraphQL 401s, `gh pr checks` prints the 401 to **stderr** and returns **nothing on stdout** — so a sweep loop that greps stdout for `fail` sees zero failures and reports **every PR false-green**. Observed directly: my first scan of 20 PRs returned "no failures" for all 20; only dumping raw output revealed the 401. This is silent and dangerous for any CI-health / merge-babysitter tool.

## Workaround (do the whole sweep via REST)

Enumerate failures per PR without GraphQL:
```
sha=$(gh api repos/shader-slang/slang/pulls/$PR --jq .head.sha)
gh api "repos/shader-slang/slang/commits/$sha/check-runs?per_page=100" \
  --jq '.check_runs[] | select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out") | "\(.conclusion)\t\(.name)\t\(.details_url)"'
```
Cross-platform discriminator (did the *same* job pass elsewhere on this head?) also works via check-runs: group by `.name` + `.conclusion`. `gh run view/rerun` and `gh api .../actions/...` are REST and unaffected.

## Rule

**Never trust `gh pr checks`/`gh pr view` empty output as "green" without confirming GraphQL is up.** If a sweep sees suspiciously-uniform all-green, probe `gh api graphql '{viewer{login}}'` first; if it 401s while REST works, switch the entire failure-enumeration to the REST `check-runs` endpoint and proceed — the job is fully doable. Root cause historically = App-token refresh cron death (gh missing on migration host, fixed 07-17); a fresh GraphQL-401-while-REST-ok is a recurrence of that facet, worth an operator ping via parent.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785578978509-graphql-401-while-rest-healthy-gh-pr-checks-silent.md`_
