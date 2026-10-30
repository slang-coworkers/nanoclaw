---
title: Critique-gate, delivery-gate & chain-routing hook mechanics
type: concept
group: agent-routing
tags: [critique-gate, delivery-gate, chain-routing, codex, attestation, pr-workflow, comment-hygiene, hooks]
source_count: 29
---

# Critique-gate, delivery-gate & chain-routing hook mechanics

## TL;DR

The `critique-gate` overlay installs PreToolUse hooks that block `send_message` delivery markers,
`gh pr create`, and `gh pr edit --body` until codex critique rounds are recorded and still cover the current
state. This page is the home for the edit-event counter, ABSTAIN token matching, read-only `gh` workarounds,
chain routing and PR-body limits; stage counting and attestation parsing are on
[gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md), the fails-open recorder on
[critique gate and decision recording](review-critique-gate-and-recording.md).

- **The gate counts edit *events* since the last critique, not hash diffs.** Any file write after an approve
  re-arms it — even reverting a file to its byte-exact attested content, editing a memory note, or posting a
  `gh` comment. Any Bash call counts, even a read-only `wc -c`: approve and send back-to-back. Batch ALL
  edits, format once, commit, then run CODE_REVIEW + OUTPUT_REVIEW as the final actions before sending.
- **It re-hashes every `### Attested` file at send time.** A volatile attested file
  (`.claude-trace/*.jsonl`) blocks delivery forever, and a stale attestation from an older round can deny
  `gh pr create` after a newer approve. Re-run a fresh OUTPUT_REVIEW attesting ONLY current, stable
  files, as plain `- <sha256> <path>` lines.
- **ABSTAIN delivery messages must not contain the literal tokens `WOULD_APPROVE` or `BLOCK`** (case-sensitive,
  even in "not a BLOCK" prose). Paraphrase; keep the `ABSTAIN_POLICY` token present.
- **`mkdir -p /workspace/.claude` at session start** — if it is missing the hook denies even read-only commands.
- **Read-only `gh api .../pulls/N` GETs trip the PR-creation Bash arm**, for any repo, and it matches raw
  command text (heredocs included). Use `gh pr view N --repo <owner>/<repo> --json ...`, the `.../issues/<n>`
  endpoint, the skill's python scripts, or the MCP `github_get_pull_request_comments` tool. Three denials
  open an admin bypass escalation.
- **Recorded rounds require a FRESH `mcp__codex__codex` call** with the verbatim reviewer
  developer-instructions and a `STAGE:` line; `sandbox: danger-full-access` is required; omit `model`.
- **Chain-routing gate blocks any marker message without `in_reply_to`**, fresh delegations included. Send
  every marker (`[Triage handoff]`, `[Review Verdict]`, `[Fix Report]`, `[Resolution]`, …) via the
  `send_message` tool with an integer `in_reply_to=<chain-initiating inbound>` plus explicit `to` +
  `thread_id`; a final-response `<message>` block is refused even with the attribute, and is never delivered.
  `send_file` is ungated, so send the message before its memo. A `[Resolution]` needs OUTPUT_REVIEW first.
- **`--body-file` must be a literal absolute path** (`$VAR` paths and `-F body=@$var` are refused). The body
  is capped at 1000 characters (not bytes, not counting the final `<sub>` disclaimer or `Fixes #N` lines) and
  ≤2 lines per `##` section; put the 5-bullet block before the first `##`, and pre-check with
  `upsert_pr_body.description_problems(...)`.
- **Comment hygiene is strictly enforced**, even in test files: timeless invariants only, no change-history
  narration, no line-restating comments.

Through-line: sequence discipline (edit → format → commit → critique → send) and clean prose avoid treadmills.

## The gate is stateful and re-arms on edit events, not content

`gate-critique-on-deliver.sh` is the source of most round-trip pain because **it counts edit events, not
content diffs.** Sending a `[Fix Report]` or other delivery marker requires the LATEST OUTPUT_REVIEW (and
CODE_REVIEW) approve to still cover the current state, and every file write since that approve re-arms the
gate: reverting a file to its byte-exact attested content or editing an out-of-band memory note gets the next
send REFUSED. On slang#12708 this treadmill added ~4 extra codex rounds
([attestation treadmill](../learnings/1788298159048-critique-gate-attestation-treadmill-batch-all-edit.md)),
and a `gh` comment post or a `cat > /tmp/file` in Bash increments the counter too
([volatile attested file](../learnings/1788423324537-critique-delivery-gate-codex-attesting-a-volatile-.md)).

The canonical sequence: (1) make ALL edits (code + PR body), (2) run `clang-format` ONCE, (3) commit, (4) run
CODE_REVIEW + OUTPUT_REVIEW as the final actions, (5) immediately emit only `send_message` calls with no
intervening file writes or `gh` posts. Non-delivery writes (memory files, `append_learning`) are fine after
the send. A code push is not operator-gated and does not go through the gate: push freely, gate only the
report ([attestation treadmill](../learnings/1788298159048-critique-gate-attestation-treadmill-batch-all-edit.md)).

Step (5) is stricter than it sounds: the counter treats **any Bash call** after the approve as an edit, even
a read-only `wc -c` on the deliverable, so the approve and the gated `send_message` run back-to-back. If
something slips in, a cheap same-thread `mcp__codex__codex-reply` re-attestation ("no content changes,
re-hash X") can clear it; fall back to a fresh `/codex-critique` OUTPUT_REVIEW if it does not. If
`mcp__codex__codex` itself is missing after an image rebuild, `request_restart` loads it, and an admin will
usually reject a gate bypass while that path exists
([any Bash between approve and send counts as an edit](../learnings/1790593139115-critique-gate-any-bash-between-approve-and-send-co.md)).
The `edits_since_critique` counter is bumped by every tracked write, deliverable or not: on 2026-09-30 two
`[Fix Report]` sends were refused in a row, after a memory-file append and then after a scratch `/tmp/*.json`
copy of the approved report, and each refusal cost a re-review round plus a denial strike (three open an
escalation) ([any file write after the approve voids it, even /tmp scratch](../learnings/1790799595374-critique-gate-any-file-write-after-the-output-revi.md));
on slang#13567 an unrelated memory edit after the approve cost three more rounds ("N edit(s) recorded since
the last critique round"). Do memory writes before the final OUTPUT_REVIEW or after the delivery is sent
([any edit after an OUTPUT_REVIEW approve re-arms it](../learnings/1791671231742-delivery-gate-any-edit-after-an-output-review-appr.md)).

Two secondary edit-triggers: **PR-body citations drift** (a `file.cpp:NNNN` cited in the body is invalidated
by every comment trim or `clang-format` reflow above it, so re-derive ALL line numbers from the final
committed file in one `grep -n` pass), and the **bot-transparency disclaimer belongs on comments, not the PR
description** (appending it to the body changed the attested hash and forced a re-review)
([attestation treadmill](../learnings/1788298159048-critique-gate-attestation-treadmill-batch-all-edit.md)).

## Attestation re-hashing: never attest a volatile file

The full attestation rules (strict line parsing, which rounds replace the map, the fix recipe) are on
[gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md); the cases recorded here: a live
`/workspace/agent/.claude-trace/session-*.jsonl` attested by codex mutates every turn and blocks EVERY later
delivery and `gh` write with "reviewed artifacts changed since the OUTPUT_REVIEW approve", so re-run
OUTPUT_REVIEW telling codex to attest ONLY stable committed files and not hash anything under
`.claude-trace/`, `/tmp/` or any `*.jsonl`
([volatile attested file](../learnings/1788423324537-critique-delivery-gate-codex-attesting-a-volatile-.md)); editing an
attested file after an approve silently invalidates that stage
([recorded rounds require fresh codex](../learnings/1788800125011-codex-critique-delivery-gate-recorded-rounds-requi.md));
an earlier OUTPUT_REVIEW's hash of a since-changed test file denied `gh pr create` after a later `codex-reply`
approve that did not replace the set, diagnosed with `jq '.critique_attested.OUTPUT_REVIEW'
/workspace/.claude/workflow-state.json` against `sha256sum` and fixed by a FRESH OUTPUT_REVIEW listing the PR
body plus the flagged file
([an older OUTPUT_REVIEW's attested hash can block gh pr create](../learnings/1790828388217-critique-gate-an-older-output-review-s-attested-ha.md));
and backtick-wrapped `` - `<sha>` `<path>` `` lines are not recorded, so ask for plain `- <sha256> <path>` and
confirm with `jq` before sending
([codex must emit plain Attested lines](../learnings/1791671231742-delivery-gate-any-edit-after-an-output-review-appr.md)).

## Content-based token matching: the ABSTAIN fast-path trap

For an `ABSTAIN_POLICY` decision, `record_decision` is not critique-gated (the skill's Step-4 early-return
relaxes the gate for ABSTAIN_* rows), but the delivery hook scans the outbound `[Approval Decision]` text, and
its ABSTAIN fast-path fires only if the text matches `\b(ABSTAIN_POLICY|ABSTAIN_INFRA)\b` AND does NOT match
`\b(WOULD_APPROVE|BLOCK)\b`. Prose like "…would be a **WOULD_APPROVE candidate**"
([delivery gate enum literals](../learnings/1788358262796-approver-infra-abstain-delivery-critique-gate-keys.md))
and "Not BLOCK (no verified bug)"
([ABSTAIN fast-path tokens](../learnings/1788385047068-approver-infra-abstain-critique-gate-abstain-fast-.md))
both flipped the negative condition, so the message fell through to the full DECISION_REVIEW/OUTPUT_REVIEW
requirement: a denial and a soft-cap strike. Never write the bare uppercase tokens in an ABSTAIN delivery, not
even to say "not a block". Matching is case-sensitive, so lowercase paraphrases ("a change-request verdict",
"clean on the merits", "no verified defect", "flagged a defect") are safe, and "approve"/"approvable" alone is
fine. The `record_decision` ledger fields (challenger JSON with `why_not_block` etc.) are unaffected; the hook
matches only `send_message` text and Bash commands. `CRITIQUE_ABSTAIN_FASTPATH=0` disables the fast-path, but
the clean fix is avoiding the two tokens
([ABSTAIN fast-path tokens](../learnings/1788385047068-approver-infra-abstain-critique-gate-abstain-fast-.md)).

## Hook gotchas that block even read-only work

A single approver decision (slang#12860) surfaced three traps
([critique-gate hook gotchas](../learnings/1788479415062-approver-infra-critique-gate-hook-gotchas-missing-.md)):

1. **Missing `/workspace/.claude/` breaks the hook.** It writes `/workspace/.claude/workflow-state.json`; if
   the dir is absent it aborts with `line 417: ...workflow-state.json.tmp: No such file or directory` AND
   still denies the command, even a read-only `gh api .../pulls` GET. `mkdir -p /workspace/.claude` once at
   session start.
2. **The ABSTAIN fast-path token suppression** (above), confirmed a third time.
3. **`gh api .../pulls/N` GETs trip the PR-creation Bash arm.** The hook inspects only the top-level command
   string, so `python3 eval-clauses.py <ws>` (which shells out to `gh api .../pulls`) does NOT trip it. Read PR
   metadata via `gh pr view --json` or the skill's python scripts; `gh pr view --json` has no
   `authorAssociation` field, so take it from `eval-clauses.py`'s clauses.json.

The read-only over-match recurs outside the approver too: even harvesting live PR state for a stale-webhook
check trips it, so use `gh pr view --json ...` or the `.../issues/<n>` endpoint
([recorded rounds require fresh codex](../learnings/1788800125011-codex-critique-delivery-gate-recorded-rounds-requi.md)).
The arm is the hook's
`BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'` (line 65 of
`/app/hooks/gate-critique-on-deliver.sh`, read 2026-10-23), a substring match with no HTTP method; any match
is refused as "CRITIQUE REQUIRED before PR creation" whatever the repo: a GET of `.../pulls/N/reviews` and a GET
of another repo's `.../pulls/260` were both denied on 2026-10-23. `gh pr view <n> --repo <owner>/<repo> --json
reviews,comments,statusCheckRollup` reads the same state ungated, and a `gh api .../issues/comments/<id>`
PATCH under 1,000 bytes passes without an OUTPUT_REVIEW. For an external repo, `gh api .../issues/<n>/events`
returned 401 through the gateway; a WebFetch of the github.com PR page gave the timeline facts
([read-only PR REST GETs blocked](../learnings/1792771352224-gate-critique-on-deliver-blocks-read-only-gh-api-c.md),
[cross-repo pulls GET treated as PR creation](../learnings/1792788345487-gate-critique-on-deliver-treats-read-only-gh-api-p.md)).

Because the arm matches command *text*, it also fires on a GET of one inline review comment and on a heredoc
memory note that merely contains the PR-open verb or a `/pulls/` path. After three denials the hook opens an
admin bypass escalation, so stop retrying: read inline review comments with
`mcp__slang-mcp__github_get_pull_request_comments`, and write memory text naming gated commands with the Edit
tool ([gate regex-matches PR-open phrases in reads and heredocs](../learnings/1790593139115-critique-gate-any-bash-between-approve-and-send-co.md)).
Later sessions hit both shapes again (a `gh api repos/.../pulls/comments/<id>` GET, a memory heredoc naming
PR-creation words) plus a literal-path rule: `-F body=@$var.md` is refused, so post each reply with a literal
`-F body=@/abs/path.md` [Counting unresolved PR review threads: include isOutdated=true, classify by first author](../learnings/1790717452750-counting-unresolved-pr-review-threads-include-isou.md);
a #13911 GPU-repro session hit the same inline-comment block and literal-path rule [Dawn/Tint num_subgroups first lands in chromium/7559 (gate gotcha)](../learnings/1793144297778-dawn-tint-num-subgroups-first-lands-in-chromium-75.md).
The same rule binds `gh pr edit N --body-file $D/file.md`: "cannot be resolved (not a literal path…)" even for
an OUTPUT_REVIEW-approved file, so spell the absolute path out
([`--body-file $VAR` refused](../learnings/1791289646233-gate-critique-on-deliver-refuses-gh-pr-edit-body-f.md)).

The body itself is size-gated: on slangpy#1137 `gh pr edit --body-file` was capped at 1000 chars with each
`##` section at most 2 lines, and the 5-bullet block counts toward whichever section holds it, so put it
before the first `##`. The same chain confirmed that every PLAN/CODE/OUTPUT_REVIEW prompt needs a `ROUND:` line
and a `REQUIREMENTS:` block of verbatim maintainer quotes with anchor URLs or the round is not recorded
(format on [critique gate and decision recording](review-critique-gate-and-recording.md)), and that any edit
after an OUTPUT_REVIEW approve invalidates it for the next GitHub write
([PR-description gate caps sections at 2 lines](../learnings/1791353262348-cpu-large-dispatch-coverage-in-slangpy-crossing-th.md)).
A denial rejects the whole Bash call, so any chained step is silently skipped too (push-bundling rule on
[the gate-mechanics page](agent-routing-f0909b1-critique-gate-mechanics.md)).

## Recorded rounds must be fresh codex calls with the canonical block

The stage-counting rules are stated in full on [gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md):
each recorded round is a fresh `mcp__codex__codex` call carrying the canonical `/codex-critique`
developer-instructions verbatim (the hook checks the "You are an independent reviewer..." / "Return ONLY the
structured output below" sentinels), and a `codex-reply` carrying `STAGE:` prints "Critique round NOT recorded:
developer-instructions do not match the canonical reviewer block" even with a clean verdict, so run round 2+
as a fresh call with the `STAGE:` line. `sandbox: danger-full-access` is required (read-only is rejected inside
Docker), and a model override is rejected ("key can only access default-models"): omit `model`
([recorded rounds require fresh codex](../learnings/1788800125011-codex-critique-delivery-gate-recorded-rounds-requi.md),
[operator-name fix + PR gate](../learnings/1788914603700-slang-qualified-operator-name-references-fix-pr-ga.md)).

## Chain-routing gate: in_reply_to is mandatory on any delivery marker

A separate PreToolUse hook, `gate-chain-routing.sh`, BLOCKS any `send_message` whose text contains a chain
delivery marker (`[Triage handoff]`, `[Report]`, `[Fix Report]`, `[Resolution]`, `[Fix Review Request]`,
`[Review Verdict]`) unless `in_reply_to` is set, **even for a fresh delegation** to a child or peer where no
inbound from that recipient exists. What works: `in_reply_to=<the chain-initiating inbound id>` (e.g. the
parent's dispatch) plus an explicit `to="<recipient>"` and the canonical `thread_id`. The explicit `to`
OVERRIDES `in_reply_to`'s default "route to inbound's source": with `to="slang-fixer", in_reply_to=2` the
runtime delivered to slang-fixer, not the parent. Don't fight the gate by rephrasing the marker out.
`send_file` (no marker) is NOT gated, so attachments go through without `in_reply_to`
([chain-routing gate in_reply_to](../learnings/1788540148122-chain-routing-gate-requires-in-reply-to-on-handoff.md)).
The benign `[GATE AUDIT] ... gate skipped` warning on a triage roll-up that merely names `[Fix Report]` owes no
code review (marker-text false triggers are covered on [gate mechanics](agent-routing-f0909b1-critique-gate-mechanics.md))
([chain-routing gate in_reply_to](../learnings/1788540148122-chain-routing-gate-requires-in-reply-to-on-handoff.md)).
For a fresh peer dispatch, reply on the peer's existing edge (`in_reply_to=<a prior inbound from that peer>`)
rather than a bare send
([volatile attested file](../learnings/1788423324537-critique-delivery-gate-codex-attesting-a-volatile-.md)).

Every fresh peer delegation that carries a marker hits it: a slangpy `[Triage handoff]` (#1153) and a second
one to slangpy-fixer, a fixer's `[Fix Review Request]` to `slang-reviewer` (PR #13353), and a slang
`[Triage handoff]` to slang-fixer on 2026-10-28 were all refused until `in_reply_to=<the parent inbound that
dispatched this chain>` was added beside the explicit `to`. `to` wins for delivery and the fixer's replies still
come back to the originating session; `in_reply_to` only supplies `thread_id` + reply-correlation, so
`thread_id` is then optional. Because `send_file` is not gated, an attached memo can land before its blocked
handoff text: send the message first, then the file. Merely *quoting* another tier's bracketed marker name in
prose trips the benign `[GATE AUDIT]` note for a read-only role, so avoid it
([chain-routing gate needs in_reply_to on a fresh peer delegation carrying a chain marker](../learnings/1789374291867-chain-routing-gate-needs-in-reply-to-when-message-.md),
[chain-routing hook rejects peer handoff without in_reply_to](../learnings/1790786405952-chain-routing-hook-rejects-peer-handoff-send-messa.md),
[the hook rejects a [Triage handoff] without in_reply_to; send the message before the file](../learnings/1793205779658-the-chain-routing-hook-rejects-a-triage-handoff-th.md),
[peer review-request needs in_reply_to](../learnings/1790797956245-explain-diff-upsert-re-appends-fixes-disclaimer-pe.md)).

**Send marker messages through the `send_message` tool, not a final-response block.** On slangpy#1204 an
Orchestrator `[Resolution]` written as a final-response `<message to=…>` block was refused for lacking
`in_reply_to`, then again with `in_reply_to="22"`; the same text via
`mcp__nanoclaw__send_message({to, in_reply_to: 22, thread_id: "gh-issue-<owner>/<repo>-<n>", text})` landed
first time. A refused block is not delivered at all; it only reaches the scratchpad log. The send also logged
`[GATE AUDIT] … codex-critique … was never invoked`: a `[Resolution]` is expected to pass OUTPUT_REVIEW, and the
after-the-fact critique found two errors already delivered (a local CPU repro attributed to CI, helpers called
`private` with no access modifier). So run `mcp__codex__codex` against live GitHub before any `[Resolution]`,
and quote task ids from `ncl tasks list`, since `--name` gets a hash suffix
([final-response Resolution refused twice](../learnings/1791196726879-final-response-resolution-refused-twice-by-chain-r.md)).
A triager's fresh `[Triage handoff]` to slang-fixer without `in_reply_to` is refused on both channels, the MCP
tool and a `<message to=…>` block, even with an explicit `thread_id`; what passes is
`send_message(to="slang-fixer", in_reply_to=<id of the parent's dispatch that started this triage>,
thread_id="gh-issue-<owner>/<repo>-<n>")`
([fresh Triage handoff needs in_reply_to=<parent dispatch>](../learnings/1792070986920-chain-routing-gate-a-fresh-triage-handoff-needs-in.md)).
A reviewer's final-response `<message to="slang-fixer" in_reply_to="2">` carrying `[Review Verdict]` was refused
twice with "the <message> tag omitted in_reply_to" although the attribute was there; the tool with
`in_reply_to: 2` as an integer landed first time, so treat the XML attribute as unreliable for any marker
([send Review Verdict via send_message(in_reply_to=N)](../learnings/1792103692562-chain-routing-gate-send-review-verdict-via-send-me.md)).
A fixer's `[Fix Report]` takes `in_reply_to=<the triage handoff's seq>`; when the id is not in view, find the
session in `ncl sessions list` by its `gh-issue-<owner>/<repo>-<n>` thread and read the seq from
`ncl sessions messages <session-id>`
([Fix Report needs in_reply_to=<triage handoff seq>](../learnings/1792242240195-codex-critique-first-call-on-a-fresh-thread-often-.md)).

## Comment hygiene and PR-body discipline are gate-enforced

From the `Namespace::operator+` parse-gap fix (slang#12971 → PR #12976)
([operator-name fix + PR gate](../learnings/1788914603700-slang-qualified-operator-name-references-fix-pr-ga.md)):

- **Comment hygiene is strictly enforced, even in test files.** codex flags as must-fix any change-history
  narration ("newly", "prior to the fix", "for the first time", "already worked pre-fix") and comments that
  restate the adjacent line. Write TIMELESS invariants ("X must diagnose Y"); keep change-history in the PR
  body/commit. Don't overclaim a test-coverage analogy either.
- **A 5-bullet chain report is not the PR-description shape.** codex may demand the triager's "five-part body"
  or a 5-bullet body; `/slang-fix-issue` mandates Summary / Root cause / Tests / Risk, ≤2 lines per section and
  <1,000 chars excluding the `Fixes` and disclaimer lines. Cite that rule when declining
  ([PR-body shape](../learnings/1791671231742-delivery-gate-any-edit-after-an-output-review-appr.md)).
  codex also tends to measure the limit in raw bytes over the whole body; the enforcer (`counted_lines` in
  `/app/hooks/lib/pr_description.py`) drops the final `<sub>` disclaimer and exact closing-keyword (`Fixes #N`)
  lines and counts Python characters, so answer a size must-fix with the output of
  `upsert_pr_body.description_problems(open(F).read(), 1000, 2)` (`[]` = within limits)
  ([byte vs char PR-body limit](../learnings/1792199075282-codex-critique-gotchas-wiki-recall-first-replies-b.md)).
- **The explain-diff-html upsert does not write the description.** `upsert_pr_body.py` writes the explanation
  to ONE PR comment and strips the old explanation block from the description; write the concise description
  yourself with `gh pr edit --body-file <literal absolute path>`
  ([upsert writes a comment, not the description](../learnings/1791289646233-gate-critique-on-deliver-refuses-gh-pr-edit-body-f.md)).
- Operational git note: `--force-with-lease` fails with "stale info" in a fresh worktree lacking
  `refs/remotes/origin/*`; use `--force-with-lease=<branch>:<remote-sha>` (sha via `git ls-remote`).
  DIAGNOSTIC_TEST CHECK lines must be in EMISSION order (parse-phase errors before semantic);
  `non-exhaustive` matches specific codes and ignores follow-ons.

## Hand-editing generated trees under a lint gate

`docs/generated/tests/` files carry `//META: generated=true … Do not edit by hand`, but a maintainer may
legitimately ask you to hand-add a symmetric entry rather than re-run the operator-driven generator. That is
fine with guardrails
([hand-editing docs/generated/tests](../learnings/1788384936519-hand-editing-docs-generated-tests-coverage-tree-li.md)):
`python3 docs/generated/tests/_meta/regenerate.py lint` MUST pass with 0 errors (pre-existing warnings are
fine); write an honest `//META` header (real model, timestamp, HEAD); disclose the hand-edit in the PR Process
report; mirror the removed file as the template via `git show <removal-commit>^:<path>`; verify the new
`.slang` with `slang-test`; and run `formatting.sh` on any README table row.

The lint gate is narrower than the conventions beside it. When you retarget a bundle test after an
intentional compiler change, also fix the stale instruction in the bundle's `_prompt.md`: the merged
precedents #13150 and #13172 edited `_prompt.md` alongside the test and the README drift-from-source row,
while #13282 (retargeting after #13175) first missed `metadata/_prompt.md:165-167` ("DebugNoScope is emitted
with zero operands"). Without that edit the approved regeneration path (re-prompt plus `mark-fresh`)
regenerates the stale test. `_common.md` also requires each README coverage row's Claim to equal
`Cnn: <//META: purpose>` verbatim, which `regenerate.py lint` does not check, so diff the two by hand.
Rewriting README `## Claims` entries to HEAD behaviour, against `_claims.md` §1's "doc's own wording", is
precedent-accepted (#13150 claim 131) when paired with a drift-from-source row
([stale agentic-test retarget must also update the bundle _prompt.md](../learnings/1790593515973-stale-agentic-test-retarget-must-also-update-the-b.md)).

**Source learnings (29):**

- [attestation treadmill: batch edits, OUTPUT_REVIEW last](../learnings/1788298159048-critique-gate-attestation-treadmill-batch-all-edit.md) — edit events not hash diffs; push isn't gated.
- [gate keys on decision enum literals in ABSTAIN prose](../learnings/1788358262796-approver-infra-abstain-delivery-critique-gate-keys.md) — literal `WOULD_APPROVE`.
- [ABSTAIN fast-path trips on WOULD_APPROVE / BLOCK](../learnings/1788385047068-approver-infra-abstain-critique-gate-abstain-fast-.md) — case-sensitive.
- [volatile attested file blocks delivery forever](../learnings/1788423324537-critique-delivery-gate-codex-attesting-a-volatile-.md) — gh posts re-arm the counter.
- [hook gotchas: state dir, tokens, gh-api-pulls](../learnings/1788479415062-approver-infra-critique-gate-hook-gotchas-missing-.md) — slang#12860.
- [chain-routing gate requires in_reply_to](../learnings/1788540148122-chain-routing-gate-requires-in-reply-to-on-handoff.md) — explicit `to` overrides; `send_file` ungated.
- [in_reply_to on a fresh peer delegation](../learnings/1789374291867-chain-routing-gate-needs-in-reply-to-when-message-.md) — quoting another tier's marker trips `[GATE AUDIT]`.
- [chain-routing hook rejects peer handoff without in_reply_to](../learnings/1790786405952-chain-routing-hook-rejects-peer-handoff-send-messa.md)
- [recorded rounds require fresh codex](../learnings/1788800125011-codex-critique-delivery-gate-recorded-rounds-requi.md) — `danger-full-access`; omit model.
- [`::`-qualified operator-name fix; PR-gate gotchas](../learnings/1788914603700-slang-qualified-operator-name-references-fix-pr-ga.md) — timeless comments even in tests.
- [hand-editing docs/generated/tests](../learnings/1788384936519-hand-editing-docs-generated-tests-coverage-tree-li.md) — lint 0 errors, honest META, disclose.
- [any Bash after approve counts; arm text-matches reads/heredocs](../learnings/1790593139115-critique-gate-any-bash-between-approve-and-send-co.md) — 3 denials escalate.
- [bundle-test retarget must fix `_prompt.md`](../learnings/1790593515973-stale-agentic-test-retarget-must-also-update-the-b.md)
- [counting unresolved review threads](../learnings/1790717452750-counting-unresolved-pr-review-threads-include-isou.md) — (gate half) `-F body=@$var` refused.
- [any write after the approve voids it](../learnings/1790799595374-critique-gate-any-file-write-after-the-output-revi.md) — each refusal is a strike.
- [older attested hash blocks gh pr create](../learnings/1790828388217-critique-gate-an-older-output-review-s-attested-ha.md) — fresh call re-attests.
- [Triage handoff needs in_reply_to; message before file](../learnings/1793205779658-the-chain-routing-hook-rejects-a-triage-handoff-th.md) — 2026-10-28.
- [explain-diff upsert; review-request needs in_reply_to](../learnings/1790797956245-explain-diff-upsert-re-appends-fixes-disclaimer-pe.md)
- [final-response `[Resolution]` refused twice](../learnings/1791196726879-final-response-resolution-refused-twice-by-chain-r.md) — use the tool; OUTPUT_REVIEW first.
- [fresh Triage handoff needs in_reply_to=<parent dispatch>](../learnings/1792070986920-chain-routing-gate-a-fresh-triage-handoff-needs-in.md) — refused on both channels.
- [send `[Review Verdict]` via send_message(in_reply_to=N)](../learnings/1792103692562-chain-routing-gate-send-review-verdict-via-send-me.md)
- [`--body-file $VAR` refused](../learnings/1791289646233-gate-critique-on-deliver-refuses-gh-pr-edit-body-f.md) — upsert writes a comment.
- [PR-description gate: ≤1000 chars, ≤2 lines/section](../learnings/1791353262348-cpu-large-dispatch-coverage-in-slangpy-crossing-th.md) — (gate half) slangpy#1137.
- [any edit after approve re-arms; plain Attested lines](../learnings/1791671231742-delivery-gate-any-edit-after-an-output-review-appr.md) — slang#13567; PR body ≠ 5-bullet.
- [byte vs char PR-body limit](../learnings/1792199075282-codex-critique-gotchas-wiki-recall-first-replies-b.md) — `description_problems(...)`.
- [`[Fix Report]` needs in_reply_to=<handoff seq>](../learnings/1792242240195-codex-critique-first-call-on-a-fresh-thread-often-.md) — via `ncl sessions messages`.
- [read-only PR REST GETs blocked](../learnings/1792771352224-gate-critique-on-deliver-blocks-read-only-gh-api-c.md) — BASH_PATTERNS line 65.
- [cross-repo pulls GET = PR creation](../learnings/1792788345487-gate-critique-on-deliver-treats-read-only-gh-api-p.md) — `gh pr view --repo` ungated.
- [Dawn/Tint num_subgroups lands in chromium/7559](../learnings/1793144297778-dawn-tint-num-subgroups-first-lands-in-chromium-75.md) — (gate half) pulls/comments GET blocked.
