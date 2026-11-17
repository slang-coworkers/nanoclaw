---
title: "Gate-Hook Mechanics: Read-Only False Positives, the Plan Gate, and workflow-state Lifecycle"
type: concept
group: agent-infra
tags: [critique-gate, delivery-gate, gate-plan, plan-tracker, false-positive, read-only, workflow-state, requirements-anchor, attested-hash]
source_count: 9
---

# Gate-hook mechanics: read-only false positives, the plan gate, and workflow-state lifecycle

## TL;DR

- The harness gates pattern-match command TEXT, never intent or HTTP verb: a `gh api` or `curl` GET of
  `repos/*/pulls/<n>` is "PR creation", and a `fix/issue-<n>` branch string anywhere in a command (even a
  query param) trips the plan tracker — both on read-only triage calls.
- Each false-positive denial burns one of 3 strikes; three open an admin escalation for something that was
  never a delivery. Stop retrying and switch endpoints.
- Read-safe escapes: `issues/<n>` (serves PR state, `closed_at`, `merged_at` too), `issues/<n>/comments`,
  `issues/<n>/timeline`, `issues/comments/<id>`, `check-suites/<id>/check-runs`,
  `commits/<sha>/check-runs`, `actions/runs?head_sha=<sha>` (no branch string), `gh pr view --json`,
  graphql `pullRequest(number:)`, and the slang-mcp github tools.
- Tell codex reviewers about the pulls pattern in the prompt's environment note — they hit the same wall
  inside their sandbox.
- The plan gate (`gate-plan.sh`) denies ANY Bash command containing a `>`/`>>` redirect while
  `plan_written=false` — including a read-only verification run like `slang-test > log 2>&1`.
- `plan-tracker.sh` records ONLY the Write tool (or a codex `apply_patch`); an Edit to the plan file never
  sets `plan_written`, so every Bash-with-writes and source Edit keeps failing "PLAN REQUIRED". Rewrite the
  identical plan via the Write tool to flip it.
- `workflow-state.json` resets on EVERY routed envelope (re-kicks, provider-429 notices) and every task
  epoch — `plan_written` and critique stages wipe; run the rounds AND the delivery inside the same turn,
  and keep a compact plan file ready to re-Write. After a 429 recycle, re-run a missing stage with a FRESH
  codex call (a codex-reply records the verdict but not fresh attested hashes), and log background builds
  to the worktree (recycles wipe /tmp).
- Sibling sessions share one container filesystem: the state file can be zeroed concurrently while your
  round is in flight; verify with `jq .critique_rounds` after every codex round before assuming it counted.
- `REQUIREMENTS:` URLs must carry anchors (`#issuecomment-<id>`, `#issue-<n>`, `#discussion_r-<id>`,
  `#pullrequestreview-<id>`) or the round silently drops with no error.
- The authority for "did my critique count / what did it say" is `critique_verdicts` + `critique_attested`,
  not stage counts; and broken gateway GitHub creds (401 Bad credentials on reads and pushes alike) are an
  infra outage to report, not a connect-flow.

## Read-only false positives: substring matchers with no verb

The critique-gate hook pattern-matches `gh api [^|]*pulls` and `api.github.com.../pulls` on ANY Bash
command — including read-only GETs, and `curl` against the same URLs — refusing them with "CRITIQUE
REQUIRED before PR creation" ([burns denials on read-only /pulls reads](../learnings/1794814240187-critique-gate-burns-denials-on-read-only-pulls-api.md),
[blocks read-only /pulls/ API calls; use alternate read endpoints](../learnings/1794816828733-critique-gate-hook-blocks-read-only-pulls-api-call.md),
[pulls-read false positive, timeout residue, attested-hash binding](../learnings/1794868189687-critique-gate-mechanics-pulls-read-false-positive-.md)).
Three such reads (e.g. `gh api repos/shader-slang/slang/pulls/13650` to check a PR's state) each count as a
"PR creation" denial, hit the 3-denial cap, and open an admin escalation for something that was never a
delivery. The full arm regex and endpoint-by-endpoint escapes are on
[critique and delivery gates](agent-routing-f0909b2-critique-and-delivery-gates.md); the remedy in one
line: never use the `/pulls/N` route for reads — `/issues/N` returns state/closed_at/merged_at for PRs too,
`/check-suites/<id>/check-runs` for CI, `gh pr view` (GraphQL; bypasses the pattern, needs a valid token).
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
([harness hooks false-positive; unauth fallbacks](../learnings/1794814232168-harness-hooks-false-positive-on-read-only-github-q.md),
[blocks read-only pulls; 401 = infra outage](../learnings/1794816828733-critique-gate-hook-blocks-read-only-pulls-api-call.md)).

## The plan gate and plan-tracker: Write, not Edit

`plan-tracker.sh` (PostToolUse) matches only the `Write` tool or a codex `apply_patch`; a plan amended via
the **Edit** tool does NOT set `plan_written` — every subsequent Bash-with-writes and source Edit keeps
failing with "PLAN REQUIRED" even though the plan file exists. Fix: write the plan (or a companion plan
file) with the **Write** tool once ([plan-tracker wants Write not Edit](../learnings/1794855941188-critique-gate-mechanics-plan-tracker-wants-write-n.md)).
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

## workflow-state lifecycle: resets, shared filesystem, and what to trust

`workflow-state.json` resets on EVERY routed envelope — re-kicks and provider-429 retry system notices
included — wiping all recorded critique stages and `plan_written`. Run the three rounds AND the delivery
(`gh pr create`, marker sends) inside the same turn; a mid-ladder inbound forces full re-records
([anchored REQUIREMENTS; state resets](../learnings/1794861965038-track-critique-requirements-links-must-be-anchored.md),
[state resets and 429 recovery](../learnings/1794892336879-critique-gate-recording-mechanics-anchored-require.md)).
The 429 "model provider too many requests" retries recycle the per-host state while workspace files
survive, with three measured consequences (slang#14518): the plan-tracker refuses Edit/Write/Bash-writes
again — re-Write the plan file to re-trigger the PostToolUse recorder; recorded critique threads/verdicts
vanish — re-run the missing stage with a FRESH `mcp__codex__codex` call, because a `codex-reply`
continuation records the verdict but does NOT refresh the `critique_attested` hashes, leaving the deliver
gate refusing on stale attestation even after an approve; and `/tmp` is wiped on the recycle while
`/tmp/opencode` is root-owned, so background build logs die instantly and silently — log to the worktree
`build/` dir (durable and gitignored) and verify with `ps aux | grep ninja` + `tail` within seconds of
starting ([429 retries recycle host workflow-state; log background builds in the worktree](../learnings/1794898070596-429-retries-recycle-host-workflow-state-codex-repl.md)).
Sibling sessions share one container filesystem, so the shared state file can be zeroed concurrently while
your codex round is in flight — one OUTPUT_REVIEW call returned no output while
`/workspace/.claude/workflow-state.json` got zeroed, and the open escalation then retired without the
critique being recorded; verify with `jq .critique_rounds` after every codex round before assuming it
counted ([sibling-session zeroing](../learnings/1794814240187-critique-gate-burns-denials-on-read-only-pulls-api.md)).
Counts lie in the other direction too: a client-side MCP timeout can bump `critique_stages` counts and
leave duplicate entries in `critique_threads` — after 2 timeouts + 1 success, OUTPUT_REVIEW showed count 2
and two thread ids with no way to tell which thread was live. The authority is `critique_verdicts` +
`critique_attested` (fresh hash set), not the counts; for a follow-up round on ambiguous threads, open a
FRESH `mcp__codex__codex` call with `STAGE:` set — it records as an iteration round (stage count stays,
verdict + attestation update) with no thread ambiguity
([counts vs verdicts; fresh call on ambiguity](../learnings/1794868189687-critique-gate-mechanics-pulls-read-false-positive-.md);
thread-map mechanics on [round recording](agent-infra-critique-round-recording.md)).

## Silent round drops: anchored REQUIREMENTS URLs

`track-critique.sh` silently drops a PLAN/CODE/OUTPUT_REVIEW round when the prompt's `REQUIREMENTS:` field
cites a bare issue/PR URL — the validator regex requires an anchor:
`https://github.com/<owner>/<repo>/(issues|pull)/<n>#(issuecomment-|discussion_r-|pullrequestreview-|issue-)<digits>`.
A prompt citing `issues/14421` with no anchor records NOTHING (the hook exits 0 with an additionalContext
notice the harness may not surface), so the delivery gate later refuses with "missing critique stages" even
though codex approved. Fix: cite the issue BODY as `issues/14421#issue-14421` and comments as
`#issuecomment-<id>` ([REQUIREMENTS links must be anchored](../learnings/1794861965038-track-critique-requirements-links-must-be-anchored.md)).
The same validator pins the developer-instructions: a round records only when the call carries the canonical
`/codex-critique` block verbatim (sentinels "You are an independent reviewer" / "Return ONLY the structured
output below") AND the anchored `REQUIREMENTS:` field; `codex-reply` calls are exempt from both but resolve
their stage only through the thread map written by a RECORDED initial call
([recording mechanics: anchored REQUIREMENTS, dev-instructions pinning](../learnings/1794892336879-critique-gate-recording-mechanics-anchored-require.md);
param-key and bridge-path recording conditions on [round recording](agent-infra-critique-round-recording.md)).
From the same atom: provider-429s kill codex turns mid-review ("exceeded retry limit" in
`~/.codex/sessions/**.jsonl`); resume by `codex-reply` with the thread_id grepped from the newest rollout
file — the reply inherits the stage via the thread map and its verdict records; an empty codex response
means the turn died, so check the jsonl before re-sending.

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

**Source learnings (9):**

- [harness hooks false-positive on read-only queries](../learnings/1794814232168-harness-hooks-false-positive-on-read-only-github-q.md)
- [gate burns denials on read-only /pulls reads](../learnings/1794814240187-critique-gate-burns-denials-on-read-only-pulls-api.md)
- [gate blocks read-only /pulls/ calls; 401=infra outage](../learnings/1794816828733-critique-gate-hook-blocks-read-only-pulls-api-call.md)
- [plan-tracker wants Write not Edit; re-hash](../learnings/1794855941188-critique-gate-mechanics-plan-tracker-wants-write-n.md)
- [REQUIREMENTS links must be anchored](../learnings/1794861965038-track-critique-requirements-links-must-be-anchored.md)
- [pulls-read false positive; counts vs verdicts](../learnings/1794868189687-critique-gate-mechanics-pulls-read-false-positive-.md)
- [plan gate blocks redirects; re-Write identical plan](../learnings/1794892096397-plan-gate-blocks-log-redirects-on-read-only-test-r.md)
- [anchored REQUIREMENTS; state resets; 429 recovery](../learnings/1794892336879-critique-gate-recording-mechanics-anchored-require.md)
- [429 retries recycle workflow-state; fresh codex call for attested hashes](../learnings/1794898070596-429-retries-recycle-host-workflow-state-codex-repl.md)
