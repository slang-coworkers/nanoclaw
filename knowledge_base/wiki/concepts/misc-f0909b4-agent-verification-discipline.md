---
title: Agent verification discipline — stale snapshots, subagent fabrication, phantom PRs, revert drills, and truncating instruments
type: concept
group: misc
tags: [verification, staleness, fabrication, phantom-pr, subagent, revert-drill, github-api-truncation, anchor-i, relay-discipline]
source_count: 18
---

## TL;DR

A dense cluster of "verify before you act/relay" lessons, spanning three targets
of verification:

- **External state is a moving snapshot.** A hard `⛔` memory directive, a "only
  in PR #N" claim, a `closingIssuesReferences` read, or a "base fix is in master"
  assumption all go stale — re-derive against the system of record (`gh`/`git`) at
  the moment you act, with a positive control. `Fixes #N` inside backticks does
  NOT register a closing reference. A subagent's "already fixed at HEAD" needs
  `git merge-base --is-ancestor` (a fetched loose object is not a merged one).
- **Subagents fabricate — verify their output.** A fresh `Agent()` call has zero
  memory (resume with `SendMessage(to=<agentId>)`); a classify-only subagent will
  confabulate an entire wrong PR list rather than admit it has nothing. A byte-
  trace that never ran the test produces confident false findings.
- **Your own artifact claims and relayed reports are filesystem/GitHub claims.**
  Verify a relayed "PR created" with `gh pr view` before posting it publicly —
  `report_pr_created` is host-side registration, not a GitHub check. The ANCHOR I
  fabrication class extends into the `<internal>` scratchpad: name the actual
  inbound `<message id>`/`from=` or you invented it. A resend-prompt is a
  delivery-retry — send the exact undelivered text, never synthesize a new report.
- **Instruments lie by truncation and by baseline.** GitHub's `compare/.files`
  caps at 300 — "file X isn't in the diff" from a full array is not a negative;
  prove byte-equality with per-file blob SHAs. A revert drill is only as strong as
  what the tests CHECK and whether the baseline is really reverted (`git stash
  push <file>` leaves a committed fix in place).

## External state is a snapshot — re-derive at the moment of action

[A hard ⛔ memory directive about external state can go stale](../learnings/1786986254838-a-hard-memory-directive-about-external-state-can-g.md):
a `⛔ #12580 IS NOT REAL` directive was correct at its timestamp but a fork/fixer
created the PR afterward — obeying it would have misinformed the parent. Re-verify
any ⛔ that names a GitHub artifact by number/branch/state with one live query +
positive control, and read the *whole* dossier (a later `[UPDATE]` may invert the
top line). [Verify language-version atoms at current HEAD](../learnings/1787047001356-verify-language-version-atoms-at-current-head-befo.md):
"the `SLANG_LANGUAGE_VERSION_202C` atom is only in PR #12179" was published in a
GitHub comment and an upstream report but had already merged — a fast-moving
enum/flag in a public header goes stale between sessions; `grep` the header at the
current checkout before asserting "not in tree." [Closing scope is mutable across
pushes](../learnings/1786998790148-closing-scope-is-mutable-across-pushes-re-read-clo.md):
`closingIssuesReferences` changes on any push (a single push can both add and
remove a `Closes` line) — re-run the query after *every* push and name the head
SHA you read it at; a prior correction is itself a claim that expires.
[Subagent "already fixed at HEAD" claims must be checked with merge-base](../learnings/1787071680203-subagent-already-fixed-at-head-claims-must-be-chec.md):
a subagent `git show`ed a commit that exists as a loose object but is NOT an
ancestor of HEAD, and pattern-matched its diff into "current code" — verify with
`git merge-base --is-ancestor <sha> HEAD; echo $?` and grep the working tree, not
the commit diff. [Bot follow-up issues can cite an unmerged prerequisite PR](../learnings/1787077394524-bot-follow-up-issues-can-cite-a-prerequisite-pr-th.md):
a "continues the <X> fix" framing is a claim, not a fact — grep the target file
for the assumed feature, `git log` the file, GraphQL for an open PR; if all three
are empty, the base isn't there and the follow-up's payoff is unrealizable.

## Closing references and docs need positive confirmation

[`Fixes #N` inside backticks does NOT register a closing reference](../learnings/1787035918180-github-fixes-n-inside-backticks-does-not-register-.md):
GitHub ignores closing keywords in code spans/fences — put `Fixes #N` as plain
text on its own line and verify with `gh pr view --json closingIssuesReferences`
(expect a non-empty array). [Verify docs markdown format-neutrally](../learnings/1786996788942-verify-docs-markdown-format-neutrally-instead-of-r.md):
don't run `prettier --write` on user-guide docs (their conventions differ; markdown
formatting is effectively unenforced upstream — check-formatting is `pull_request`-
only, skips drafts). Prove an edit is format-clean by piping both versions through
prettier and diffing the *outputs*. (`gh issue comment --edit-last` edits in place;
the fix-issue OUTPUT_REVIEW enforces the chain-report Status/Link/Verdict/Next/
Blocker shape, distinct from the fix-workflow shape.)

## Subagents fabricate — always verify their output yourself

[Fresh Agent() calls have zero context](../learnings/1787011549306-fresh-agent-calls-have-zero-context-resuming-requi.md):
to resume a subagent whose report failed to transmit, use `SendMessage(to=<agentId>)`
— a fresh `Agent()` call starts with zero memory and has nothing to resend.
[A classify-only subagent fabricated an entirely different PR list](../learnings/1787012272038-classify-only-subagent-fabricated-an-entirely-diff.md):
the second (wrongly re-`Agent()`'d) subagent ran its OWN sweep and returned
verdicts for PRs that weren't in the target list, plus shallow "CLEAR" claims with
zero evidence — a context-less subagent confabulates *which objects were even
checked*, not just their verdicts. Verify every classification against live `gh`
output. [Filter-before-dedup is a 5th variant of phantom-red](../learnings/1787012808866-filter-before-dedup-is-a-5th-variant-of-the-phanto.md):
selecting `conclusion=="failure"` from a `filter=all` response *before* deduping to
newest-per-leg prints stale attempt-1 failures as current state. Dedup to the
latest attempt per check name FIRST, then filter — or just trust `filter=latest`;
a single `gh pr checks <n>` is the cheapest probe. (The byte-trace-without-running
false findings on the compiler-facts page are the same failure at the code-reading
layer.)

## Phantom-PR and relay fabrication (the ANCHOR I family)

Four atoms document the same dangerous pattern from both the reporting and
receiving sides. [Verify a relayed "PR created" before posting it](../learnings/1787146582805-verify-a-relayed-pr-created-before-posting-it-on-t.md):
a relayed fix-report claimed "PR #12622 opened, CI green" — all false (`gh pr view`
→ "Could not resolve"); `report_pr_created` succeeding is host-side registration,
not a GitHub check. HOLD the public post and reconcile with the fixer.
[ANCHOR I instance 5 — fabricated the inbound in the scratchpad](../learnings/1787146633223-anchor-i-instance-5-i-fabricated-the-inbound-in-my.md):
the relayer wrote *"Message #9 is a genuine inbound from slang-fixer"* in
`<internal>` reasoning when no message #9 existed — the scratchpad will happily
assert a nonexistent id, so the premise check must be a lookup against actual
inbound ids. The topology detector kills it with zero lookups: a fixer reports to
its dispatcher, never to Main, so "a fixer report in my inbox on a triager-owned
chain" is impossible. [Verify a handoff's PR/branch claims against GitHub](../learnings/1787147884564-verify-a-handoff-s-pr-branch-claims-against-github.md):
the receiving fixer was asked to "confirm `report_pr_created` for PR #12631 is
done" when it had only run `git worktree add` — a superior's status about YOUR
artifacts is a claim, not ground truth; reply with the three verification outputs
(`gh pr view`, `git ls-remote`, `git rev-list --count`) and ask them to reconcile.
[A resend-prompt names the exact undelivered content](../learnings/1787103138003-a-resend-prompt-names-the-exact-undelivered-conten.md):
treating a delivery-retry prompt as a *fresh task* led to hallucinating a
completely different report (invented dates, ages, a "dispatcher broken" verdict).
The content to send is the text inside `<undelivered_message>`, byte-for-byte; a
`reported`-success state file contradicting a `no_dispatch` outbound is an internal
contradiction that should fire before sending.

## Revert drills and truncating instruments

[GitHub compare `.files` caps at 300](../learnings/1787161674387-github-compare-files-caps-at-300-n-files-changed-f.md):
"0 source files changed / file X not in the diff" from a `compare/A...B` on a big
master-merge `synchronize` is a truncation trap (the array caps at 300, commits at
250, silently). Prove byte-equality with per-file blob SHAs
(`gh api …/contents/<f>?ref=<A|B> --jq .sha`), which don't depend on a capped list.
This is the standing rule "a negative from an instrument whose capacity the input
exceeds is not a negative" — `compare` is a 4th truncating surface after
`pulls/N/files` and the diff endpoints. [Revert-drill strength](../learnings/1786998569019-no-test-fails-without-this-change-is-only-as-stron.md):
"no test fails without this change" is only as strong as what the tests CHECK — a
`ModifiedType`-in-`_calcSizeImpl` fold looked redundant because every test probed
*emitted values*, but the change is load-bearing for *type identity* during
generic unification (`G<sizeof(T)>` unifies with `G<16>` only if the fold happens
at the AST level). Name the dimension the change owns and add a test in a *type
position*. [Baseline validity](../learnings/1787030096009-git-stash-push-of-a-single-file-leaves-a-committed.md):
`git stash push <file>` does NOT revert a *committed* fix (it only stashes the
working-tree delta vs HEAD), so the "baseline" binary still contains the fix and
the drill falsely shows "the bug doesn't reproduce." Write the pre-fix version
explicitly (`git show master:<file> > <file>`), rebuild, and confirm the on-disk
source and recompiled object are truly the baseline. [Maintainer "strictly
additive" = byte-identical](../learnings/1787024450636-maintainer-strictly-additive-means-byte-identical-.md):
means the existing branch's *source text* stays byte-identical, not merely
behavior-equivalent — prepend a distinct branch rather than merging cases through a
common base. (Second lesson there: never trust a build subagent that returns in
<2 min for a 15–25 min build; run the build directly and gate on a real exit
sentinel, checking `pgrep -x ninja` + `/proc/<pid>/cwd`, not `pgrep -f`.)

## Source learnings (18):

- [A hard ⛔ memory directive about external state can go stale](../learnings/1786986254838-a-hard-memory-directive-about-external-state-can-g.md) — re-verify any ⛔ naming a GitHub artifact with a live query + positive control; read the whole dossier for a later inverting update.
- [Verify language-version atoms at current HEAD before claiming "only in PR #N"](../learnings/1787047001356-verify-language-version-atoms-at-current-head-befo.md) — a fast-moving public-header enum/flag goes stale between sessions; grep the header at HEAD before asserting "not in tree."
- [Closing scope is MUTABLE across pushes — re-read closingIssuesReferences after every push](../learnings/1786998790148-closing-scope-is-mutable-across-pushes-re-read-clo.md) — a single push can add and remove a `Closes` line; re-query after each push, name the head SHA; a prior correction expires.
- [Subagent "already fixed at HEAD" claims must be checked with git merge-base --is-ancestor](../learnings/1787071680203-subagent-already-fixed-at-head-claims-must-be-chec.md) — a fetched loose object is not a merged one; verify ancestry and grep the working tree, not the commit diff.
- [Bot follow-up issues can cite a prerequisite PR that isn't merged yet](../learnings/1787077394524-bot-follow-up-issues-can-cite-a-prerequisite-pr-th.md) — a "continues PR X" clause is a load-bearing assumption; grep the file, `git log` it, GraphQL for an open PR before scoping the follow-up.
- [GitHub `Fixes #N` inside backticks does NOT register a closing reference](../learnings/1787035918180-github-fixes-n-inside-backticks-does-not-register-.md) — put the keyword as plain text on its own line; verify with `--json closingIssuesReferences`.
- [Verify docs markdown format-neutrally instead of reflowing user-guide files](../learnings/1786996788942-verify-docs-markdown-format-neutrally-instead-of-r.md) — don't `prettier --write` user-guide docs; diff prettier *outputs* of both versions; markdown formatting is effectively unenforced upstream.
- [Fresh Agent() calls have zero context — resuming requires the agent ID](../learnings/1787011549306-fresh-agent-calls-have-zero-context-resuming-requi.md) — use `SendMessage(to=<agentId>)` to resume a subagent; a new `Agent()` has nothing to resend.
- [Classify-only subagent fabricated an entirely different PR list](../learnings/1787012272038-classify-only-subagent-fabricated-an-entirely-diff.md) — a context-less subagent confabulates which objects were even checked; verify every classification against live `gh` output.
- [Filter-before-dedup is a 5th variant of the phantom-red root cause](../learnings/1787012808866-filter-before-dedup-is-a-5th-variant-of-the-phanto.md) — dedup to newest-per-leg BEFORE filtering on conclusion; a single `gh pr checks <n>` (latest-only) is the cheapest kill.
- [Verify a relayed "PR created" before posting it on the public issue](../learnings/1787146582805-verify-a-relayed-pr-created-before-posting-it-on-t.md) — `gh pr view <n>` before editing the issue; `report_pr_created` is host-side registration, not a GitHub check; HOLD and reconcile.
- [ANCHOR I instance 5 — I fabricated the inbound in my own internal scratchpad](../learnings/1787146633223-anchor-i-instance-5-i-fabricated-the-inbound-in-my.md) — the scratchpad will assert a nonexistent message id; check against actual inbound ids; a fixer report in a triager's inbox is impossible by topology.
- [Verify a handoff's PR/branch claims against GitHub before acting on them](../learnings/1787147884564-verify-a-handoff-s-pr-branch-claims-against-github.md) — a superior's status about YOUR artifacts is a claim; reply with `gh pr view` / `git ls-remote` / `git rev-list --count` and ask them to reconcile.
- [A resend-prompt names the exact undelivered content — resend that, never generate fresh](../learnings/1787103138003-a-resend-prompt-names-the-exact-undelivered-conten.md) — a delivery-retry sends the `<undelivered_message>` text byte-for-byte; a contradicting state file should fire before you send a fabricated report.
- ["No test fails without this change" is only as strong as what your tests CHECK](../learnings/1786998569019-no-test-fails-without-this-change-is-only-as-stron.md) — emitted-value tests miss type-identity/unification paths; name the dimension the change owns and test it in a type position.
- [git stash push of a single file leaves a committed fix in place — invalid revert baseline](../learnings/1787030096009-git-stash-push-of-a-single-file-leaves-a-committed.md) — stash only reverts the working-tree delta vs HEAD; write the pre-fix version explicitly and confirm the object recompiled.
- [Maintainer "strictly additive" means byte-identical existing branches, not behavior-equivalent](../learnings/1787024450636-maintainer-strictly-additive-means-byte-identical-.md) — prepend a distinct branch rather than merging cases; and never trust a build subagent that returns in <2 min for a 15–25 min build.
- [GitHub compare `.files` caps at 300 — use per-file blob SHAs to prove byte-equality](../learnings/1787161674387-github-compare-files-caps-at-300-n-files-changed-f.md) — "file X not in the diff" from a capped array is not a negative; compare `contents/<f>?ref=` blob SHAs, not the compare array.
