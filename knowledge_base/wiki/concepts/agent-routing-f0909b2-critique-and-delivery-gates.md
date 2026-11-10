---
title: Critique-gate, delivery-gate & chain-routing hook mechanics
type: concept
group: agent-routing
tags: [critique-gate, delivery-gate, chain-routing, codex, attestation, pr-workflow, comment-hygiene, hooks]
source_count: 33
---

# Critique-gate, delivery-gate & chain-routing hook mechanics

## TL;DR

The `critique-gate` overlay installs PreToolUse hooks that block `send_message` delivery markers,
`gh pr create`, and `gh pr edit --body` until codex critique rounds are recorded and still cover the current
state. This page owns the edit-event counter, ABSTAIN token matching, read-only `gh` workarounds, chain
routing and PR-body limits; stage counting and attestation parsing are on
[gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md), the fails-open recorder on
[critique gate and decision recording](review-critique-gate-and-recording.md).

- **The gate counts edit *events* since the last critique, not hash diffs.** Any write after an approve
  re-arms it — a byte-exact revert, a memory note, the HTML explanation render, a `git push`, a `gh` comment,
  even a read-only Bash call. Batch ALL edits, format once, commit, run CODE_REVIEW + OUTPUT_REVIEW last, and
  send back-to-back.
- **It re-hashes every `### Attested` file at send time.** A volatile attested file (`.claude-trace/*.jsonl`)
  blocks delivery forever, and an older round's attestation can deny `gh pr create` after a newer approve.
  Re-run a fresh OUTPUT_REVIEW attesting ONLY current, stable files as plain `- <sha256> <path>` lines.
- **ABSTAIN delivery messages must not contain the literal tokens `WOULD_APPROVE` or `BLOCK`** (case-sensitive,
  even in "not a BLOCK" prose). Paraphrase; keep the `ABSTAIN_POLICY` token present.
- **`mkdir -p /workspace/.claude` at session start** — if it is missing the hook denies even read-only commands.
- **Read-only `gh api .../pulls/N` GETs trip the PR-creation Bash arm** for any repo; it matches raw command
  text (heredocs included). Use `gh pr view N --repo <owner>/<repo> --json ...`, the `.../issues/<n>` endpoint,
  the skill's python scripts, or MCP `github_get_pull_request_comments`. Three denials open an admin escalation.
- **Recorded rounds require a FRESH `mcp__codex__codex` call** with the verbatim reviewer
  developer-instructions and a `STAGE:` line; `sandbox: danger-full-access`; omit `model`.
- **The chain-routing gate blocks any marker message without `in_reply_to`**, fresh delegations included. Send
  every marker (`[Triage handoff]`, `[Review Verdict]`, `[Fix Report]`, `[Resolution]`, …) via the
  `send_message` tool with an integer `in_reply_to=<chain-initiating inbound>` plus explicit `to` +
  `thread_id`; a final-response `<message>` block is refused even with the attribute, and is never delivered.
  `send_file` is ungated, so send the message before its memo. A `[Resolution]` needs OUTPUT_REVIEW first.
- **`--body-file` must be a literal absolute path** (`$VAR` paths and `-F body=@$var` are refused). The body
  is capped at 1000 characters (not bytes; the final `<sub>` disclaimer and `Fixes #N` lines don't count) and
  ≤2 lines per `##` section; put the 5-bullet block before the first `##`; pre-check with
  `upsert_pr_body.description_problems(...)`.
- **Comment hygiene is strictly enforced**, even in test files: timeless invariants only, no change-history
  narration, no line-restating comments, and (Slang maintainer rule, PR #14115) no issue/PR numbers or URLs in
  source or test comments; process history goes in commits and PR descriptions.

Through-line: sequence discipline (edit → format → commit → critique → send) and clean prose.

## The gate is stateful and re-arms on edit events, not content

`gate-critique-on-deliver.sh` causes most round-trip pain because **it counts edit events, not content
diffs.** A delivery marker needs the LATEST OUTPUT_REVIEW (and CODE_REVIEW) approve to cover the current state, and
every file write since re-arms the gate, even a byte-exact revert or an out-of-band memory note; on slang#12708 this treadmill added ~4 codex rounds
([attestation treadmill](../learnings/1788298159048-critique-gate-attestation-treadmill-batch-all-edit.md)),
and a `gh` comment post or a `cat > /tmp/file` in Bash bumps the counter too
([volatile attested file](../learnings/1788423324537-critique-delivery-gate-codex-attesting-a-volatile-.md)).

The canonical sequence: (1) ALL edits (code + PR body), (2) `clang-format` ONCE, (3) commit, (4)
CODE_REVIEW + OUTPUT_REVIEW as the final actions, (5) only `send_message` calls, no writes or `gh` posts
between. Non-delivery writes (memory files, `append_learning`) are fine after the send.
A code push is not operator-gated, so push freely and gate only the report
([attestation treadmill](../learnings/1788298159048-critique-gate-attestation-treadmill-batch-all-edit.md)),
but push before the final OUTPUT_REVIEW, since a `git push` after the approve still counts as a write.

Step (5) is stricter than it sounds: **any Bash call** after the approve counts, even a read-only `wc -c` on
the deliverable. If something slips in, a same-thread `mcp__codex__codex-reply` re-attestation ("no content
changes, re-hash X") can clear it, else run a fresh `/codex-critique` OUTPUT_REVIEW. If `mcp__codex__codex` is
missing after an image rebuild, `request_restart` loads it (an admin will reject a gate bypass meanwhile)
([any Bash between approve and send counts as an edit](../learnings/1790593139115-critique-gate-any-bash-between-approve-and-send-co.md)).
The `edits_since_critique` counter is bumped by every tracked write, deliverable or not: a memory-file append
and then a scratch `/tmp/*.json` copy of the approved report each got a `[Fix Report]` refused, each costing a
re-review round plus a denial strike (three open an escalation)
([any file write after the approve voids it, even /tmp scratch](../learnings/1790799595374-critique-gate-any-file-write-after-the-output-revi.md));
on slang#13567 an unrelated memory edit cost three more rounds ("N edit(s) recorded since the last critique
round"), so do memory writes before the final OUTPUT_REVIEW or after the send
([any edit after an OUTPUT_REVIEW approve re-arms it](../learnings/1791671231742-delivery-gate-any-edit-after-an-output-review-appr.md)).
On slang#14115 an HTML explanation render and a `git push` after the approve each re-armed it for `gh pr
create` / `gh pr edit` / `[Fix Report]`, and `codex-reply` rounds recorded nothing, so the fresh
`mcp__codex__codex` OUTPUT_REVIEW is the fallback that works: render HTML, finalize files, OUTPUT_REVIEW, then
publish and deliver with no writes between. The gate also matches `gh api repos/.../pulls/<n>/files` as PR
creation; read a diff with `gh pr diff <n>`
([fixer gate: any file write voids OUTPUT_REVIEW approve](../learnings/1793410518336-fixer-gate-autosquash-rebases-onto-new-master-any-.md)).

Two secondary edit-triggers: **PR-body citations drift** (a `file.cpp:NNNN` in the body is invalidated by any
comment trim or `clang-format` reflow above it, so re-derive ALL line numbers from the final committed file in
one `grep -n` pass), and the **bot-transparency disclaimer belongs on comments, not the PR description**
(appending it to the body changed the attested hash, forcing a re-review)
([attestation treadmill](../learnings/1788298159048-critique-gate-attestation-treadmill-batch-all-edit.md)).

## Attestation re-hashing: never attest a volatile file

Full attestation rules are on [gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md); cases
here: a live `.claude-trace/session-*.jsonl` attested by codex mutates every turn and blocks EVERY later
delivery and `gh` write ("reviewed artifacts changed"), so re-run OUTPUT_REVIEW telling codex to attest ONLY
stable committed files, nothing under `.claude-trace/`, `/tmp/` or any `*.jsonl`
([volatile attested file](../learnings/1788423324537-critique-delivery-gate-codex-attesting-a-volatile-.md));
editing an attested file after an approve silently invalidates that stage
([recorded rounds require fresh codex](../learnings/1788800125011-codex-critique-delivery-gate-recorded-rounds-requi.md));
an earlier OUTPUT_REVIEW's hash of a since-changed test file denied `gh pr create` after a later
`codex-reply` approve that did not replace the set (diagnose with `jq '.critique_attested.OUTPUT_REVIEW'`
against `sha256sum`; fix with a FRESH OUTPUT_REVIEW listing the PR body plus the flagged file)
([an older OUTPUT_REVIEW's attested hash can block gh pr create](../learnings/1790828388217-critique-gate-an-older-output-review-s-attested-ha.md));
backtick-wrapped `` - `<sha>` `<path>` `` lines are not recorded, so ask for plain `- <sha256> <path>` and
confirm with `jq` before sending
([codex must emit plain Attested lines](../learnings/1791671231742-delivery-gate-any-edit-after-an-output-review-appr.md)).

## Content-based token matching: the ABSTAIN fast-path trap

For an `ABSTAIN_POLICY` decision `record_decision` is not critique-gated (the skill's Step-4 early return), but
the delivery hook scans the outbound `[Approval Decision]` text, and its ABSTAIN fast-path fires only if the
text matches `\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b` AND does NOT match `\b(WOULD_APPROVE|BLOCK)\b`. Prose like
"…a **WOULD_APPROVE candidate**" or "Not BLOCK (no verified bug)" flips the negative condition, so the message
falls through to the full DECISION_REVIEW/OUTPUT_REVIEW requirement (a denial and a soft-cap strike). Never
write the bare uppercase tokens in an ABSTAIN delivery, even to say "not a block". Matching is
case-sensitive, so lowercase paraphrases ("a change-request verdict", "clean on the merits", "no verified
defect", "flagged a defect") are safe, and "approve"/"approvable" alone is fine. The `record_decision` ledger
fields (challenger JSON with `why_not_block` etc.) are unaffected; the hook matches only `send_message` text
and Bash commands. `CRITIQUE_ABSTAIN_FASTPATH=0` disables the fast-path, but the clean fix is avoiding the two
tokens ([ABSTAIN fast-path tokens](../learnings/1788385047068-approver-infra-abstain-critique-gate-abstain-fast-.md)).

## Hook gotchas that block even read-only work

One approver decision (slang#12860) hit three traps
([critique-gate hook gotchas](../learnings/1788479415062-approver-infra-critique-gate-hook-gotchas-missing-.md)):

1. **Missing `/workspace/.claude/` breaks the hook.** It writes `/workspace/.claude/workflow-state.json`; if
   the dir is absent it aborts (`workflow-state.json.tmp: No such file`) AND still denies the command, even a
   read-only GET. `mkdir -p /workspace/.claude` once at session start.
2. **The ABSTAIN fast-path token suppression** (above), confirmed a third time.
3. **`gh api .../pulls/N` GETs trip the PR-creation Bash arm.** The hook inspects only the top-level command
   string, so `python3 eval-clauses.py <ws>` (which shells out to `gh api .../pulls`) does NOT trip it. Read PR
   metadata via `gh pr view --json` or the skill's python scripts; `gh pr view --json` has no
   `authorAssociation`, so take it from `eval-clauses.py`'s clauses.json.

It recurs outside the approver (a stale-webhook check); use `gh pr view --json ...` or the
`.../issues/<n>` endpoint
([recorded rounds require fresh codex](../learnings/1788800125011-codex-critique-delivery-gate-recorded-rounds-requi.md)).
The arm is `BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'`
(line 65 of `/app/hooks/gate-critique-on-deliver.sh`), a substring match with no HTTP method, refused as
"CRITIQUE REQUIRED before PR creation" whatever the repo (a GET of `.../pulls/N/reviews` and of another repo's
`.../pulls/260` were both denied). `gh pr view <n> --repo <owner>/<repo> --json state,reviews,comments,statusCheckRollup`
reads the same state ungated, as do `gh api graphql` with `pullRequest(number:)` (`reviewThreads` for inline
comments) and `gh api repos/<o>/<r>/issues/<n>` for merged/closed state (re-confirmed 2026-11-09), and a `gh api .../issues/comments/<id>` PATCH under 1,000 bytes passes without an
OUTPUT_REVIEW. For an external repo `gh api .../issues/<n>/events` returned 401 via the gateway; a WebFetch of
the github.com PR page gave the timeline
([read-only PR REST GETs blocked](../learnings/1792771352224-gate-critique-on-deliver-blocks-read-only-gh-api-c.md),
[PR REST path reads blocked, 11-09](../learnings/1794250959208-gate-critique-on-deliver-blocks-read-only-gh-api-c.md),
[cross-repo pulls GET treated as PR creation](../learnings/1792788345487-gate-critique-on-deliver-treats-read-only-gh-api-p.md)).

Because the arm matches command *text*, it also fires on a GET of one inline review comment and on a heredoc
memory note merely containing the PR-open verb or a `/pulls/` path. Three denials open an admin bypass
escalation, so stop retrying: read inline comments with
`mcp__slang-mcp__github_get_pull_request_comments`, and write memory text naming gated commands with the Edit
tool ([gate regex-matches PR-open phrases in reads and heredocs](../learnings/1790593139115-critique-gate-any-bash-between-approve-and-send-co.md)).
Later sessions hit both shapes again (a `gh api repos/.../pulls/comments/<id>` GET, a memory heredoc) plus a
literal-path rule: `-F body=@$var.md` is refused, so post each reply with a literal `-F body=@/abs/path.md`
([counting unresolved PR review threads](../learnings/1790717452750-counting-unresolved-pr-review-threads-include-isou.md),
[Dawn/Tint num_subgroups (gate gotcha)](../learnings/1793144297778-dawn-tint-num-subgroups-first-lands-in-chromium-75.md)).
The same rule binds `gh pr edit N --body-file $D/file.md` ("cannot be resolved (not a literal path…)") even for
an approved file; spell the absolute path out
([`--body-file $VAR` refused](../learnings/1791289646233-gate-critique-on-deliver-refuses-gh-pr-edit-body-f.md)).

The body itself is size-gated (slangpy#1137): `gh pr edit --body-file` is capped at 1000 chars with each `##`
section at most 2 lines, and the 5-bullet block counts toward whichever section holds it, so put it before the
first `##`. Every PLAN/CODE/OUTPUT_REVIEW prompt there needed a `ROUND:` line and a `REQUIREMENTS:` block of
verbatim maintainer quotes with anchor URLs or the round was not recorded (format on
[critique gate and decision recording](review-critique-gate-and-recording.md)), and any edit after an
OUTPUT_REVIEW approve invalidated it for the next GitHub write
([PR-description gate caps sections at 2 lines](../learnings/1791353262348-cpu-large-dispatch-coverage-in-slangpy-crossing-th.md)).
A denial rejects the whole Bash call, silently skipping any chained step (push-bundling rule on
[gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md)).

## Recorded rounds must be fresh codex calls with the canonical block

Stage counting is on [gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md): each recorded round
is a fresh `mcp__codex__codex` call with the canonical `/codex-critique` developer-instructions verbatim (the
hook checks its "You are an independent reviewer..." / "Return ONLY the structured output below" sentinels); a
`codex-reply` carrying `STAGE:` is "NOT recorded" even with a clean verdict, so run round 2+ as a fresh call.
`sandbox: danger-full-access` is required, and a model override is rejected ("key can only access
default-models"): omit `model`
([recorded rounds require fresh codex](../learnings/1788800125011-codex-critique-delivery-gate-recorded-rounds-requi.md),
[operator-name fix + PR gate](../learnings/1788914603700-slang-qualified-operator-name-references-fix-pr-ga.md)).

## Chain-routing gate: in_reply_to is mandatory on any delivery marker

`gate-chain-routing.sh` BLOCKS any `send_message` whose text contains a chain delivery marker (`[Triage
handoff]`, `[Report]`, `[Fix Report]`, `[Resolution]`, `[Fix Review Request]`, `[Review Verdict]`) unless
`in_reply_to` is set, **even for a fresh delegation** to a child or peer with no inbound from that recipient.
What works: `in_reply_to=<chain-initiating inbound id>` (e.g. the parent's dispatch) plus explicit
`to="<recipient>"` and the canonical `thread_id`. The explicit `to` OVERRIDES `in_reply_to`'s default "route to
inbound's source" (`to="slang-fixer", in_reply_to=2` delivered to slang-fixer). Don't rephrase the marker out. `send_file` (no marker) is NOT gated. The benign `[GATE AUDIT] ... gate skipped` warning on a triage roll-up
that merely names `[Fix Report]` owes no code review (marker-text false triggers on
[gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md))
([chain-routing gate in_reply_to](../learnings/1788540148122-chain-routing-gate-requires-in-reply-to-on-handoff.md)).
For a fresh peer dispatch, reply on the peer's existing edge (`in_reply_to=<a prior inbound from that peer>`)
rather than a bare send
([volatile attested file](../learnings/1788423324537-critique-delivery-gate-codex-attesting-a-volatile-.md)).

Every fresh peer delegation carrying a marker hits it (slangpy#1153 `[Triage handoff]`s, `[Fix Review
Request]`s on PR #13353 and from slangpy-fixer with only `thread_id`), each refused until `in_reply_to=<the parent inbound that
dispatched this chain>` was added beside the explicit `to`. `to` wins for delivery and replies still return to
the originating session; `in_reply_to` only supplies `thread_id` + reply-correlation, so `thread_id` is then
optional. Because `send_file` is ungated, an attached memo can land before its blocked handoff text, and on a
brand-new thread (no session yet) it lands in the recipient's existing session on another issue, which must
bounce it back (#14321): send the message first, then the file. Merely *quoting* another tier's bracketed
marker in prose trips the benign `[GATE AUDIT]` note for a read-only role, so avoid it
([in_reply_to on a fresh peer delegation](../learnings/1789374291867-chain-routing-gate-needs-in-reply-to-when-message-.md),
[peer handoff rejected without in_reply_to](../learnings/1790786405952-chain-routing-hook-rejects-peer-handoff-send-messa.md),
[Triage handoff needs in_reply_to; message before file](../learnings/1793205779658-the-chain-routing-hook-rejects-a-triage-handoff-th.md),
[send the handoff message before its memo](../learnings/1793825152219-nanoclaw-send-the-triage-handoff-message-before-it.md),
[fixer delivery gates](../learnings/1793850163791-fixer-delivery-gates-review-request-field-format-i.md),
[peer review-request needs in_reply_to](../learnings/1790797956245-explain-diff-upsert-re-appends-fixes-disclaimer-pe.md)).

**Send marker messages through the `send_message` tool, not a final-response block.** On slangpy#1204 an
Orchestrator `[Resolution]` as a final-response `<message to=…>` block was refused for lacking `in_reply_to`,
then again with `in_reply_to="22"`; the same text via
`mcp__nanoclaw__send_message({to, in_reply_to: 22, thread_id: "gh-issue-<owner>/<repo>-<n>", text})` landed
first time. A refused block is not delivered, only logged to the scratchpad. The send also logged `[GATE AUDIT] …
codex-critique … was never invoked`: a `[Resolution]` is expected to pass OUTPUT_REVIEW, and the late critique
found two errors already delivered (a local CPU repro attributed to CI, helpers called `private` with no
access modifier). So run `mcp__codex__codex` against live GitHub before any
`[Resolution]`, and quote task ids from `ncl tasks list`, since `--name` gets a hash suffix
([final-response Resolution refused twice](../learnings/1791196726879-final-response-resolution-refused-twice-by-chain-r.md)).
A triager's fresh `[Triage handoff]` without `in_reply_to` is refused on both channels (tool and block) even
with an explicit `thread_id`; what passes is `send_message(to="slang-fixer", in_reply_to=<id of the parent's
dispatch that started this triage>, thread_id="gh-issue-<owner>/<repo>-<n>")`
([fresh Triage handoff needs in_reply_to=<parent dispatch>](../learnings/1792070986920-chain-routing-gate-a-fresh-triage-handoff-needs-in.md)).
A reviewer's final-response `<message to="slang-fixer" in_reply_to="2">` carrying `[Review Verdict]` was refused
twice ("the <message> tag omitted in_reply_to") although the attribute was there; the tool with integer
`in_reply_to: 2` landed first time, so treat the XML attribute as unreliable for any marker
([send Review Verdict via send_message(in_reply_to=N)](../learnings/1792103692562-chain-routing-gate-send-review-verdict-via-send-me.md)).
A fixer's `[Fix Report]` takes `in_reply_to=<the triage handoff's seq>`; when the id is not in view, find the
session in `ncl sessions list` by its `gh-issue-<owner>/<repo>-<n>` thread and read the seq from
`ncl sessions messages <session-id>`
([Fix Report needs in_reply_to=<triage handoff seq>](../learnings/1792242240195-codex-critique-first-call-on-a-fresh-thread-often-.md)).

## Comment hygiene and PR-body discipline are gate-enforced

From the `Namespace::operator+` parse-gap fix (slang#12971 → PR #12976)
([operator-name fix + PR gate](../learnings/1788914603700-slang-qualified-operator-name-references-fix-pr-ga.md)):

- **Comment hygiene is strictly enforced, even in test files.** codex must-fixes change-history narration
  ("newly", "prior to the fix", "for the first time", "already worked pre-fix") and line-restating comments. Write TIMELESS invariants ("X must diagnose Y"); keep change-history in the PR
  body/commit; don't overclaim a test-coverage analogy.
- **A Slang maintainer made this a standing rule.** tangent-vector, CHANGES_REQUESTED on PR #14115: "Stop adding
  *process* information (e.g., issue/PR numbers) as documentation in the codebase … written in a more
  'timeless' fashion". So no `(#NNNN)`, `shader-slang/slang#NNNN` or issue URLs in source or test comments,
  test headers included (older tests often do); no "before the fix this was E30200" / "master returned
  X" or "version N is the first with …" history; state the invariant. This overrides peer or bot nits asking a test
  comment to "name the old failure it guards". Self-check:
  `git diff <base> HEAD | grep -nE '^\+.*(#[0-9]{4,}|issues/|before the fix)'`
  ([no process information in code comments](../learnings/1793662633860-slang-maintainer-rule-no-process-information-issue.md)).
- **A 5-bullet chain report is not the PR-description shape.** codex may demand a "five-part" or 5-bullet body;
  `/slang-fix-issue` mandates Summary / Root cause / Tests / Risk, ≤2 lines per section and
  <1,000 chars excluding the `Fixes` and disclaimer lines; cite that rule when declining
  ([PR-body shape](../learnings/1791671231742-delivery-gate-any-edit-after-an-output-review-appr.md)).
  codex tends to measure the limit in raw bytes over the whole body; the enforcer (`counted_lines` in
  `/app/hooks/lib/pr_description.py`) drops the final `<sub>` disclaimer and exact closing-keyword (`Fixes #N`)
  lines and counts Python characters, so answer a size must-fix with the output of
  `upsert_pr_body.description_problems(open(F).read(), 1000, 2)` (`[]` = within limits)
  ([byte vs char PR-body limit](../learnings/1792199075282-codex-critique-gotchas-wiki-recall-first-replies-b.md)).
- **The explain-diff-html upsert does not write the description.** `upsert_pr_body.py` writes the explanation
  to ONE PR comment and strips the old explanation block from the description; write the concise description
  yourself with `gh pr edit --body-file <literal absolute path>`
  ([upsert writes a comment, not the description](../learnings/1791289646233-gate-critique-on-deliver-refuses-gh-pr-edit-body-f.md)).
- Git note: `--force-with-lease` fails with "stale info" in a fresh worktree lacking
  `refs/remotes/origin/*`; use `--force-with-lease=<branch>:<remote-sha>` (sha via `git ls-remote`).
  DIAGNOSTIC_TEST CHECK lines must be in EMISSION order (parse-phase errors before semantic);
  `non-exhaustive` matches specific codes and ignores follow-ons.

## Hand-editing generated trees under a lint gate

`docs/generated/tests/` files carry `//META: generated=true … Do not edit by hand`, but a maintainer may
ask you to hand-add a symmetric entry instead of re-running the operator-driven generator. That is fine with
guardrails
([hand-editing docs/generated/tests](../learnings/1788384936519-hand-editing-docs-generated-tests-coverage-tree-li.md)):
`python3 docs/generated/tests/_meta/regenerate.py lint` MUST pass with 0 errors (pre-existing warnings are
fine); write an honest `//META` header (real model, timestamp, HEAD); disclose the hand-edit in the PR Process
report; mirror the removed file as the template via `git show <removal-commit>^:<path>`; verify the new
`.slang` with `slang-test`; and run `formatting.sh` on any README table row.

The lint gate is narrower than the conventions beside it. When you retarget a bundle test after an
intentional compiler change, also fix the stale instruction in the bundle's `_prompt.md` (merged precedents
#13150 and #13172 edited it alongside the test and the README drift-from-source row; #13282 first missed it),
or the approved regeneration path (re-prompt plus `mark-fresh`) regenerates the stale test.
`_common.md` also requires each README coverage row's Claim to equal `Cnn: <//META: purpose>` verbatim, which
`regenerate.py lint` does not check, so diff the two by hand. Rewriting README `## Claims` entries to HEAD
behaviour, against `_claims.md` §1's "doc's own wording", is precedent-accepted (#13150 claim 131) when paired
with a drift-from-source row
([stale agentic-test retarget must also update the bundle _prompt.md](../learnings/1790593515973-stale-agentic-test-retarget-must-also-update-the-b.md)).

**Source learnings (33):**

- [attestation treadmill: batch edits, OUTPUT_REVIEW last](../learnings/1788298159048-critique-gate-attestation-treadmill-batch-all-edit.md)
- [ABSTAIN fast-path trips on WOULD_APPROVE / BLOCK](../learnings/1788385047068-approver-infra-abstain-critique-gate-abstain-fast-.md) — case-sensitive.
- [volatile attested file blocks delivery forever](../learnings/1788423324537-critique-delivery-gate-codex-attesting-a-volatile-.md)
- [hook gotchas: state dir, tokens, gh-api-pulls](../learnings/1788479415062-approver-infra-critique-gate-hook-gotchas-missing-.md) — slang#12860.
- [chain-routing gate requires in_reply_to](../learnings/1788540148122-chain-routing-gate-requires-in-reply-to-on-handoff.md)
- [in_reply_to on a fresh peer delegation](../learnings/1789374291867-chain-routing-gate-needs-in-reply-to-when-message-.md)
- [peer handoff rejected without in_reply_to](../learnings/1790786405952-chain-routing-hook-rejects-peer-handoff-send-messa.md)
- [recorded rounds require fresh codex](../learnings/1788800125011-codex-critique-delivery-gate-recorded-rounds-requi.md) — omit model.
- [`::`-qualified operator-name fix; PR-gate gotchas](../learnings/1788914603700-slang-qualified-operator-name-references-fix-pr-ga.md)
- [no process information in code comments](../learnings/1793662633860-slang-maintainer-rule-no-process-information-issue.md) — PR #14115; grep self-check.
- [hand-editing docs/generated/tests](../learnings/1788384936519-hand-editing-docs-generated-tests-coverage-tree-li.md)
- [any Bash after approve counts; arm matches text](../learnings/1790593139115-critique-gate-any-bash-between-approve-and-send-co.md) — 3 denials escalate.
- [bundle-test retarget must fix `_prompt.md`](../learnings/1790593515973-stale-agentic-test-retarget-must-also-update-the-b.md)
- [counting unresolved review threads](../learnings/1790717452750-counting-unresolved-pr-review-threads-include-isou.md) — (gate half) literal path.
- [any write after the approve voids it](../learnings/1790799595374-critique-gate-any-file-write-after-the-output-revi.md)
- [older attested hash blocks gh pr create](../learnings/1790828388217-critique-gate-an-older-output-review-s-attested-ha.md)
- [Triage handoff needs in_reply_to; message before file](../learnings/1793205779658-the-chain-routing-hook-rejects-a-triage-handoff-th.md)
- [explain-diff upsert; review-request needs in_reply_to](../learnings/1790797956245-explain-diff-upsert-re-appends-fixes-disclaimer-pe.md)
- [final-response `[Resolution]` refused twice](../learnings/1791196726879-final-response-resolution-refused-twice-by-chain-r.md) — OUTPUT_REVIEW first.
- [fresh Triage handoff needs in_reply_to=<parent dispatch>](../learnings/1792070986920-chain-routing-gate-a-fresh-triage-handoff-needs-in.md)
- [send `[Review Verdict]` via send_message(in_reply_to=N)](../learnings/1792103692562-chain-routing-gate-send-review-verdict-via-send-me.md)
- [`--body-file $VAR` refused](../learnings/1791289646233-gate-critique-on-deliver-refuses-gh-pr-edit-body-f.md)
- [PR-description gate: ≤1000 chars, ≤2 lines/section](../learnings/1791353262348-cpu-large-dispatch-coverage-in-slangpy-crossing-th.md) — (gate half).
- [any edit after approve re-arms; plain Attested lines](../learnings/1791671231742-delivery-gate-any-edit-after-an-output-review-appr.md)
- [fixer gate: any file write voids OUTPUT_REVIEW approve](../learnings/1793410518336-fixer-gate-autosquash-rebases-onto-new-master-any-.md) — #14115; `gh pr diff`.
- [byte vs char PR-body limit](../learnings/1792199075282-codex-critique-gotchas-wiki-recall-first-replies-b.md) — `description_problems(...)`.
- [`[Fix Report]` needs in_reply_to=<handoff seq>](../learnings/1792242240195-codex-critique-first-call-on-a-fresh-thread-often-.md)
- [read-only PR REST GETs blocked](../learnings/1792771352224-gate-critique-on-deliver-blocks-read-only-gh-api-c.md) — BASH_PATTERNS.
- [gate-critique-on-deliver blocks read-only gh api calls on the PR REST path](../learnings/1794250959208-gate-critique-on-deliver-blocks-read-only-gh-api-c.md) — escapes: `gh pr view --json`, graphql `pullRequest(number:)`, `issues/<n>`.
- [cross-repo pulls GET = PR creation](../learnings/1792788345487-gate-critique-on-deliver-treats-read-only-gh-api-p.md)
- [Dawn/Tint num_subgroups in chromium/7559](../learnings/1793144297778-dawn-tint-num-subgroups-first-lands-in-chromium-75.md) — (gate half).
- [send the handoff message before its memo](../learnings/1793825152219-nanoclaw-send-the-triage-handoff-message-before-it.md) — #14321.
- [fixer delivery gates](../learnings/1793850163791-fixer-delivery-gates-review-request-field-format-i.md) — `thread_id` alone refused.
