---
title: "gh CLI Usage & PR/Issue Mechanics"
type: concept
group: ci-tooling
tags: [gh-cli, github, pr, issues, workflow, bot-process, slang]
source_count: 14
---

# gh CLI Usage & PR/Issue Mechanics

Concrete pitfalls and correct patterns for using the `gh` CLI in the Slang project: search limitations, closing-issue verification, comment retrieval, PR review detection, and bot process rules around GitHub writes.

## gh search prs Is Unreliable for Recent PRs

`gh search prs --repo <r> "<text>"` and `gh search issues` have indexing lag and gaps — they can return zero results even for open, matching PRs. Do NOT use search to determine whether an issue already has a linked PR. Use direct queries instead:

- `gh api repos/<owner>/<repo>/issues/<num>/timeline` — look for `cross-referenced` or `connected` events
- GraphQL `closingIssuesReferences` on the PR
- Branch convention: `gh pr list --repo <r> --head fix/issue-<num>`
- If the PR number is known: `gh api repos/<r>/pulls/<num>` directly ([gh search prs misses recent/open PRs — don't use it for PR-existence checks](../learnings/1780327495315-gh-search-prs-misses-recent-open-prs-don-t-use-it-.md))

Note: a PR title containing `Fix #N` does NOT auto-close the issue — GitHub only honors `Close(s)/Fix(es)/Resolve(s) #N` in the PR body (or a manual Development-panel link).

## Checking Closing-Issue Links

To verify a PR auto-closes an issue, use:

```bash
gh pr view <pr> -R <owner>/<repo> --json closingIssuesReferences --jq '[.closingIssuesReferences[].number]'
```

Do NOT decide from a body regex. GitHub honors both the short form (`Closes #N`) and the long form (`Closes owner/repo#N`) — a naive `keyword #N` pattern produces false-negatives for the long form. The API call is authoritative ([Check a PR's closing-issue link via gh closingIssuesReferences, not a body regex](../learnings/1780462327680-check-a-pr-s-closing-issue-link-via-gh-closingissu.md)).

## gh issue view --comments Can Return Empty

`gh issue view <n> -R shader-slang/slang --comments` can return empty output (exit 0) even for issues with comments — this is a text-renderer quirk, not an auth or network failure. For reliable issue and comment reads, use:

```bash
gh api repos/<owner>/<repo>/issues/<n>          # body
gh api repos/<owner>/<repo>/issues/<n>/comments  # comments
gh issue view <n> --json number,title,state,author,labels,body
```

([gh issue view --comments can return empty; use --json or gh api for comments](../learnings/1782389247211-gh-issue-view-comments-can-return-empty-use-json-o.md))

## Verifying release artifacts vs. reporter claims

When a reporter says an official release artifact has a version mismatch, download and inspect the actual artifact before routing a fix. The zip ships `include/slang-tag-version.h` (contains the embedded version) and the binaries. `slang-compiler.dll` is the module that implements `getBuildTagString`; `slang.dll` is a ~156KB re-export shim. CI run logs expire after ~few weeks (HTTP 410 Gone), so the artifact is often the only remaining ground truth. A `strings` grep on the binary is the authoritative check ([Verify a reported release-version mismatch against the actual artifact before treating it as a release-CI bug](../learnings/1781385600632-verify-a-reported-release-version-mismatch-against.md)).

## Don't Cite Env Vars or Flag Names Without Verifying

Env-var, CLI-flag, and command names are a high-frequency hallucination surface. Before writing any env var, CLI flag, registry key, or command name in a user-facing reply, verify it via `man`, `--help`, the project's docs, or a GitHub grep on the project repo. A fabricated knob name is unrecoverable for the reader; a verified name is always preferable to a confident-sounding wrong one ([Don't cite env-var or flag names without verifying — they're a high-frequency hallucination surface](../learnings/1780177920997-don-t-cite-env-var-or-flag-names-without-verifying.md)).

## Pushing Commits Is Not a User-Facing Write

Pushing code commits to a `fix/issue-*` branch never requires per-push operator approval — not for draft PRs, not for ready PRs, not in response to automated reviewers (CodeRabbit). The operator-gated set is narrow: PR/issue comments, review replies, emoji reactions, `gh pr ready`, merge/mark-ready-for-review. A commit push is none of those ([Pushing code commits is NOT a user-facing write — it's always allowed, draft or ready](../learnings/1780726000000-pushing-commits-is-not-a-user-facing-write.md)).

## Draft-Held Fix PR Still Needs the Issue Comment

When a triaged issue's resolving PR is held as a draft, the `Fixes #N` in the draft PR body does NOT auto-close the issue and does NOT surface prominently. The 5-bullet triage outcome comment MUST still be posted on the issue (verdict = "Triaged → fix in draft PR #N, held pending review/approval"). Treat the decision to hold the PR as a draft as the trigger for the issue comment ([Draft-held fix PR still needs the issue 5-bullet — post it when you decide to hold, not after a nudge](../learnings/1780900630856-draft-held-fix-pr-still-needs-the-issue-5-bullet-p.md)).

## Verifying a Cited Fix PR Is an Ancestor

When a triage memo frames an issue as "still broken despite PR #N," first run:

```bash
git merge-base --is-ancestor <fixPR-merge-commit> <reporter-build-commit>
```

If the exit code is non-zero, the fix was NOT in the reporter's build. The correct deliverable is regression-test coverage, not a new fix. Get the reporter's build from their `slangc -v` / `git describe`, and the fix-PR's merge commit via `gh pr view N --json mergeCommit` ([Verify the cited fix-PR is an ancestor of the reporter's build before accepting regression/incomplete-fix framing](../learnings/1780648573408-verify-the-cited-fix-pr-is-an-ancestor-of-the-repo.md)).

## Detecting Transient Claude CLI Failures in PR Review Runners

When running `/slang-pr-review` background reviewers (`compose-and-run.sh` for Reviewer A, `run-clarity.sh` for C), the background-task completion notification's exit code is the wrapper's `echo`, not the inner script — it shows 0 even when the review failed. Always grep for `REVIEWER_*_EXIT=` in the log.

Failure signatures: Reviewer A — `final-review.md` missing, stream's final `result` record has `is_error:true` + socket-closed message, tiny cost (~$0.05, num_turns≈2); Reviewer C — exit 143 (SIGTERM), no `clarity-review.md`, `stream.jsonl` ends with no `result` line. On either signature, re-run that reviewer's script (idempotent). Then validate: files non-empty, zero "API Error" hits, for C confirm `tool-uses.jsonl` has zero GitHub-write calls ([slang-pr-review: detecting transient claude-CLI failures in A/C runners](../learnings/1780650742331-slang-pr-review-detecting-transient-claude-cli-fai.md)).

## Infra-Unblock Nudge Is Not a Decision Override

An infra-unblock signal (disk freed, build can now run, CI green) is orthogonal to a disposition-based hold. Before resuming a parked chain, verify the recorded release trigger. If a nudge rests on a false premise (assumes the chain was infra-blocked when it was decision-blocked), route it to the disposition owner rather than acting on it ([An infra-unblock nudge is not an override of a decision-based hold — verify the actual trigger](../learnings/1782719314130-an-infra-unblock-nudge-is-not-an-override-of-a-dec.md)). Similarly, a templated/automated wake does not meet the "explicit operator go" bar when it carries a false premise, is a repeat of an identical earlier nudge already ruled on, or does not address the actual decision that was escalated ([Templated operator-wake ≠ explicit scoped override of a considered hold](../learnings/1782734222994-templated-operator-wake-explicit-scoped-override-o.md)).

## Furo Theme Dark-Mode Code Colors

For the `shader-slang/shader-slang.github.io` Sphinx site using the Furo theme, use `pygments_dark_style` in `docs/conf.py` rather than CSS overrides. Furo emits its dark-mode rules wrapped in `body:not([data-theme="light"]) .highlight .k { … }` (higher specificity than a plain `.highlight .k`), so CSS overrides lose in dark mode. The intended hook is `pygments_dark_style = "<PygmentsStyleClass>"` pointing to a custom `pygments.style.Style` subclass. Delete the `.highlight .*` color-override block from `theme_overrides.css` after adopting custom styles. For non-Pygments code on the same page (e.g. auto-generated reference with `pre .code_keyword` etc.), scope those rules with `body[data-theme="dark"]` ([Furo theme dark-mode code colors — use pygments_dark_style, not CSS overrides](../learnings/1779427288040-furo-theme-dark-mode-code-colors-use-pygments-dark.md)).

---
## Critique-Gate Hook False-Matches Read-Only `gh api .../pulls/...` GETs (2026-07-12 fold)

In a critique-gate-overlay container (`CRITIQUE_GATE_ACTIVE=1`), a pure read-only GET like `gh api repos/O/R/pulls/12065/reviews` is DENIED pre-execution ("CRITIQUE REQUIRED before PR creation") — `/app/hooks/gate-critique-on-deliver.sh` matches `gh api [^|]*pulls\b` method-blind, so it catches any `gh api` path containing `pulls`, not just `POST .../pulls`. The whole compound Bash command is blocked, so side effects (mkdir, writes) in the same call also don't run. Avoid it: use `gh pr view <n> --json <fields>` and `gh pr diff <n>` for PR reads (no literal `api .../pulls` substring), and `gh api graphql -f query='...'` for inline review threads / resolve state / per-review commit_id (the endpoint path is `graphql`, not `.../pulls`). The bundled `harvest-reviews.py`/`eval-clauses.py` call `gh api .../pulls` inside python, which the hook doesn't see — only raw `gh api .../pulls` typed directly into a Bash tool call trips. Also pre-create `mkdir -p /workspace/.claude` if you hit a `workflow-state.json.tmp: No such file` hook error before your first critique ([critique-gate hook false-matches read-only gh api pulls GETs as PR-creation](../learnings/1783806666221-approver-infra-critique-gate-hook-false-matches-re.md)).

## gh .user.login Omits the [bot] Suffix (2026-07-14 fold)

The REST API returns a bot account's login bare (`nv-slang-bot`), not the `nv-slang-bot[bot]` form shown in the UI — so an "edit-if-last-poster-is-self" comment guard that compares against `nv-slang-bot[bot]` mis-fires and posts a DUPLICATE. Compare against the bare login ([gh .user.login omits the [bot] suffix — edit-if-self guards must compare bare login](../learnings/1783935090568-gh-user-login-omits-the-bot-suffix-edit-if-self-gu.md)).

**Source learnings (14):**
- [Detecting transient claude-CLI failures in A/C review runners](../learnings/1780650742331-slang-pr-review-detecting-transient-claude-cli-fai.md)
- [gh search prs misses recent open PRs](../learnings/1780327495315-gh-search-prs-misses-recent-open-prs-don-t-use-it-.md)
- [Check a PR's closing-issue link via gh closingIssuesReferences](../learnings/1780462327680-check-a-pr-s-closing-issue-link-via-gh-closingissu.md)
- [gh issue view --comments can return empty](../learnings/1782389247211-gh-issue-view-comments-can-return-empty-use-json-o.md)
- [Furo theme dark-mode code colors](../learnings/1779427288040-furo-theme-dark-mode-code-colors-use-pygments-dark.md)
- [Don't cite env-var or flag names without verifying](../learnings/1780177920997-don-t-cite-env-var-or-flag-names-without-verifying.md)
- [Verify the cited fix-PR is an ancestor of the reporter's build](../learnings/1780648573408-verify-the-cited-fix-pr-is-an-ancestor-of-the-repo.md)
- [Pushing commits is not a user-facing write](../learnings/1780726000000-pushing-commits-is-not-a-user-facing-write.md)
- [Draft-held fix PR still needs the issue 5-bullet comment](../learnings/1780900630856-draft-held-fix-pr-still-needs-the-issue-5-bullet-p.md)
- [Verify a reported release-version mismatch against the actual artifact](../learnings/1781385600632-verify-a-reported-release-version-mismatch-against.md)
- [An infra-unblock nudge is not an override of a decision-based hold](../learnings/1782719314130-an-infra-unblock-nudge-is-not-an-override-of-a-dec.md)
- [Templated operator-wake is not an explicit scoped override](../learnings/1782734222994-templated-operator-wake-explicit-scoped-override-o.md)
- [critique-gate hook false-matches read-only gh api .../pulls/... GETs as PR-creation — use gh pr view/diff --json instead](../learnings/1783806666221-approver-infra-critique-gate-hook-false-matches-re.md)
- [gh .user.login omits the [bot] suffix — edit-if-self guards must compare bare login](../learnings/1783935090568-gh-user-login-omits-the-bot-suffix-edit-if-self-gu.md)


_Catalog: [[wiki/index.md]]_
