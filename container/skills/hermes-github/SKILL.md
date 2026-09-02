---
name: hermes-github
description: "GitHub operations for Hermes Agent: fork clone, one worktree per target, draft PRs to the FORK only, upstream issue lookups, CI inspection and reruns. Never opens PRs against NousResearch/hermes-agent."
provides: [repo.read, repo.write, repo.pr, issues.read, issues.write, ci.rerun]
allowed-tools: Bash(git:*), Bash(gh:*), Read, Grep, Glob
---

# Hermes GitHub

## Remotes and the fork-only rule

- Upstream `https://github.com/NousResearch/hermes-agent` is READ-ONLY for us: issues, PRs, tags. The pinned release is tag `v2026.8.31` (= v0.21.0), mirrored read-only at `/workspace/extra/hermes-release`.
- The fork is the `origin` remote of `/workspace/agent/hermes-agent` (owner set by the operator; read it with `gh repo view --json nameWithOwner -q .nameWithOwner`). ALL pushes and ALL pull requests target the fork: `gh pr create` MUST carry `--draft --repo <fork-owner>/hermes-agent --base <fork-default-branch>`. Never `--repo NousResearch/hermes-agent`, never `git push upstream`. If `origin` resolves to `NousResearch/hermes-agent`, stop and report `blocked`.
- Credentials are injected by the OneCLI proxy; never paste or log tokens (`/onecli-gateway`). No force-push, no history rewrites, no `rm -rf` (base safety invariant).

## Clone / worktree

```bash
git clone <fork-url> /workspace/agent/hermes-agent && cd /workspace/agent/hermes-agent
git remote add upstream https://github.com/NousResearch/hermes-agent.git
git fetch upstream --tags && git fetch origin
git worktree add /workspace/agent/wt-<target_slug> -b plugin/<name> origin/<default-branch>   # one worktree per target, never the main checkout
git -C /workspace/agent/wt-<target_slug> diff --stat v2026.8.31 -- plugins/ website/docs/ tests/     # our delta vs the pinned release
```

Branches: `plugin/<name>` for meta-team plugin work (the NanoClaw default `dev/hermes-builder/<target_slug>` is also fine); upstream convention is `fix/|feat/|docs/|test/|refactor/<description>` (CONTRIBUTING.md:919-927). Never read, write, or `git worktree remove` a sibling `wt-*`.

## Search first (CONTRIBUTING.md:21-36) — issues.read

```bash
gh search issues --repo NousResearch/hermes-agent "<terms>"
gh search prs --repo NousResearch/hermes-agent --state all "<terms>"
gh issue view <n> --repo NousResearch/hermes-agent --comments
gh pr view <n> --repo NousResearch/hermes-agent --json title,body,files,state,mergedAt
gh api repos/NousResearch/hermes-agent/git/ref/tags/v2026.8.31 --jq .object.sha        # release SHA (e.g. for `hermes plugins install --ref`, which needs a 40-char SHA — plugins_cmd.py:591-594)
```

The tracker lags the code — also grep the release tree for the capability before proposing it. Cite issue/PR numbers in the ADR and PR body. `issues.write` on upstream is limited to what the orchestrator explicitly asks for (factual, `file:line` from the release); default is read-only. Never open upstream issues about the fork's own plugins.

## Commits

Conventional Commits `<type>(<scope>): <description>` — `feat(plugins): …`, `fix(gateway): …`, `test(plugins): …`, `docs(plugins): …`, `chore(deps): …` (CONTRIBUTING.md:944-969). Separate commits for the failing acceptance test and the implementation so CI shows the delta. If `pyproject.toml` changed, the regenerated `uv.lock` goes in the same PR (`uv-lockfile-check.yml`; AGENTS.md:598-618). Before a merge-ready state, rebase onto the fork's current default branch and check `git diff HEAD~1..HEAD` for unexpected deletions (AGENTS.md:1546-1552).

## Draft PR to the fork (builder only, after the critique stages are recorded)

```bash
cd /workspace/agent/wt-<target_slug>
git push -u origin plugin/<name>
gh pr create --draft --repo <fork-owner>/hermes-agent --base <default-branch> --head plugin/<name> \
  --title "feat(plugins): <name> — <one line>" --body-file /workspace/agent/reports/<target_slug>-pr.md
```

PR body (CONTRIBUTING.md:929-942 + meta-team additions): **What / Why**; **Requirement** (FR-x/SR-x id + ADR path); **Plugin surface** (manifest key, hooks/tools/middleware registered); **CORE-CHANGE**: `none`, or the ADR section verbatim with the blocking `release file:line`; **How to test** (`scripts/run_tests.sh tests/plugins/test_<name>.py`, `hermes plugins doctor plugins/<name> --ci`); **Platforms tested**; related upstream issues. Then `mcp__nanoclaw__report_pr_created({repo, pr_number})` and send the peer-review request to `hermes-reviewer` (round 1 is an unmarked fresh delegation with `thread_id="hermes-<req-id>"`; `[Fix Review Request]` only as a reply to a `[Review Verdict]` — see peer-review.md). `gh pr ready` only after `[Review Verdict] APPROVE`. Upstreaming to NousResearch is a human decision — never yours.

Reviewer side (own container, read-only on the fork):

```bash
git fetch origin pull/<n>/head && git worktree add /workspace/agent/wt-review-<n> FETCH_HEAD   # or: gh pr checkout <n> --detach
gh pr diff <n> --repo <fork-owner>/hermes-agent --name-only | grep -vE '^(plugins/|website/docs/|tests/)'   # non-empty ⇒ CORE-CHANGE ADR section required
```

The verdict travels as `[Review Verdict]` on the builder's edge (`in_reply_to=<review-request-id>`); the reviewer never posts a GitHub review (`gh pr review` is a GitHub write) — see no-push.md.

## CI on the fork — ci.rerun

```bash
gh run list --repo <fork-owner>/hermes-agent --branch plugin/<name> --limit 5
gh run view <run-id> --repo <fork-owner>/hermes-agent --log-failed
gh run rerun <run-id> --repo <fork-owner>/hermes-agent --failed        # failed jobs only
gh pr checks <n> --repo <fork-owner>/hermes-agent --watch
```

`ci.yaml` (38-182) fans out by changed area: Python tests (`tests.yml`, 30-min cap, `scripts/run_tests.sh`), `lint.yml` (`ruff check .` blocking), `tests-os.yml`, `js-tests.yml`, `docs-site-checks.yml`, `uv-lockfile-check.yml`, `supply-chain-audit.yml`. A `⚠ FLAKY` file in a test log is a bug to fix, not a rerun candidate; rerun only for infrastructure failures (runner lost, registry/network) and say why in the PR. Fork owners often have Actions disabled — if `gh run list` is empty, run the same checks locally (`/hermes-build`) and state that in the PR body.

## From project

- `CONTRIBUTING.md:21-36` (search first), `88-102` (third-party plugins stay out of tree), `919-942` (branches, before submitting, PR description), `944-969` (commits)
- `AGENTS.md:598-618` (pinning + `uv lock`), `1546-1552` (rebase before merge; check for unexpected deletions)
- `.github/workflows/ci.yaml:38-182`, `tests.yml`, `lint.yml`, `uv-lockfile-check.yml`; `hermes_cli/plugins_cmd.py:591-594`; `README.md:12, 254`
- NanoClaw: `container/spines/base/context/chain-reporting.md:42` (`report_pr_created`), `container/spines/base/invariants/safety.md`, `container/workflows/implement/WORKFLOW.md:31-44` (worktree per target)
