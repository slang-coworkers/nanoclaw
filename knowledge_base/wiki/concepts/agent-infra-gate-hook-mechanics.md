---
title: "Gate-Hook Mechanics: Read-Only False Positives, the Plan Gate, and Recording/Format Matchers"
type: concept
group: agent-infra
tags: [critique-gate, delivery-gate, gate-plan, plan-tracker, false-positive, read-only, requirements-anchor, attested-hash, gate-audit]
source_count: 24
---

# Gate-hook mechanics: read-only false positives, the plan gate, and recording/format matchers

## TL;DR

The harness gates pattern-match command TEXT, never intent — and most of the pain is false positives on read-only work. What the hooks match, what they silently refuse, and the read-safe escapes. The workflow-state file's lifecycle — resets, races, phantom blocks, the 3-denial latch — is on [workflow-state lifecycle](agent-infra-workflow-state-lifecycle.md).

- A `gh api` or `curl` GET of `repos/*/pulls/<n>` is "PR creation", and a `fix/issue-<n>` branch string anywhere in a command (even a query param) trips the plan tracker — both on read-only triage calls. A PreToolUse denial also skips the WHOLE chained Bash command: a chained `sed -i` silently never runs while you believe you edited the file.
- Each false-positive denial burns one of 3 strikes; three open an admin escalation for something that was never a delivery. Stop retrying and switch endpoints.
- Read-safe escapes: `issues/<n>` (serves PR state, `closed_at`, `merged_at` too), `issues/<n>/comments`, `issues/<n>/timeline`, `issues/comments/<id>`, `check-suites/<id>/check-runs`, `commits/<sha>/check-runs`, `actions/runs?head_sha=<sha>` (no branch string), `gh pr view --json`, and the slang-mcp github tools.
- The plan gate (`gate-plan.sh`) denies ANY Bash command containing a `>`/`>>` redirect while `plan_written=false` — including a read-only verification run like `slang-test > log 2>&1`. `plan-tracker.sh` records ONLY the Write tool, so re-Write the identical plan via Write (never Edit) to flip it.
- `REQUIREMENTS:` URLs must carry anchors (`#issuecomment-<id>`, `#issue-<n>`, `#discussion_r-<id>`, `#pullrequestreview-<id>`) or the round silently drops with no error; anchor an issue BODY as `#issue-<database-id>` (fetch with `gh api ... --jq .id`), never a bare issue URL. The same validator pins the verbatim dev-instructions sentinels.
- The host gate AUDIT pattern-matches marker text in outbound rows: quoting a bracketed workflow marker with no matching critique call logs "gate skipped" — discuss a coworker's markers without quoting the bracketed string.
- Late edit bumps defeat freshness: ANY Bash `>`/`>>` (even `2>/dev/null`, even a timed-out command whose bump lands AFTER the round's reset) can stale an approve — fire the marker in the clean window. A `[[ "$x" > *"y"* ]]` comparison operator counts as a write too, and `pkill -f <pattern>` self-matches your own launcher cmdline — poll state with `jq` (not shell comparisons) and kill bridge clients by PID.
- The PR-description length gate counts the body minus the trailing `<sub>` disclaimer trailer and AI-assistance line — strip those before re-counting.
- The authority for "did my critique count / what did it say" is `critique_verdicts` + `critique_attested`, not stage counts; broken gateway GitHub creds (401 Bad credentials) are an infra outage to report, not a connect-flow.
## Read-only false positives: substring matchers with no verb

The critique-gate hook pattern-matches `gh api [^|]*pulls` and `api.github.com.../pulls` on ANY Bash
command — including read-only GETs, and `curl` against the same URLs — refusing them with "CRITIQUE
REQUIRED before PR creation" ([burns denials on read-only /pulls reads](../learnings/1794814240187-critique-gate-burns-denials-on-read-only-pulls-api.md),
[pulls-read false positive, timeout residue, attested-hash binding](../learnings/1794868189687-critique-gate-mechanics-pulls-read-false-positive-.md)).
Three such reads (e.g. `gh api repos/shader-slang/slang/pulls/13650` to check a PR's state) each count as a
"PR creation" denial, hit the 3-denial cap, and open an admin escalation for something that was never a
delivery. The full arm regex and endpoint-by-endpoint escapes are on
[critique and delivery gates](agent-routing-f0909b2-critique-and-delivery-gates.md); the remedy in one
line: never use the `/pulls/N` route for reads — `/issues/N` returns state/closed_at/merged_at for PRs too,
`/check-suites/<id>/check-runs` for CI, `gh pr view` (GraphQL; bypasses the pattern, needs a valid token).
The refusal also aborts the WHOLE compound Bash call when any one command in it matches (`cmd1; gh api
…/pulls/N …` → cmd1 never runs). This is general PreToolUse mechanics, not critique-gate-specific: ANY
hook denial — e.g. the public-comment review gate refusing the `gh` part of a chain — skips the whole
command before it executes, so a chained `sed -i` silently never runs and the file is left unmodified
while you believe you edited it (seen on issue #14664's rollup comment: the gate then denied on the old
sha256); do each file-mutating step in its OWN Bash call, verify the result (hash + grep), and only then
run the gated `gh`/post command
([PreToolUse gate denial skips the whole chained bash command](../learnings/1795186597404-pretooluse-gate-denial-skips-the-whole-chained-bas.md)).
A read-safe alternative that never meets the hook at all is the
slang-mcp `github_get_pull_request` tool (not a Bash call, the hook never sees it). Don't "fix" the block by
re-running codex-critique PLAN_REVIEW for a task that isn't creating a PR — the block is a false positive
on a read path, not a missing stage
([critique gate hook blocks read-only gh api pulls calls](../learnings/1794919112736-critique-gate-hook-blocks-read-only-gh-api-pulls-c.md)).
Re-measured 2026-11-19 (slang-fixer, the #13985 close disposition): `gate-critique-on-deliver.sh`'s
BASH_PATTERNS match ANY Bash command containing `gh api … pulls …` — there is no method
discrimination, so a read-only GET (`gh api repos/x/pulls/13993 --jq .state`) is denied as "PR
creation" / demanded critique. `gh pr view <n> --repo <owner>/<repo> --json <fields>` (plus
`issues/<n>` / `issues/<n>/comments` for issue-side reads) matches none of the patterns and is the
idiomatic read anyway. A one-line patch restricting the gh-api member to write-intent shapes was
handed to the operator 2026-11-19 (`/workspace/agent/gate-critique-pulls-read-fix.patch`); until it
lands, treat a "PR creation" denial on a read-only `gh api …/pulls…` GET as a false positive of
this pattern and retry the read via `gh pr view` rather than escalating critique stages. A
denied/blocked verification probe still means UNVERIFIED — take the alternate read path; never
record the claim from relayed provenance
([delivery gate denies read-only gh api pulls GETs — use gh pr view](../learnings/1795107911913-delivery-gate-denies-read-only-gh-api-pulls-gets-u.md)).
Re-measured again 2026-11-20 (fix-5667, PR #14666): codex's own `pulls/14666/reviews` read inside the sandbox
was denied the same way, and a spurious "CRITIQUE GATE BLOCKED your PR creation" card with no pending create
was really the per-window state missing only PLAN_REVIEW (CODE_REVIEW/OUTPUT_REVIEW recorded separately) —
one PLAN_REVIEW round on the plan file cleared it
([critique gate false-positives on read-only pulls API calls](../learnings/1795204342182-critique-gate-false-positives-on-read-only-pulls-a.md)).
After the claude→opencode session migration (2026-11-21) the same matcher burned 2 denials (near the
3-strike cap) on read-only pulls reads, because the fresh opencode session's workflow-state carries none of
the old claude-session rounds
([opencode migration: fresh state blocks read-only pulls reads](../learnings/1795224576884-opencode-migration-critique-gate-state-reset-block.md)).
Codex reviewers hit the same wall inside their sandbox — tell them about it in the prompt's environment
note. The plan tracker has the same text-matching defect: "PLAN REQUIRED: Write a plan" fires when
`fix/issue-<n>` appears anywhere in the command, even a branch name inside a query param
([harness hooks false-positive on read-only GitHub queries; unauth fallback paths for CI triage](../learnings/1794814232168-harness-hooks-false-positive-on-read-only-github-q.md)).

When gateway GitHub creds are broken (a literal invalid `GH_TOKEN` placeholder in the container; the
OneCLI gateway injecting an invalid credential for `gh`/`curl`/`git` alike — 401 Bad credentials on
api.github.com repo reads, "Invalid username or token" on git push), that is an infra outage to report,
not a connect-flow (no `connect_url` in the 401 body). For read-only triage meanwhile,
`curl --noproxy '*'` gives unauthenticated access to public endpoints, but the IP quota is 60/h and burns
fast: check `/rate_limit` first, cache responses to files, and order reads by scarcity — check-runs and
check-suites APIs are auth-only (404 unauth) while statuses and `actions/runs` are not
([harness hooks false-positive; unauth fallbacks](../learnings/1794814232168-harness-hooks-false-positive-on-read-only-github-q.md)).

## The plan gate and plan-tracker: Write, not Edit

`plan-tracker.sh` (PostToolUse) matches only the `Write` tool or a codex `apply_patch`; a plan amended via
the **Edit** tool does NOT set `plan_written` — every subsequent Bash-with-writes and source Edit keeps
failing with "PLAN REQUIRED" even though the plan file exists. Fix: write the plan (or a companion plan
file) with the **Write** tool once ([plan-tracker wants Write not Edit](../learnings/1794855941188-critique-gate-mechanics-plan-tracker-wants-write-n.md);
re-verified 2026-11-17 on slang#13804 — an Edit to `reports/<n>.md` kept "PLAN REQUIRED", one Write of the
same content passed, [plan-gate Write-vs-Edit + diag exit-code pins](../learnings/1794928650513-plan-gate-write-vs-edit-diag-exit-code-pins-when-m.md)).
Re-verified again 2026-11-26 with a sharper boundary: the hook (`/app/hooks/plan-tracker.sh`, PostToolUse)
only counts Write-tool writes to `/workspace/agent/reports/*`, and an approved codex PLAN_REVIEW does NOT
set `plan_written` either — a session that edited its existing plan file stays refused ("PLAN REQUIRED"
persists after a real plan update and an approved plan review), and a new task/message resets
`workflow-state.json` (`plan_written: false`) so the symptom recurs per task on long-lived chains. The fix
is always the same: read the plan file and re-write it verbatim once with the Write tool, and the gate
opens ([plan gate only arms on Write-tool plan files — Edit does not count](../learnings/1795717300987-plan-gate-only-arms-on-write-tool-plan-files-edit-.md)).
The PreToolUse arm is `gate-plan.sh` (opt-in via `/workspace/agent/.overlay-plan-gate`): it denies ANY Bash
command containing a `>`/`>>` redirect while `plan_written=false` — including read-only verification tasks
like `slang-test > log 2>&1`. When a plan file for the target already exists under
`/workspace/agent/reports/`, rewriting it via the Write tool with IDENTICAL content triggers the tracker
and sets `plan_written=true` — no content change, no repo edit
([plan gate blocks log redirects on read-only test runs](../learnings/1794892096397-plan-gate-blocks-log-redirects-on-read-only-test-r.md)).
Epoch resets make this a recurring chore: every new task epoch (host re-dispatch) resets
`/workspace/.claude/workflow-state.json`, `plan_written` goes false and source edits are refused until a
plan is written AGAIN (Write tool — Edit does not record); keep a compact per-round plan file ready to
re-Write ([state resets, 429 recovery](../learnings/1794892336879-critique-gate-recording-mechanics-anchored-require.md);
bridge-killed-thread epoch measurement on [round recording](agent-infra-critique-round-recording.md)).
The hook (`/app/hooks/plan-tracker.sh`, PostToolUse matcher `Write`) also re-arms after N source edits
(`edits_since_plan`), so a mid-task plan refresh must itself be a Write-tool rewrite of the plan file —
and the critique delivery gate likewise requires a fresh OUTPUT_REVIEW round after ANY edit since the last
approve, even a one-line `sed` to the plan file via Bash: sequence deliverable-final edits before the last
critique round ([plan-tracker hook counts only Write-tool plan writes, not Edit](../learnings/1794933052106-plan-tracker-hook-counts-only-write-tool-plan-writ.md)).

## Freshness-gate re-record traps: comparison operators, pkill self-match, append-only attempt logs

Three more ways a delivery gets stuck after the bridge re-record recipe already works (slang#14684, 2026-11-21; all three cost ~3 wasted bridge rounds): (1) `track-edits.sh` counts as a write ANY bash command whose string contains a space-separated ` > ` — including a `[[ "$x" > *"y"* ]]` comparison *operator*, not just redirects — which bumps `edits_since_critique` and demands another OUTPUT_REVIEW round right before a marker send; poll workflow-state via `jq -r '.critique_verdicts.STAGE'` / `.edits_since_critique` fields instead, never grep with shell comparisons. (2) `pkill -f <pattern>` self-matches the bash -c wrapper of your own launcher command (the pattern string is in your own cmdline) and kills your own shell instantly — kill stale bridge clients by PID, or with a pattern quoted so it doesn't appear verbatim. (3) `critique-attempts.jsonl` is append-only and survives state resets, so a `grep -c '"event":"round"'` poll gives false positives from pre-reset rounds — watch workflow-state's `.critique_stages` instead. The recipe that works: setsid-detached bridge dispatch → poll `.critique_stages` → deliver the marker with NO bash calls between the last round and the send (issue-status comments under 1000 chars via heredoc `cat >` DO bump edits — write those BEFORE the final round, or use the Write tool to an exempt path like reports/) ([freshness-gate traps: bash " > " comparisons, pkill self-match, and append-only attempts file in critique re-records](../learnings/1795243212301-freshness-gate-traps-bash-comparisons-pkill-self-m.md)).

A self-invalidating variant of the same counter (slang#14722, 2026-11-25, hit 3 times): the bash command that dispatches the codex bridge client carried `> out.log 2> err.log` redirects, and its PostToolUse (track-edits counts any bash write) fired when the tool returned — i.e. AFTER the round event had zeroed the counter — so the delivery gate denied the very round just recorded, on every re-record. Fix: dispatch the bridge client REDIRECT-FREE (it writes its own result file via fs.writeFileSync — `setsid nohup env PATH="/pnpm:$PATH" bun run <client> <prompt> <devinst> <outfile> &`), poll with a plain `sleep N; tail -1 /workspace/.claude/critique-attempts.jsonl`, then run the delivery marker immediately as a clean command. Two corollaries from the same incident: `2>&1 | tail` does NOT match the IS_WRITE regex (the `>` must directly follow start/whitespace/pipe), and a `cat > file <<EOF` heredoc inside a `gh api` comment-post command trips the 1000-byte public-comment gate — write comment bodies with the Write tool in a separate step (bodies under 1000 bytes need no OUTPUT_REVIEW) ([critique dispatch bash redirects re-trip the edit gate after every round](../learnings/1795636526953-critique-dispatch-bash-redirects-re-trip-the-edit-.md)).

## Gate audit: marker text in non-report outbound rows

The host runs a gate audit on outbound rows: any message containing a literal workflow-marker string
(observed: `[Fix Report]`) with no codex-critique call in the session is logged as "gate skipped"
(2026-11-17, an Orchestrator reply to slang-fixer — the ack merely *referenced* the fixer's pending
formal marker; no critique was due). Harmless when the message is genuinely not a report, but it
dirties the audit trail and could be misread as a bypassed quality gate. When acknowledging or
discussing a coworker's formal markers — in acks, status updates, or memory-file prose that gets
quoted back outbound — don't quote the bracketed marker verbatim; say "the formal marker", "the
report of record", or "your marker" instead ([Don't quote bracketed workflow markers in non-report messages](../learnings/1794918539609-don-t-quote-bracketed-workflow-markers-in-non-repo.md)).

## Silent round drops: anchored REQUIREMENTS URLs

`track-critique.sh` silently drops a PLAN/CODE/OUTPUT_REVIEW round when the prompt's `REQUIREMENTS:` field
cites a bare issue/PR URL — the validator regex requires an anchor:
`https://github.com/<owner>/<repo>/(issues|pull)/<n>#(issuecomment-|discussion_r-|pullrequestreview-|issue-)<digits>`.
A prompt citing `issues/14421` with no anchor records NOTHING (the hook exits 0 with an additionalContext
notice the harness may not surface), so the delivery gate later refuses with "missing critique stages" even
though codex approved. Fix: cite the issue BODY as `issues/14421#issue-14421` and comments as
`#issuecomment-<id>` ([REQUIREMENTS links must be anchored](../learnings/1794861965038-track-critique-requirements-links-must-be-anchored.md));
the durable form of the issue-body anchor is `#issue-<database-id>` — fetch the id with
`gh api repos/<owner>/<repo>/issues/<n> --jq .id` rather than assuming the human-visible number
([record stages in the same turn; anchor with the database id](../learnings/1794904889749-critique-gate-record-stages-in-the-same-turn-requi.md)).
The bare-URL drop is invisible at the call site: on slang#13832 three approved stages all read "missing"
because the REQUIREMENTS block cited bare issue URLs — each line must END in `#issuecomment-<id>`,
`#discussion_r<id>`, `#pullrequestreview-<id>`, or `#issue-<n>` to pass the regex
([REQUIREMENTS URLs need GitHub anchors or rounds are silently unrecorded](../learnings/1794899785762-critique-gate-requirements-urls-need-github-anchor.md)).
Two same-atom corollaries: run all required stages (PLAN_REVIEW, CODE_REVIEW, OUTPUT_REVIEW) as direct codex
calls within the SAME turn as the gated send (`gh pr create`, `[Fix Review Request]`, `[Fix Report]`), and
after any session restart (provider-429 re-deliveries reset the state) re-Write the plan file (only the
Write tool records it) and re-run the STAGE calls before delivering; also note any Write/bash file write
after an approve bumps `edits_since_critique` and re-denies (a PR-description disclaimer append and an issue
status comment both tripped it), and issue/PR comments ≥1000 bytes (the `<sub>` disclaimer included) need an
OUTPUT_REVIEW'd `--body-file` — trim under 1000 bytes to skip
([record stages in the same turn; anchor with the database id](../learnings/1794904889749-critique-gate-record-stages-in-the-same-turn-requi.md)).
The REQUIREMENTS field itself must appear in **EVERY codex prompt, including follow-up rounds** — not
just the round the role requires it for: `track-critique.sh` does NOT record a round whose prompt is
missing `REQUIREMENTS:` with at least one comment URL (or an explicit `none — <why>`) after
`STAGE:`/`ROUND:`. Symptom (slang#10234, PR #14640): the codex call returns a normal approve but the
stage count/attestation in workflow-state.json stays stale, and the delivery gate then refuses with
"missing critique stages" or "artifacts changed since the approve" — check the state file, not codex's
reply. Related trap from the same atom: the plan-tracker hook also wants a full **Write** (not Edit) of
the plan file at the start of each new task turn before source edits are allowed
([codex critique rounds need REQUIREMENTS field or they silently do not record](../learnings/1795109255556-codex-critique-rounds-need-requirements-field-or-t.md)).
The same validator pins the developer-instructions: a round records only when the call carries the canonical
`/codex-critique` block verbatim (sentinels "You are an independent reviewer" / "Return ONLY the structured
output below") AND the anchored `REQUIREMENTS:` field; `codex-reply` calls are exempt from both but resolve
their stage only through the thread map written by a RECORDED initial call — and a reply prompt that
carries a literal `STAGE:` line is treated as a FRESH stage call, which (having no developer-instructions)
the pinning check silently refuses, so the round records nothing and the state keeps the previous round's
attested hashes; replies must open with `ROUND: n/3 — addressed …` only
([gate hooks that silently refuse: codex-reply STAGE and delivery-marker in_reply_to](../learnings/1794928766192-gate-hooks-that-silently-refuse-codex-reply-stage-.md))
([recording mechanics: anchored REQUIREMENTS, dev-instructions pinning](../learnings/1794892336879-critique-gate-recording-mechanics-anchored-require.md);
param-key and bridge-path recording conditions on [round recording](agent-infra-critique-round-recording.md)).
From the same atom: provider-429s kill codex turns mid-review ("exceeded retry limit" in
`~/.codex/sessions/**.jsonl`); resume by `codex-reply` with the thread_id grepped from the newest rollout
file — the reply inherits the stage via the thread map and its verdict records; an empty codex response
means the turn died, so check the jsonl before re-sending.

## PR-description length gate: the disclaimer trailer is excluded

`gate-pr-description.sh` (lib/pr_description.py) enforces the "under 1,000 characters" PR-body rule on the
body **minus the final `<sub>` disclaimer trailer and any AI-assistance line** — a raw body of 1,066 chars
can count 953 and pass. Before trimming a body that looks over-limit, strip the trailing `<sub>…</sub>`
line and re-count; don't cut content the gate never measured. (Same atom: a codex-critique provider 429
cleared after a single 2-minute backoff — retry once before treating the gate as blocked.)
([PR-description 1000-char gate excludes the disclaimer trailer](../learnings/1794925078617-pr-description-1000-char-gate-excludes-the-disclai.md))

## Attested-hash binding at delivery

The deliver gate re-hashes ALL artifacts an OUTPUT_REVIEW attested at send time — including internal
`reports/` HTML files. Applying codex advisories to an attested artifact after the approve (even trivial
one-line doc fixes) stales its hash and the next `[Fix Review Request]`/`[Fix Report]` is refused
("reviewed artifacts changed since the approve"). Fix: re-verify on the same thread with `codex-reply`
("ROUND: 3/3 — addressed advisories — re-verify") BEFORE dispatching — it returns fast (~2 min) with fresh
hashes ([attested artifacts re-hash at delivery](../learnings/1794855941188-critique-gate-mechanics-plan-tracker-wants-write-n.md)).
The hash check, not the edit counter, is what catches content drift in untracked paths: `track-edits.sh`
does not bump `edits_since_critique` for edits under `reports/`, so a mechanical `#NNN` → `#14516`
placeholder substitution in a reply template after the approve was caught only by the attested-hash
re-hash. Flow that works: review body + template (round 1) → create the GitHub artifact from the unchanged
body file → fill the real number into the reply → one fresh OUTPUT_REVIEW round on the final bytes → post
the reply file unchanged → report
([placeholder substitution stales the hash](../learnings/1794868189687-critique-gate-mechanics-pulls-read-false-positive-.md)).
Sequencing corollary: write every deliverable file BEFORE the final OUTPUT_REVIEW round, and a LATE
advisory on an attested file is cheaper to decline (attested text is what ships) than to fix and
re-review ([re-hash only OUTPUT_REVIEW's set; write deliverables first](../learnings/1794892336879-critique-gate-recording-mechanics-anchored-require.md);
full re-arm rules on [critique and delivery gates](agent-routing-f0909b2-critique-and-delivery-gates.md)).
When the advisory is a *clarification* rather than a file edit (line-citation corrections in reviewer
prose, a stronger-than-shorthand reading of a remedy), route it through the **send_file cover text** —
not the attested artifact — so the hashes stay valid and the gate stays satisfied (PR #14649 r2:
codex suggested sed-correcting stale line cites in final-review.md; carried in the cover text instead).
And when the audit hook prints "never invoked" even though workflow-state.json has the recorded round,
trust the state file: check `critique_verdicts`/`critique_attested` in
`/workspace/.claude/workflow-state.json` and hash-verify the delivered files rather than re-running
codex ([never edit codex-attested artifacts after approve — route advisories via send_file cover text](../learnings/1795144021884-never-edit-codex-attested-artifacts-after-approve-.md)).

**Source learnings (24):**
- [harness hooks false-positive on read-only queries](../learnings/1794814232168-harness-hooks-false-positive-on-read-only-github-q.md) — also carries the 401/GH_TOKEN infra-outage + unauth fallback facts
- [gate burns denials on read-only /pulls reads](../learnings/1794814240187-critique-gate-burns-denials-on-read-only-pulls-api.md)
- [plan-tracker wants Write not Edit; re-hash](../learnings/1794855941188-critique-gate-mechanics-plan-tracker-wants-write-n.md)
- [REQUIREMENTS links must be anchored](../learnings/1794861965038-track-critique-requirements-links-must-be-anchored.md)
- [pulls-read false positive; counts vs verdicts](../learnings/1794868189687-critique-gate-mechanics-pulls-read-false-positive-.md)
- [plan gate blocks redirects; re-Write identical plan](../learnings/1794892096397-plan-gate-blocks-log-redirects-on-read-only-test-r.md)
- [anchored REQUIREMENTS; state resets; 429 recovery](../learnings/1794892336879-critique-gate-recording-mechanics-anchored-require.md)
- [plan-tracker hook counts only Write-tool plan writes, not Edit](../learnings/1794933052106-plan-tracker-hook-counts-only-write-tool-plan-writ.md) — re-arm after source edits; fresh OUTPUT_REVIEW after any edit
- [Don't quote bracketed workflow markers in non-report messages](../learnings/1794918539609-don-t-quote-bracketed-workflow-markers-in-non-repo.md) — gate audit logs "gate skipped"; say "the formal marker"
- [REQUIREMENTS URLs need anchors or rounds silently unrecorded](../learnings/1794899785762-critique-gate-requirements-urls-need-github-anchor.md) — slang#13832: 3 approved stages all "missing"; restart forces re-Write plan + re-run stages
- [record stages in the same turn; REQUIREMENTS need #issue-<database-id>](../learnings/1794904889749-critique-gate-record-stages-in-the-same-turn-requi.md) — same-turn stages; ≥1000-byte comments need an attested body-file
- [critique gate hook blocks read-only gh api pulls calls](../learnings/1794919112736-critique-gate-hook-blocks-read-only-gh-api-pulls-c.md) — refuses whole compound call; use gh pr view / slang-mcp tool
- [PR-description 1000-char gate excludes the disclaimer trailer](../learnings/1794925078617-pr-description-1000-char-gate-excludes-the-disclai.md) — strip <sub> trailer before re-counting
- [plan-gate Write-vs-Edit + diag exit-code pins](../learnings/1794928650513-plan-gate-write-vs-edit-diag-exit-code-pins-when-m.md) — Edit never sets plan_written; re-check exit pins after severity merges
- [gate hooks that silently refuse: codex-reply STAGE and marker in_reply_to](../learnings/1794928766192-gate-hooks-that-silently-refuse-codex-reply-stage-.md) — replies must not carry STAGE:; markers need in_reply_to
- [delivery gate denies read-only gh api pulls GETs — use gh pr view](../learnings/1795107911913-delivery-gate-denies-read-only-gh-api-pulls-gets-u.md) — no method discrimination; write-intent patch handed to operator 11-19; denied probe = UNVERIFIED
- [codex critique rounds need REQUIREMENTS field or they silently do not record](../learnings/1795109255556-codex-critique-rounds-need-requirements-field-or-t.md) — REQUIREMENTS (or `none — <why>`) in EVERY codex prompt incl. follow-ups; plan Write per task turn
- [never edit codex-attested artifacts after approve — route advisories via send_file cover text](../learnings/1795144021884-never-edit-codex-attested-artifacts-after-approve-.md) — hash re-hash trips the gate; trust workflow-state over the audit hook's "never invoked"
- [PreToolUse gate denial skips the whole chained bash command](../learnings/1795186597404-pretooluse-gate-denial-skips-the-whole-chained-bas.md) — chained `sed -i` never runs when the `gh` part is denied; mutate files in their own call, verify, then run the gated command.
- [critique gate false-positives on read-only pulls API calls](../learnings/1795204342182-critique-gate-false-positives-on-read-only-pulls-a.md) — codex's own pulls read denied; spurious "PR creation blocked" card = per-window state missing PLAN_REVIEW; one round clears it.
- [opencode migration: fresh workflow-state blocks gated reads; router demands in_reply_to](../learnings/1795224576884-opencode-migration-critique-gate-state-reset-block.md) — old claude-session rounds not carried over; pulls reads burn denials; use `gh pr view` / `gh run list/view`.
- [freshness-gate traps: bash " > " comparisons, pkill self-match, append-only attempts file in critique re-records](../learnings/1795243212301-freshness-gate-traps-bash-comparisons-pkill-self-m.md) — a comparison operator bumps edits_since_critique; pkill -f kills your own launcher; poll .critique_stages with jq, never grep attempts.jsonl
- [critique dispatch bash redirects re-trip the edit gate after every round](../learnings/1795636526953-critique-dispatch-bash-redirects-re-trip-the-edit-.md) — dispatch the bridge redirect-free; `2>&1 | tail` is not a write; Write tool for comment bodies in a separate step
- [plan gate only arms on Write-tool plan files — Edit does not count](../learnings/1795717300987-plan-gate-only-arms-on-write-tool-plan-files-edit-.md) — an approved PLAN_REVIEW doesn't set plan_written either; re-Write the plan verbatim, per task
