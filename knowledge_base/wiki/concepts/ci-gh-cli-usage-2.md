---
title: "gh CLI Usage & PR/Issue Mechanics (part 2)"
type: concept
group: ci-tooling
tags: [gh-cli, github, pr, issues, workflow, bot-process, slang]
source_count: 4
---

# gh CLI Usage & PR/Issue Mechanics (part 2)

> **This page is part 2 of 2** of the gh CLI Usage & PR/Issue Mechanics synthesis (split 2026-08-07 to stay under the 40 KB read cap). Siblings: [part 1](ci-gh-cli-usage.md). The TL;DR below is shared across all parts.

## TL;DR
- **`gh search` is not an existence or merge oracle.** `gh search prs`/`issues` have index lag and return false zeroes; `is:merged` returns 0 while PRs demonstrably merge. Use the timeline, `closingIssuesReferences`, a `--head fix/issue-<n>` list, or a direct `pulls/<n>` read.
- **A PR title containing `Fix #N` does not auto-close anything** — GitHub honors the keyword only in the PR **body** (or a manual Development-panel link). Verify with `gh pr view <pr> --json closingIssuesReferences`, never a body regex (the `owner/repo#N` long form defeats a naive pattern).
- **`gh issue view --comments` can print nothing at exit 0** — a renderer quirk, not an auth failure. Read `gh api .../issues/<n>` and `.../issues/<n>/comments` instead.
- **Never cite an env var, CLI flag, or command name you have not verified** via `--help`/`man`/repo grep. It is a high-frequency hallucination surface and a fabricated knob name is unrecoverable for the reader.
- **Pushing commits to a `fix/issue-*` branch is not a user-facing write** and needs no per-push approval. The gated set is narrow: PR/issue comments, review replies, reactions, `gh pr ready`, merge.
- **A draft-held fix PR does not discharge the issue comment.** `Fixes #N` in a draft body neither auto-closes nor surfaces; post the 5-bullet on the issue when you *decide* to hold.
- **`gh api .../user.login` omits the `[bot]` suffix** — never compare it raw against a review author.
- **An infra-unblock nudge is not a decision override**: being told "you're unblocked" restores capability, not authority to change a verdict.
- **A `gh` name that resolves is not the name you meant.** `--workflow <typo>.yml` binds silently to a retired workflow with the same words reordered and serves its old runs. Enumerate workflow paths; never type one from memory. Weeks-old rows in a query about *recent* automation are an instrument alarm, not a finding.
- **`gh run rerun` rc=0 is not proof it fired; an unchanged `run_attempt` is not proof it didn't.** Positive proof is a second rerun returning 403 "already running". Key reruns on `(workflow_id, event, name)`, never name alone.
- **A run concluding `success` may have declined to act.** Read the script's decision line in the log, not the conclusion. Slang priority-yield aging is contention-gated (12h yield-out / 16h lookback), so a yielded run can expire unrerun.
- **Bucket a CI red by its terminal outcome, never by a signature string's presence.** When a challenged total reproduces unchanged, verify its members — offsetting errors pass every sum check.

## gh CLI output channels and filter encodings (2026-08-08 fold)

`gh api` is not a clean instrument: on a 4xx it writes the **error body to stdout**, so a script that
tests only for emptiness can never detect the failure ([Discriminator for the gh-404-stdout bug: `V=$(cmd || echo x)` is broken, `V=$(cmd) || V=x` is safe — plus where shape-validation is still required](../learnings/1786154661882-discriminator-for-the-gh-404-stdout-bug-v-cmd-echo.md)), and `--jq .conclusion`
prints a JSON `null` as an **empty line**, which reads as "no value" rather than "not finished"
([`$(cmd || echo default)` does NOT substitute when cmd still prints — gh api writes 404 bodies to stdout, silently killing your error-handling branch](../learnings/1786154083155-cmd-echo-default-does-not-substitute-when-cmd-stil.md)). A `cmd || echo default` guard does not substitute when the command still
exits 0 while printing an error ([Correction: `gh api` writes 404 error bodies to STDOUT — "|| echo ''" does NOT yield an empty string, so -z guards sail past](../learnings/1786153961374-correction-gh-api-writes-404-error-bodies-to-stdou.md)). Date filters in `gh search` fail in three
distinct ways depending on encoding, and the `>=`/`<=` forms need care — two corrections were needed
before the working form was pinned ([Split "this is yours to fix" from "here is the mechanism" — the second is usually unmeasured, and its falsity can sink the correct first claim](../learnings/1786150840441-split-this-is-yours-to-fix-from-here-is-the-mechan.md), [CORRECTION to my %3E%3D advice: gh date-filter encoding depends on the INVOCATION FORM, and on actions/runs the wrong form returns a SILENT total_count=0](../learnings/1786138106697-correction-to-my-3e-3d-advice-gh-date-filter-encod.md)).
**Rule: require a positively-shaped result (a bare integer, a known enum) rather than testing for
absence, and never let a command's failure exit share a branch with its negative answer.**

**Source learnings (7):**
- [Discriminator for the gh-404-stdout bug: `V=$(cmd || echo x)` is broken, `V=$(cmd) || V=x` is safe — plus where shape-validation is still required](../learnings/1786154661882-discriminator-for-the-gh-404-stdout-bug-v-cmd-echo.md)
- [`$(cmd || echo default)` does NOT substitute when cmd still prints — gh api writes 404 bodies to stdout, silently killing your error-handling branch](../learnings/1786154083155-cmd-echo-default-does-not-substitute-when-cmd-stil.md)
- [Correction: `gh api` writes 404 error bodies to STDOUT — "|| echo ''" does NOT yield an empty string, so -z guards sail past](../learnings/1786153961374-correction-gh-api-writes-404-error-bodies-to-stdou.md)
- [Split "this is yours to fix" from "here is the mechanism" — the second is usually unmeasured, and its falsity can sink the correct first claim](../learnings/1786150840441-split-this-is-yours-to-fix-from-here-is-the-mechan.md)
- [CORRECTION to my %3E%3D advice: gh date-filter encoding depends on the INVOCATION FORM, and on actions/runs the wrong form returns a SILENT total_coun](../learnings/1786138106697-correction-to-my-3e-3d-advice-gh-date-filter-encod.md)
- [CORRECTION: gh search date filters fail three different ways — pre-encoding %3E%3D is the WRONG fix for -f, and a missing colon silently returns a pla](../learnings/1786137952135-correction-gh-search-date-filters-fail-three-diffe.md)
- [gh --jq '.conclusion' prints JSON null as an EMPTY LINE — a poll loop testing != "null" exits instantly on a running job](../learnings/1786136595995-gh-jq-conclusion-prints-json-null-as-an-empty-line.md)
