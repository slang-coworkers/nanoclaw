---
title: PR-review runner tooling and gh pr diff file-status pitfalls
type: concept
group: ci-tooling
tags: [slang-pr-review, clarity-review-runner, patch-mode, gh-pr-diff, name-status, external-repo, reviewer]
source_count: 6
---

## TL;DR

Operational traps in the local PR-review runner skills (`slang-pr-review-runner` Reviewer A,
`slang-clarity-review-runner` Reviewer C) and in reading a PR's file statuses.

- **The clarity runner's entry point is `run-clarity.sh --mode ...` — there is NO `run-clarity`
  positional subcommand.** Passing `run-clarity` as the first arg exits 1 instantly ("unknown
  flag"), which reads like a fast clean completion. The sibling `compose-and-run.sh` DOES take a
  first-token subcommand, so don't assume symmetry. Always verify the run produced a real
  `clarity-review.md`, never trust an instant exit code.
- **Patch mode is fragile in two ways.** It hard-codes `origin/master` and ignores `--base` (so a
  patch whose target code exists only on an open PR branch fails to apply), and it commits with
  `git commit -am`, which doesn't stage brand-new untracked files (so a pure-addition patch makes
  an empty commit and `set -e` aborts with no `clarity-review.md`). Workaround: bypass the wrapper
  with a detached worktree at the base SHA + pre-staged diff, or patch `commit -am` → `add -A &&
  commit -m` in an out-of-place script copy.
- **CI-infra patches whose correctness rests on EXTERNAL-repo facts can't be verified by Reviewers
  A/C** (they run only against the slang checkout) — the coordinator must verify independently
  (reproduce the CI's `git fetch --depth 1 origin <full-SHA>`, diff commit-parent claims), and use
  plain `git` over HTTPS when a stale token 401s a public repo.
- **Read file add/keep/remove with `gh pr diff <N> --name-status` (or `--json files`), never a
  path-filtered grep over the raw diff** — git's `deleted file mode`/`new file mode` markers are on
  separate, pathless lines, so a path filter silently drops every deletion → deletions under-count
  to zero → "file kept" when it was deleted.

## Runner invocation and patch-mode mechanics

[slang-clarity-review-runner run-clarity.sh takes --mode directly, not a run-clarity subcommand](../learnings/1787167494708-slang-clarity-review-runner-run-clarity-sh-takes-m.md):
the workflow text and SKILL.md `argument-hint` suggest `run-clarity --mode ...`, but the script
parses `--mode`/`--pr`/`--repo` directly, so a leading `run-clarity` fails instantly with exit 1 —
which, on a background reviewer, reads identically to "no findings." Correct form:
`bash .../run-clarity.sh --mode pr --pr <N> --repo <owner/repo> --max-budget-usd 30`. Always verify
`clarity-review.md` has real content (and drift-free `tool-uses.jsonl`) rather than trusting the exit
code — a ~15-25min pipeline that "finishes" in <1s failed. The sibling `compose-and-run.sh` DOES take
a `compose-and-run` first token, so the two skills differ — don't assume symmetry.

Patch mode has two independent bugs.
[slang-clarity-review-runner patch mode fails on new-file-only patches](../learnings/1787299417204-slang-clarity-review-runner-patch-mode-fails-on-ne.md):
`git commit -q -am` stages only modified/deleted TRACKED files, so a patch that only ADDS files
(e.g. adds `.github/workflows/README.md` and nothing else) makes an empty commit → non-zero exit →
`set -e` aborts the whole run with no `clarity-review.md`. Fix (until upstreamed): `git add -A &&
git commit -q -m ...`, applied in an out-of-place script copy inside the same skill dir so `SKILL_DIR`
still resolves; the same latent bug bites Reviewer A's patch mode.
[slang PR-review runners: patch mode hard-applies onto origin/master, ignores --base](../learnings/1787579499769-slang-pr-review-runners-patch-mode-hard-applies-on.md):
both `compose-and-run.sh` and `run-clarity.sh` implement `--mode patch` as `git checkout -b tmp
origin/master && git apply`, parsing but not USING `--base` — so when the code a patch modifies
exists only on an open PR branch (not yet on master), `git apply` fails ("patch does not apply") with
no flag to redirect the base. Workaround: bypass the wrappers — `git worktree add --detach <base-sha>`,
pre-stage the isolated fix diff into the worktree's gitignored `tmp/`, and drive the inner
`claude --print` CLI directly with `REPO_ROOT=<worktree>`, copying the exact prompt/allowlist/mcp-config
from `repro.sh`/`run-clarity.sh` so it stays faithful. Never mutate the shared `/workspace/agent/slang`
tree (it may carry another session's WIP); clean up only your own `--3way` damage.

## External-repo facts need coordinator-side verification

[CI-infra patches referencing external repos need coordinator-side verification (A/C can't reach them)](../learnings/1787133301381-ci-infra-patches-referencing-external-repos-need-c.md):
when a `.github/workflows/*` patch's correctness rests on facts about an EXTERNAL repo (a pinned
commit SHA, a dependency-manifest value, "commit X moved dependency Y"), Reviewers A and C cannot
verify them — both run only against the slang checkout. The coordinator must verify independently:
reproduce the CI's exact `git fetch --depth 1 origin <full-SHA>` (public GitHub enables
fetch-by-object-id via `uploadpack.allowReachableSHA1InWant`; abbreviated SHAs fail — use the full
40-char), and settle commit-parent claims with `git log -1 --format='%P' <child>` +
`git diff <pin> <child> -- <manifest>` (the diff shows the actual change, not the author's paraphrase
— this caught a package-identity vs remote-list precision nit). GOTCHA: a stale `GH_TOKEN`/onecli
gateway can 401 even a fully public repo, but plain `git` over HTTPS is unaffected — fetch with git
rather than trusting a suppressed `gh`/`cat-file`. Also: CI-workflow patches are delivered as
patch/handoff, not a bot PR (nv-slang-bot lacks the App `workflows` permission), and patch mode
correctly skips Reviewer B (Devin needs a PR URL).

## The path-filtered-grep false zero on file statuses

Two atoms — near-duplicate corrections of the same underlying error on slangpy#1121 — pin one durable
rule.
[Correction: read gh pr diff file-statuses with --name-status, not a path-filtered grep](../learnings/1787229678443-correction-read-gh-pr-diff-file-statuses-with-name.md)
and
[Correction: use gh pr diff --name-status for file statuses](../learnings/1787229827637-correction-use-gh-pr-diff-name-status-for-file-sta.md)
both record concluding a PR "modified but did not delete the crashpad overlay" when it actually
DELETES all 13 overlay files — because a `gh pr diff | grep ... | grep -iE 'overlay|crashpad'`
pipeline path-filtered on the second grep, and git's `deleted file mode 100644` (and `new file
mode`/`rename from/to`) status lines contain NO path, so every deletion was silently dropped →
deletions under-count to zero → "file kept." A path filter and a file-status filter are incompatible
in one pipeline. Use `gh pr diff <N> --name-status` (one line per file as `A/M/D/R<tab>path`) or
`gh pr view <N> --json files`; only fall back to grepping raw diff headers for the mode bits, and then
don't also path-filter. The second atom adds a meta-lesson worth carrying: the *observation* (PR
deletes the overlay) was measured, but the *cause* of the peer's error was reasoned, and it was
published with the confidence of a measured fact across 3 artifacts and had to be corrected back — a
cause the fix doesn't need should be withheld or clearly labelled a hypothesis, and a retracted claim
has siblings to sweep. (The two atoms disagree only on the initially-guessed cause — a
deleted-branch-404 — which both retract in favor of the path-filtered-grep cause; the 404 trap is real
but independent, not what happened here.)

**Source learnings (6):**

- [CI-infra patches referencing external repos need coordinator-side verification](../learnings/1787133301381-ci-infra-patches-referencing-external-repos-need-c.md) — Reviewers A/C only see the slang checkout; reproduce the CI's fetch-by-full-SHA and diff commit-parent claims; plain git over HTTPS bypasses a stale-token 401 on public repos.
- [slang-clarity-review-runner run-clarity.sh takes --mode directly, not a run-clarity subcommand](../learnings/1787167494708-slang-clarity-review-runner-run-clarity-sh-takes-m.md) — a leading run-clarity arg exits 1 instantly, reading as "no findings"; verify clarity-review.md has real content; the sibling compose-and-run.sh does take a subcommand — no symmetry.
- [Correction: read gh pr diff file-statuses with --name-status, not a path-filtered grep](../learnings/1787229678443-correction-read-gh-pr-diff-file-statuses-with-name.md) — a path filter drops git's pathless `deleted file mode` lines → deletions under-count to zero; use `gh pr diff --name-status`.
- [Correction: use gh pr diff --name-status for file statuses (my deleted-branch-404 cause was wrong)](../learnings/1787229827637-correction-use-gh-pr-diff-name-status-for-file-sta.md) — the corroborating twin; the peer's error was the path-filtered grep, not a 404; a reasoned cause published as measured fact must be swept from every artifact.
- [slang-clarity-review-runner patch mode fails on new-file-only patches](../learnings/1787299417204-slang-clarity-review-runner-patch-mode-fails-on-ne.md) — `git commit -am` doesn't stage untracked files, so a pure-addition patch makes an empty commit and set -e aborts; fix to `add -A && commit -m` in an out-of-place copy; bites Reviewer A too.
- [slang PR-review runners: patch mode hard-applies onto origin/master, ignores --base](../learnings/1787579499769-slang-pr-review-runners-patch-mode-hard-applies-on.md) — --base is parsed but only branch mode uses it; patch a PR whose target code exists only on its branch via a detached worktree + pre-staged diff driving the inner claude CLI; never mutate the shared tree.
