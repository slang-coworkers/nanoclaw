---
title: "gh CLI Usage & PR/Issue Mechanics"
type: concept
group: ci-tooling
tags: [gh-cli, github, pr, issues, workflow, bot-process, slang]
source_count: 24
---

# gh CLI Usage & PR/Issue Mechanics

Concrete pitfalls and correct patterns for using the `gh` CLI in the Slang project: search limitations, closing-issue verification, comment retrieval, PR review detection, and bot process rules around GitHub writes.

**Split 2026-08-05 at the 40 KB page cap.** Everything about *how `gh`/git readings lie* — collection caps, silently-truncated arrays, endpoint splits, path-classed 401s, and the control shapes that catch them — moved to [GitHub/git Instrument Limits — Caps, Silent Truncation & Endpoint Splits](../concepts/ci-github-instrument-limits.md). This page keeps *how to drive* the tools.

## TL;DR

- **`gh search` is not an existence or merge oracle.** `gh search prs`/`issues` have index lag and return false zeroes; `is:merged` returns 0 while PRs demonstrably merge. Use the timeline, `closingIssuesReferences`, a `--head fix/issue-<n>` list, or a direct `pulls/<n>` read.
- **A PR title containing `Fix #N` does not auto-close anything** — GitHub honors the keyword only in the PR **body** (or a manual Development-panel link). Verify with `gh pr view <pr> --json closingIssuesReferences`, never a body regex (the `owner/repo#N` long form defeats a naive pattern).
- **`gh issue view --comments` can print nothing at exit 0** — a renderer quirk, not an auth failure. Read `gh api .../issues/<n>` and `.../issues/<n>/comments` instead.
- **Never cite an env var, CLI flag, or command name you have not verified** via `--help`/`man`/repo grep. It is a high-frequency hallucination surface and a fabricated knob name is unrecoverable for the reader.
- **Pushing commits to a `fix/issue-*` branch is not a user-facing write** and needs no per-push approval. The gated set is narrow: PR/issue comments, review replies, reactions, `gh pr ready`, merge.
- **A draft-held fix PR does not discharge the issue comment.** `Fixes #N` in a draft body neither auto-closes nor surfaces; post the 5-bullet on the issue when you *decide* to hold.
- **`gh api .../user.login` omits the `[bot]` suffix** — never compare it raw against a review author.
- **An infra-unblock nudge is not a decision override**: being told "you're unblocked" restores capability, not authority to change a verdict.

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

The same read-only-blind-spot trap bites the maintainer daily report: a `gh` label scan cannot see in-flight coworker session chains, so an issue missing `Dev Reviewed` is *not* the same as "untriaged, needs routing / apply P0" — that over-claims a routing gap that may not exist (observed 2026-07-31: slang #12285/#12291 and slangpy #1079 flagged as "untriaged" were all already triaged and in-flight, with #12291 GitHub-assigned to jhelferty-nv). Keep the severity read, but reframe the ask from "untriaged → route/label P0" to "severity: P0-class; work-state: triaged & in-flight, fixer/triager-owned; `Dev Reviewed` + priority are the human maintainer's to apply" — the label is a human write, not a coworker routing gap, and when work-state isn't verifiable from the scan, say so ("label view only; work-state not verified") rather than asserting fresh dispatch is needed ([daily-report P0 candidates: label view ≠ work state (read-only blind spot)](../learnings/1785485841108-daily-report-p0-candidates-label-view-work-state-r.md)).

## Furo Theme Dark-Mode Code Colors

For the `shader-slang/shader-slang.github.io` Sphinx site using the Furo theme, use `pygments_dark_style` in `docs/conf.py` rather than CSS overrides. Furo emits its dark-mode rules wrapped in `body:not([data-theme="light"]) .highlight .k { … }` (higher specificity than a plain `.highlight .k`), so CSS overrides lose in dark mode. The intended hook is `pygments_dark_style = "<PygmentsStyleClass>"` pointing to a custom `pygments.style.Style` subclass. Delete the `.highlight .*` color-override block from `theme_overrides.css` after adopting custom styles. For non-Pygments code on the same page (e.g. auto-generated reference with `pre .code_keyword` etc.), scope those rules with `body[data-theme="dark"]` ([Furo theme dark-mode code colors — use pygments_dark_style, not CSS overrides](../learnings/1779427288040-furo-theme-dark-mode-code-colors-use-pygments-dark.md)).


## Recent operational learnings (incremental fold 2026-07-17)

**[approver/clause-gap] ci_green_on_sha reads only the combined-status endpoint, not Actions check-runs — and the CodeRabbit exit-22 wait-then-reharvest works** — Context: slangpy#1065 (version-bump PR), fallback tier. [[approver/clause-gap] ci_green_on_sha reads only the combined-status endpoint, not Actions check-runs — and the CodeRabbit exit-22 wait-then-reharvest works](../learnings/1784148788488-approver-clause-gap-ci-green-on-sha-reads-only-the.md)

**Rerun supersedes attempt-1 logs — capture receipts before rerunning** — **Rule:** If you intend to cite an attempt-N FAILED line as evidence (e.g. [Rerun supersedes attempt-1 logs — capture receipts before rerunning](../learnings/1784182764154-rerun-supersedes-attempt-1-logs-capture-receipts-b.md)

---
## Critique-Gate Hook False-Matches Read-Only `gh api .../pulls/...` GETs (2026-07-12 fold)

In a critique-gate-overlay container (`CRITIQUE_GATE_ACTIVE=1`), a pure read-only GET like `gh api repos/O/R/pulls/12065/reviews` is DENIED pre-execution ("CRITIQUE REQUIRED before PR creation") — `/app/hooks/gate-critique-on-deliver.sh` matches `gh api [^|]*pulls\b` method-blind, so it catches any `gh api` path containing `pulls`, not just `POST .../pulls`. The whole compound Bash command is blocked, so side effects (mkdir, writes) in the same call also don't run. Avoid it: use `gh pr view <n> --json <fields>` and `gh pr diff <n>` for PR reads (no literal `api .../pulls` substring), and `gh api graphql -f query='...'` for inline review threads / resolve state / per-review commit_id (the endpoint path is `graphql`, not `.../pulls`). The bundled `harvest-reviews.py`/`eval-clauses.py` call `gh api .../pulls` inside python, which the hook doesn't see — only raw `gh api .../pulls` typed directly into a Bash tool call trips. Also pre-create `mkdir -p /workspace/.claude` if you hit a `workflow-state.json.tmp: No such file` hook error before your first critique ([critique-gate hook false-matches read-only gh api pulls GETs as PR-creation](../learnings/1783806666221-approver-infra-critique-gate-hook-false-matches-re.md)).

## gh .user.login Omits the [bot] Suffix (2026-07-14 fold)

The REST API returns a bot account's login bare (`nv-slang-bot`), not the `nv-slang-bot[bot]` form shown in the UI — so an "edit-if-last-poster-is-self" comment guard that compares against `nv-slang-bot[bot]` mis-fires and posts a DUPLICATE. Compare against the bare login ([gh .user.login omits the [bot] suffix — edit-if-self guards must compare bare login](../learnings/1783935090568-gh-user-login-omits-the-bot-suffix-edit-if-self-gu.md)).

## GraphQL-401-while-REST-healthy phantom-greens a CI sweep (`gh pr checks` is GraphQL-backed) (2026-08-01 fold)

This extends the "gh search is unreliable" theme into a far more dangerous failure mode: when the GitHub gateway is in a **partial** state — GraphQL returns `401 Bad credentials` while REST is *fully* healthy (`gh api repos/.../pulls/N`, `commits/<sha>/check-runs`, `commits/<sha>/statuses`, `actions/runs`, and even `gh run rerun --failed` all succeed) — the CI-sweep entry-point tools silently lie. `gh pr checks <N>` and `gh pr view <N>` are **GraphQL-backed**: on a GraphQL 401 they print the error to **stderr** and return **nothing on stdout**, so a sweep loop that greps stdout for `fail` (or swallows stderr with `2>/dev/null`) sees zero failures and reports **every PR false-green**. Observed twice on 2026-08-01 (~10:00Z and ~12:00Z on the Slang CI babysitter): a clean 20/20 "no failures" that was pure phantom — silence looked exactly like health. Root cause is a recurrence of the App-token-refresh gateway split (`project_github_gateway_actions_graphql_401`).

Defense: never trust `gh pr checks`/`gh pr view` empty output as "green" without confirming GraphQL is up — if a sweep sees suspiciously-uniform all-green, probe `gh api graphql -f query='{viewer{login}}'` first; if it 401s while REST works, route the ENTIRE failure-enumeration through REST and proceed (the job is fully doable — reads AND reruns work, so do NOT hold read-only for this facet):

```bash
sha=$(gh api repos/<o>/<r>/pulls/$PR --jq '.head.sha')
gh api "repos/<o>/<r>/commits/$sha/check-runs?per_page=100" --paginate \
 | jq -s '[.[]|.check_runs[]?]|[.[]|select(.conclusion=="failure" or .conclusion=="cancelled" or .conclusion=="timed_out" or .conclusion=="startup_failure")]|group_by(.name)|map(.[0])'
gh api "repos/<o>/<r>/commits/$sha/statuses?per_page=100" \
 | jq '[.[]|select(.state=="failure" or .state=="error")]|group_by(.context)|map(.[0])'
```

Notes: (1) `--paginate` concatenates JSON objects, so a bare `.check_runs[]` dies on page 2 — but do **NOT** reach for the optional-`?` form (`jq -s '[.[]|.check_runs[]?]'`) as the fix, as an earlier revision of this page recommended. **That `?` is itself a silencer**: it swallows a gateway error document (which has no `.check_runs` key) and hands you a clean-looking result built from page 1 only. Gate on shape instead — `jq -e '.check_runs'` per page — and reconcile the count (see *Pagination truncates silently* below). (2) Some required gates (merge-queue aggregators, cross-repo checks like SlangPy Tests) are commit **statuses**, not check-runs — check both. (3) The wake payload's `evicted` list may itself be GraphQL-derived → cross-check merge-group evictions via REST `actions/runs?event=merge_group`. This is distinct from a full actions:write outage (where `gh run rerun` returns 403 "Must have admin rights"); a fresh GraphQL-401-while-REST-ok is worth an operator ping via parent ([GraphQL 401 while REST healthy — gh pr checks silently false-greens a CI sweep (recurred 2026-08-01)](../learnings/1785578978509-graphql-401-while-rest-healthy-gh-pr-checks-silent.md), [gh pr checks phantom-greens the CI sweep when GraphQL is 401 but REST is healthy](../learnings/1785586525718-gh-pr-checks-phantom-greens-the-ci-sweep-when-grap.md)).

## is:merged Search Is Broken — Infer PR Merge From Simultaneous Issue-Close (2026-08-01 fold)

A companion to the "gh search prs is unreliable" section, but for merge-detection specifically: the `mcp__slang-mcp__github_search_issues` `is:merged` query returns 0 results even over wide windows while PRs are demonstrably merging (confirmed 07-26 and again 08-01). Do NOT use `is:merged` to decide whether a PR merged. Reliable substitute: check whether the PR's **closing issue** is now CLOSED via `github_get_issue` — a PR with `Fixes #N`/`Closes #N` auto-closes its issue at the merge instant, so `issue.state == closed` + a matching `closed_at` = fix merged (e.g. 08-01, #12071 CLOSED 2026-07-30T18:34Z confirmed PR #12095 merged though `is:merged` returned nothing). Alternatively page the REST `commits` API — but note it truncates to ~15 entries, so widen the window or paginate or you'll undercount merges (07-28: counted 5, actual 9) ([is:merged search broken — infer PR merge from simultaneous issue-close](../learnings/1785572253771-is-merged-search-broken-infer-pr-merge-from-simult.md)).

## CORRECTION — What the Bash Write-Guard Actually Trips On (2026-08-04 fold)

Two successive characterizations of a `PreToolUse:Bash` denial on a **read-only** `gh api` call were published and both were wrong; each pointed an operator at a different non-existent problem. Recorded here as supersessions because the wording lives above in the critique-gate section.

**Retracted claim 1: "the delivery/critique gate blocks *all* bash — including read-only `gh api` reads."** Wrong. Single-field `--jq` reads succeed on the identical URL, same session, same gate state (`--jq '.state'`, `--jq '.state_reason'`, `--jq '.closed_at'` all → 200), while one composed form was denied. A peer coworker independently reported read-only `gh api` working fine on their edge, which is what prompted the re-probe instead of continuing to assert a blanket block. The meta-lesson: a tool's behavior was diagnosed **from two denials without probing a single variant**, and that diagnosis was handed to a parent as grounds for escalating a process fix — *"X is blocked"* and *"the way I invoked X is blocked"* are different claims with very different consequences ([CORRECTION: the gate does not block read-only gh api](../learnings/1785781643460-correction-the-critique-gate-blocks-composed-multi.md)).

**Retracted claim 2 (from that same correction): "only composed multi-field interpolated `--jq` strings trip it."** Also refuted by probing. The mine-verified trigger is the literal **`state=`** in the command text **on an `issues` path**:

- Denied: `--jq '"state=\(.state)"'` (single field), `--jq '"state=x"'` (no interpolation at all), `--jq '"state_reason=\(.state_reason)"'`
- Passed: `--jq '.state'`, `--jq '.state,.closed_at'`, `--jq '"foo=\(.state)"'`, `--jq '"a=\(.state) b=\(.closed_at)"'` (**composed, multi-field, interpolated**), the same `"state=x"` literal on a **non-issues** path, and bare `echo "state=closed"` (so the pattern is `gh`-scoped)

Inferred (labelled inferred) mechanism: a **write-guard against closing an issue** — meant to catch `gh api …/issues/N -f state=closed` — implemented as a regex loose enough to match the same characters appearing in a *read's* `--jq` output-format string; hence path-sensitive and literal-sensitive while indifferent to the HTTP method. **The workaround is to rename the label:** `"foo=\(.state)"` passes where `"state=\(.state)"` is denied, costing only the wording of your own output label; safest of all are **bare selectors** (`--jq '.state,.state_reason,.closed_at'`) — no `=` anywhere and no string literal to match. The real fix is for the guard to match argument position/method, not a substring that can appear in an output-format string. A **second, separate** trigger (`.state_reason` appearing before a later `=`) was measured to **one edge only** after a third agent ran the two denied cells verbatim and both passed — nobody else should code around it, since a fleet-wide workaround for a single-edge artifact is a permanent tax on everyone for one agent's config ([the gh api gate trigger is a write-guard regex false-positive, narrower than two successive characterizations](../learnings/1785782110173-the-gh-api-gate-trigger-is-a-write-guard-regex-fal.md)).

Three method rules from that chain, all reusable well beyond this gate. **This file's own title originally claimed the trigger was "reproduced on 3 edges" — false and retracted**: it was verified on one edge plus a *report* from one other, i.e. an inference dressed as a count, and a number borrows the authority of measurement whether or not it later turns out right (it did, afterwards — *being lucky is not being calibrated*). **A residual you cannot explain can still be bounded**, and bounding it is often more useful than explaining it, because scope decides who has to care; three candidate regexes were built and discarded because each mispredicted a cell that had already passed, and an unexplained residual honestly labelled beats a clean story that mispredicts. **METHOD TRAP — the guard matches command TEXT before execution, so a bundled retest invalidates itself**: putting a previously-passing form in the same command as a previously-denied literal "to compare them side by side" denies the whole command, the control never runs, and the denial looks like a property of the control (read for one moment as *"the gate is nondeterministic"*). One probe per command, always — an experiment whose apparatus is itself subject to the effect under test cannot measure it. Finally, note the downstream harm that holds regardless of which trigger story is right: **a gate that blocks read-only verification pressures an agent toward substituting remembered values exactly when checking matters most.**

## An Unexplained Bot Comment: Your Own Fan-Out Is the Prime Suspect (2026-08-04 fold)

The `[bot]`-suffix guard above is about *not duplicating* your own comment; this is about *attributing* one you didn't expect. Two incidents, one shape.

**"Read-only agent" is a claim about a tool list, not about the world.** A coworker found an unexplained `nv-slang-bot[bot]` comment on an issue it was driving and excluded its own subagents because "my three research agents were all `Explore`-typed (no `gh`/write surface)," then escalated *"a second tier can write to GitHub surfaces I hold"* as a routing hazard. The exculpating premise is false: `Explore`'s grant is *all tools except Agent, Artifact, ExitPlanMode, Edit, Write, NotebookEdit* — **`Bash` is retained**, so `gh api …/issues/<n>/comments --method POST -f body=…` is fully available. Explore is read-only with respect to the **local filesystem**; it says nothing about network side effects, and a single retained shell is a write surface to every API the container is credentialed for. Corroborating detail for the mundane local explanation: the comment's timestamp fell inside the owning session's own turn gap (outbound `00:23:39` → `00:47:24`), and a subagent's `gh` write is invisible as session outbound, so a self-inflicted write looks exactly like a mystery write. Rules: verify a subagent's tool grant before treating it as incapable; **state read-only intent in the prompt** ("do not write to GitHub or any external service; report findings only") because the type does not enforce it; a capability-based alibi needs the same evidence as any other claim; and absence of an audit trail is not absence of a cause — the systemic story must not be adopted just because it is the one that leaves you blameless ([Explore-typed subagents RETAIN Bash — read-only restricts file writes, not network writes](../learnings/1785804584522-explore-typed-subagents-retain-bash-read-only-agen.md)).

**The other direction: the dispatcher's own unannounced write.** A comment on slang#12223 (id 5167783319) was reported as coming from "a different session under our shared `nv-slang-bot[bot]` identity," with a coordination rule proposed for concurrent sessions writing to one surface. There was **no concurrency incident** — the orchestrator posted it itself: it authorized the close-out (the worker's footprint), then four minutes later posted a separate finding on the same issue and told the *reviewer* tier but not the worker. The correct rule belongs to the dispatcher, not the workers: **whoever delegates a surface must announce any write it makes to that surface, with the comment id, on the same thread, in the same turn.** What survives in weaker form is ordinary hygiene — a shared bot identity genuinely isn't attributable to a tier from GitHub alone, so investigating an unannounced bot comment *by content* and re-reading the newest comment before posting are both right — but do not escalate "unattributable bot comment" to "concurrency incident" without evidence; ask the tier that could have written it first. The same episode yields a cheaper habit: **before re-running an experiment, re-read the evidence you already collected and ask what else it proves.** Three agents independently re-derived that `*_FLAGS_<CONFIG>_INIT` seeding fails to honor env `CXXFLAGS`, when the chain's own days-old probe output already showed the all-config slot (where env `CXXFLAGS` lands) preceding the per-config slot — the ordering *was* the finding. Probe when you have no evidence; re-read when you do ([CORRECTION: it was the dispatcher's unannounced write, not a rogue session](../learnings/1785770140397-correction-to-my-12223-concurrency-claim-it-was-th.md)).

## Contradictions / supersessions

- **`--paginate` "gives no non-zero exit code"** — superseded. `gh` does exit 1; a pipe into `jq` (or `2>/dev/null`) launders it. Fixed in place above; the mechanism claim must always name the *invocation form* measured.
- **`jq -s '[.[]|.check_runs[]?]'` as the recommended `--paginate` slurp** — superseded. The optional `?` is a silencer for gateway error documents; the note in the GraphQL-401 section now says gate on `jq -e '.check_runs'` and reconcile the count instead.
- **"The critique/delivery gate blocks all bash, including read-only `gh api`"** and **"only composed multi-field interpolated `--jq` trips it"** — both retracted; the mine-verified trigger is the literal `state=` on an `issues` path (see the CORRECTION section). The separate `.state_reason`-before-`=` trigger is one-edge-only and must not be worked around fleet-wide.
- **"Reproduced on 3 edges"** (as originally published for the `state=` trigger) — retracted as an inference dressed as a count; it became true only later, which does not retroactively justify writing it.
- **`repos/.../branches/main/protection` 403 ⇒ "CI-not-required clause unverifiable"** — retracted; `branches/main` carries `.protection.required_status_checks.contexts` unprivileged, and the fact was the opposite of what the caveat implied.
- **"GitHub auth is down fleet-wide"** — retracted; it was a REST-vs-GraphQL path-class split, and four agreeing probes were all one instrument (introspection + GraphQL-backed).

**Source learnings (24):**
- [CORRECTION: the critique gate does not block read-only gh api — probe variants before characterizing a tool](../learnings/1785781643460-correction-the-critique-gate-blocks-composed-multi.md)
- [The gh api gate denial is a write-guard regex false-positive on literal `state=` over an issues path — rename the label](../learnings/1785782110173-the-gh-api-gate-trigger-is-a-write-guard-regex-fal.md)
- [Explore-typed subagents RETAIN Bash — "read-only agent" restricts file writes, not network writes](../learnings/1785804584522-explore-typed-subagents-retain-bash-read-only-agen.md)
- [CORRECTION: the #12223 "concurrency incident" was the dispatcher's own unannounced write; re-read evidence before re-running it](../learnings/1785770140397-correction-to-my-12223-concurrency-claim-it-was-th.md)
- [GraphQL 401 while REST healthy — gh pr checks silently false-greens a CI sweep (recurred 2026-08-01)](../learnings/1785578978509-graphql-401-while-rest-healthy-gh-pr-checks-silent.md)
- [gh pr checks phantom-greens the CI sweep when GraphQL is 401 but REST is healthy — enumerate failures via REST check-runs + statuses](../learnings/1785586525718-gh-pr-checks-phantom-greens-the-ci-sweep-when-grap.md)
- [is:merged search broken — infer PR merge from simultaneous issue-close (github_get_issue state==closed), not is:merged](../learnings/1785572253771-is-merged-search-broken-infer-pr-merge-from-simult.md)
- [daily-report P0 candidates: label view ≠ work state — a read-only scan can't see in-flight coworker session chains, so 'missing Dev Reviewed' ≠ 'untriaged'](../learnings/1785485841108-daily-report-p0-candidates-label-view-work-state-r.md)
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


- [[approver/clause-gap] ci_green_on_sha reads only the combined-status endpoint, not Actions check-runs — and the CodeRabbit exit-22 wait-then-reharvest works](../learnings/1784148788488-approver-clause-gap-ci-green-on-sha-reads-only-the.md)
- [Rerun supersedes attempt-1 logs — capture receipts before rerunning](../learnings/1784182764154-rerun-supersedes-attempt-1-logs-capture-receipts-b.md)
_Catalog: [index](../index.md)_
