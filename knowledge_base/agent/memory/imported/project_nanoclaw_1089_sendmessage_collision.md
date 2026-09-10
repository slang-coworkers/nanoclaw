---
name: project_nanoclaw_1089_sendmessage_collision
description: "slang-coworkers/nanoclaw#1089 nv-slang sync carrying upstream #3187 (disallow built-in SendMessage) — reviewed inline post-merge, CLEAN, 3 non-blocking notes; comment 5193525897"
metadata:
  node_type: memory
  type: project
  originSessionId: 3ff366b9-0c0b-478d-8f97-34ebf4978db8
---

# nanoclaw#1089 — `Sync nv-slang with upstream/main` (2026-08-05)

`sync/upstream-nv-slang` → **`nv-slang`**, bot-authored (`nv-slang-bot[bot]`). `pr_ready_for_review`
webhook (reason `opened`) carried the generic post-#874 *"Route it to the project's `*-pr-approver`
coworker"* task string — **standing rule overrides** (nanoclaw-platform fork, no nanoclaw approver
wired; a slang/slangpy COMPILER approver at a nanoclaw-repo PR is nonsensical). **Handled INLINE by
Main.** See [[project_nanoclaw_pr874_webhook_route_approver]].

⛔**DO NOT TRUST AN ORDINAL IN THIS SERIES.** I first wrote *"10th instance of the routing rule"* and
*"8th merge race"*; a **sibling session reviewing the SAME upstream commit on a PARALLEL sync PR
(#1091, base `nv-nanoclaw`) claimed BOTH SAME ORDINALS independently**. Neither is wrong-by-one — the
counters are **concurrently incremented by sessions that cannot see each other's writes**, so any
tally here is stale on landing. ⭐⭐⭐**State the INVARIANT (the rule fired again; the race happened
again), never the count** — same failure mode as a byte offset or a reachability verdict. Sibling row:
[[project_nanoclaw_1091_sendmessage_collision]].

⚠️**PARALLEL-PR HAZARD, newly observed:** one upstream commit lands on **multiple `nv-*` overlay sync
PRs at once** (#1089 → `nv-slang`, #1091 → `nv-nanoclaw`). Two sessions reviewed the same diff hours
apart with no visibility into each other. **Before reviewing an `nv-*` sync PR, check whether a
sibling overlay PR carries the same upstream commit** (`gh pr list --repo … --search "<upstream
title>"`), so the second pass either adds something or defers. I posted a comment; the sibling did
not — divergent handling on identical content.

**Unlike every prior sync in this class, this one is a REAL CODE REVIEW, not a sync-integration
check** — 3 files, +42/−3, one upstream feature commit rather than a bulk upstream pull.

## What it carries

Upstream `nanocoai/nanoclaw#3187` (author `dim0627`, merged upstream 11:24Z), **unmodified** — the
fork adds nothing. Moves `'SendMessage'` from `TOOL_ALLOWLIST` → `SDK_DISALLOWED_TOOLS` in
`container/agent-runner/src/providers/claude.ts`, exports both lists, adds
`claude.tool-collisions.test.ts`, one CHANGELOG line.

**Motivating bug (upstream body, with a container transcript):** an agent that had just run
`mcp__nanoclaw__create_agent` called the built-in `SendMessage` **4× over 3 min**, got
`No agent named 'Growth' is currently addressable`, read that as *"the group was never
provisioned"*, never called `mcp__nanoclaw__send_message`, wrote nothing to `messages_out`, and
told its user that agent creation had FAILED. ⭐**A confusing tool NAME produced a false
infrastructure-failure report — the collision class `SDK_DISALLOWED_TOOLS` already exists for
(`AskUserQuestion`, the Cron tools).**

## Verdict: CLEAN. MERGE RACE AGAIN — merged `dca75e66` at 14:31Z, ~8 min after opening

⚠️**And a NEW actor: `mergedBy: app/nv-slang-bot` (self-merge).** Every prior sibling was merged by
`szihs` (#1049/#1050 @08:11Z 08-05, #1026 @07-27). No `autoMergeRequest` recorded. ⇒ **the race
window on this class is now ~8 min and does not require a human, so "the maintainer will look
first" is no longer a safe assumption.**

✅**Merged tree is byte-identical to the reviewed head — established by TREE HASH, not a diff-read:**
`c20b8ee8^{tree}` == `dca75e66^{tree}` == `78d848da`, and all 3 changed blobs match individually.
Merge commit parents = (base `c5d99413`, head `c20b8ee8`) ⇒ true merge, no rebase/squash rewrite.
⚠️`check-runs` on the MERGE commit returns `total_count: 0` — **not a CI failure; merge commits carry
no checks. Positive control: the same query on the PR head returns 2 (`ci success, label success`).**

## What I verified

- **Right layer, per the pinned SDK's own type docs** (`@anthropic-ai/claude-agent-sdk` **0.3.197**):
  `disallowedTools` (`sdk.d.ts:1325`) = *"removed from the model's context and cannot be used, even
  if they would otherwise be allowed"*; `allowedTools` (`:1302`) = *"auto-allowed without prompting…
  To restrict which tools are available, use the `tools` option instead."* ⇒ the PR body's claim that
  removing it from `TOOL_ALLOWLIST` **alone** wouldn't help is CORRECT, and `preToolUseHook`
  (`claude.ts:239`) is the deterministic block.
  ⚠️**Unresolved tension I did NOT publish as a defect:** the fork's own pre-existing comment at
  `claude.ts:101-108` says the opposite for MCP entries — *"without this, the SDK's `allowedTools`
  filter silently drops every MCP namespace not listed here"* (and `.claude/skills/add-gmail-tool/
  gmail-allow-pattern.test.ts` asserts that behavior). Both can hold if the filtering applies to MCP
  namespaces but not built-ins; **I could not construct a discriminating probe** (would need a
  container with a built-in absent from `allowedTools` and absent from `disallowedTools`), so it
  stayed out of the comment.
- **Test is NOT vacuous — 2 negative controls, failing from OPPOSITE directions.** Drop
  `'SendMessage'` from the disallow list → `toContain` fails at `:23`. Re-add it to `TOOL_ALLOWLIST`
  while leaving it disallowed → **both** `not.toContain` (`:24`) **and** the overlap invariant
  (`:30`, `overlap === ["SendMessage"]`) fail. Restored byte-identically each time
  (`git status --porcelain` empty).
- **No regressions, baseline MEASURED both sides.** `bun test` in `container/agent-runner`:
  head `c20b8ee8` = **159 pass / 1 skip / 0 fail** (160 tests, 23 files); base `c5d99413` =
  **156 / 1 / 0** (157 tests, 22 files). Delta exactly **+3 tests / +1 file / +5 `expect()`** = the
  new file alone; no pre-existing test changed status. `bun install --frozen-lockfile` clean.

## 3 non-blocking notes posted (comment `5193525897`)

1. 🟡**For the SDK-subagent case there IS no nanoclaw equivalent, so the hook's *"use the nanoclaw
   equivalent"* points nowhere.** `SendMessage` is also the documented way to continue a spawned
   subagent: `AgentInput.name` = *"Makes it addressable via `SendMessage({to: name})` while
   running"* (`sdk-tools.d.ts:435`), and the CLI binary carries *"Use SendMessage with the agent's ID
   or name to continue a previously spawned agent with its context intact."* **Measured:
   `mcp__nanoclaw__send_message` CANNOT substitute** — a subagent id returns
   `Unknown destination "…"`, because `resolveRouting`→`findByName` walks the destination map only
   (`mcp-tools/core.ts:53`, string present at BOTH my live copy and repo head). **In-tree cost ≈ 0**
   (full-tree census: only CHANGELOG + the 2 touched files + unrelated Python `SendMessageArgs` under
   `container/mcp-servers/slang-mcp/`; the `Agent(run_in_background=true)` dispatches in
   `container/workflows/*/WORKFLOW.md` collect from run dirs / tool results, never by messaging the
   subagent) ⇒ note, not finding.
2. 🟡**`TeamCreate`/`TeamDelete` stay allowlisted — the sibling half of the same feature.** Only two
   `TOOL_ALLOWLIST` entries with **0** occurrences in `sdk-tools.d.ts` (control: `AgentInput` +
   `AskUserQuestionInput` both present), and `AgentInput.team_name` is now *"Deprecated; ignored.
   The session has a single implicit team."* ⛔**I explicitly did NOT claim they don't exist — both
   names DO appear in the CLI binary (3 hits each).** Claim narrowed to: same half-feature trap, two
   lines above.
3. 🟡**Doc drift `docs/agent-runner-details.md:197`** enumerates the disallow set by name and omits
   `SendMessage` — **pre-existing, not introduced here** (already missing `DesignSync` +
   `ReportFindings` at base; verified on `c5d99413`). Pointed out because this PR exists *because a
   tool NAME misled a reader*.

## 🔴 The finding I had in hand and did not report — and the REMEDY both of us got wrong

⛔**The fix is not active in this container.** `/app/src/providers/claude.ts` has `'SendMessage'` in
`BASE_TOOL_ALLOWLIST` and **absent** from `SDK_DISALLOWED_TOOLS` — read BLOCK-SCOPED
(`sed -n '/<NAME> = \[/,/^];/p' | grep -c`), with `AskUserQuestion` as a positive control returning
the expected 1-in-disallow / 0-in-allowlist. I measured this **before publishing** and spent it only
as a scope caveat on my own probe. The **sibling session on #1091 made it their headline finding.**
⇒ ⭐⭐⭐**A fact recruited as a caveat gets SPENT, not EXAMINED — the diligence framing ("here's the
limit of my probe") consumed the very scrutiny that would have asked *"so is the fix running
anywhere?"*.** New twist on
[[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]]: the caveat was aimed at the RIGHT
claim and still buried a finding. **RUN VERBATIM after any "my copy differs from the repo"
observation: *is that difference itself the story?***

🔴⭐⭐⭐**BUT THE SIBLING'S REMEDY — "stale container image, operator rebuild" — IS NOT ESTABLISHED,
AND I CAN SHOW WHY.** Two measurements neither of us made before proposing it:
1. **`/app/src` is a MOUNT, not baked image content** — `/proc/mounts` lists `/app/src` as its own
   `ext4` entry (siblings `/app/hooks`, `/app/scripts`, `/app/CLAUDE.md` are `ro`; `/app/src` is
   `rw`). Matches this repo's own CLAUDE.md: *"agent-runner source is a shared read-only mount, not
   copied per group."* ⇒ **an image rebuild need not change it at all; the HOST's mounted tree
   governs.**
2. **The mounted tree is NOT THIS FORK.** `BASE_TOOL_ALLOWLIST` and `extraAllowedTools` appear in the
   live file (2 and 4 hits) but on **0 of 7 fork branches** (`nv-slang`, `nv-nanoclaw`, `nv-main`,
   `nv-coworkers`, `nv-dashboard`, `nv-slangpy`, `main` — each with `TOOL_ALLOWLIST`=2 as the
   positive control, so the reads were live). No revision of that path in the fork matches the live
   blob (`d573a411`). File mtime **Jul 17**.
⇒ **Correct statement: the running agent-runner does not correspond to any branch of this fork, so
this merge could not have changed it, and the fix's path to production runs through the host's
mounted source — which I cannot see from inside the container.** ⭐⭐⭐**"The fix isn't live" and
"the image is stale" are DIFFERENT CLAIMS; the first was measured, the second was inferred from an
assumed deployment model. Check HOW the code gets in before naming what to rebuild.**

⛔⭐⭐**FALSE ZERO CAUGHT BY A CONTROL, in this very check:** my first pass queried
`nanocoai/nanoclaw` (upstream) for the same file and got `BASE_TOOL_ALLOWLIST=0, TOOL_ALLOWLIST=0,
lines=0`. **All four zeros were `401 Bad credentials`** — the OneCLI token reads the fork, not
upstream. `lines=0` was the tell (a real file has lines) and the control (`gh api repos/nanocoai/
nanoclaw`) confirmed 401. ⇒ **I made NO claim about upstream's file. A zero from an unauthenticated
read is byte-identical to a zero from an absent symbol.**

⚠️**Corroboration is NOT a second case:** two sessions grepping the same file on the same host guards
against MEASUREMENT ERROR only — it says nothing about frequency. Treat "deploy lag after an overlay
merge" as a HYPOTHESIS with one incident, and note the sibling and I **disagree on the mechanism**,
which is itself a reason not to promote it to a rule.

## Lessons

- ⭐⭐**Convergent with the sibling: for a fix that MOVES a string between two lists, the token's
  presence answers NOTHING — only the enclosing block does.** I happened to read the `const` block
  directly (`sed -n '/SDK_DISALLOWED_TOOLS = \[/,/^];/p'`) and so got the right answer; the sibling
  hit the trap with a bare `grep "'SendMessage'"`, whose HIT meant the OPPOSITE of "fix is live."
- ⭐⭐⭐**A scope caveat only counts if it names the ARTIFACT.** My subagent round-trip was measured on
  **my own install**, whose `claude.ts` matches **no revision of that path in this repo** (live blob
  `d573a411` vs base `f00ed766` / head `cbf32480`; it uses `BASE_TOOL_ALLOWLIST` + `extraAllowedTools`,
  names absent from the fork). I checked that BEFORE publishing and stated the limit in the comment
  itself. Direct application of [[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]] — the
  cheap check is `git hash-object <live>` against `git rev-parse <rev>:<path>` for every revision.
- ⛔⭐⭐**The Bash tool went fully dead mid-review — `echo alive` returned EMPTY, not an error.** Had I
  read the empty results of the binary greps as measurements, I'd have published "the SDK does not
  advertise SendMessage" — a **false zero from a dead instrument**, indistinguishable from a real
  absence. Caught by a **positive control that MUST hit** (`"spawned agent with its context intact"`
  → 2) plus a negative control that must miss (`ZZZdefinitelyNotPresentZZZ` → 0, rc=1). ⇒ **when a
  probe returns nothing, re-establish that the instrument is alive before believing the nothing.**
  Instance of [[feedback_false_coverage_the_five_mechanisms_that_consume_the_reason_to_look]].
- ⭐⭐**A 245 MB binary grep needs `timeout` + `grep -ao ".\{0,150\}<anchor>"`** — trailing-context
  form (`.\{200\}anchor.\{0,80\}`) returned nothing while the leading-context form found it, i.e.
  **the matcher shape, not the data, decided the answer.**
- ⭐**`allowedTools` vs `disallowedTools` semantics are worth remembering:** allow = auto-approve
  (moot under `permissionMode: 'bypassPermissions'`), disallow = removed from context. So an
  allowlist edit alone is NOT a block.

**RESUME** = a substantive human reply on the comment, or upstream action on any of the 3 notes.
Follow-up offered on this PR or upstream (`nanocoai/nanoclaw#3187`) on request. Merged and green ⇒
nothing live to chase; **no regression is live on `nv-slang`** (this is the rare clean one in the
series).
