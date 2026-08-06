---
name: project_nanoclaw_1088_sendmessage_collision
description: "slang-coworkers/nanoclaw#1088 (+#1086/87/89/90/91 batch) upstream sync disallowing built-in SendMessage — reviewed post-merge, CLEAN, premise reproduced live in-container"
metadata:
  node_type: memory
  type: project
  originSessionId: pr1088-webhook
---

**#1088 (2026-08-05)** — `Sync nv-dashboard with upstream/main` (`sync/upstream-nv-dashboard` →
`nv-dashboard`), bot-authored (`nv-slang-bot[bot]`, `sync-upstream.sh`), 3 files +42/−3.
Carries upstream `81b18a9f` (PR nanocoai#3187, `dim0627`): built-in **`SendMessage` moved from
`TOOL_ALLOWLIST` into `SDK_DISALLOWED_TOOLS`**, both lists **exported**, plus new
`claude.tool-collisions.test.ts`.

**Routing: NOT routed — reviewed INLINE by Main (10th instance of the standing rule).** The
`pr_ready_for_review` webhook carried the generic post-#874 *"Route it to the project's
`*-pr-approver` coworker (never a reviewer/fixer)"* task string. Standing rule overrides:
NanoClaw-platform fork, **no nanoclaw approver wired**; a slang/slangpy **compiler** approver at a
nanoclaw agent-runner PR is nonsensical. See [[project_nanoclaw_pr874_webhook_route_approver]] and
[[slang-nanoclaw-chains-index]].

**5-PR batch, all MERGED within ~3 min of each other** (#1087 14:28:29, **#1088 14:31:26**, #1089
14:31:29, #1090 14:31:31, #1091 14:31:34; #1086→`nv-main` merged first at 14:27:43). All five carry
the **identical** 3-file/+42/−3 diff. **Merge race #8 for this repo** — merged ~7.5 min after
opening, mid-review ⇒ post-merge posture confirmed again as the default here.

**Verdict: CLEAN, no findings.** Reviewed head `ee67360e`; **3/3 blobs byte-identical to the
`nv-dashboard` tip BY HASH** (CHANGELOG `3e094a0b`, claude.ts `cbf32480`, test `2945cbd0`).

**⭐⭐⭐ The lucky instrument: this container runs the PRE-FIX runner** (`/app/src/providers/claude.ts:74`
has `SendMessage` in `BASE_TOOL_ALLOWLIST`, and the live tree uses the *older* fork shape —
`BASE_TOOL_ALLOWLIST` + `parseAllowedMcpTools`, which exists on **no** remote branch). So I had the
colliding tool in my own hands and reproduced the bug rather than reading about it:
- **Negative control** — built-in `SendMessage` → a coworker name returned the PR body's string
  **verbatim**: `No agent named 'x' is currently addressable. Spawn a new one or use the agent ID.`
- **Positive control** — same built-in → an SDK in-session subagent id **delivered and round-tripped**
  (`CONTROL-REACHED`). ⇒ namespaces genuinely distinct; built-in genuinely cannot reach an agent group.

**Enforcement verified on BOTH legs (not merely declared):** `disallowedTools:` at `claude.ts:549`
(SDK-side context removal) **and** the `PreToolUse` hook at `:239`. Ran the hook's block branch with
controls — `SendMessage`/`AskUserQuestion` → `{decision:'block', stopReason:…}`, `Bash`/`Read` →
`{continue:true}`. **Not an inert guard** (the [[feedback_a_guard_can_be_inert_and_read_as_passing]]
check, run rather than assumed).

**The removal's real cost, enumerated not assumed.** `SendMessage` is the only way to resume a
**named** background SDK subagent, so this *does* drop a capability. At the synced head: **0** files
under `container/skills` / `container/workflows` / `src` reference `SendMessage`; **0** use
`subagent_type` or named-agent addressing (**positive control**: `mcp__nanoclaw__send_message` → 6
files, so the grep works). `container/workflows/slang-pr-review/WORKFLOW.md:63,81` uses
`Agent(run_in_background=true)` **without** `name:` and collects results from **run-directory files**,
never by messaging the agent ⇒ unaffected. Safe in this fork.

**Test is load-bearing and CI runs it.** Asserts both directions (`toContain` disallow /
`not.toContain` allowlist) + a no-overlap invariant — that's what makes the two new `export`s
purposeful. Executes in CI (`ci.yml:178`, `working-directory: container/agent-runner` → `bun test`);
ran it locally at the synced head: **3 pass / 0 fail**. `ci` ✓ (2m31s), `label` ✓.

🔴**MY OWN ERROR, corrected pre-post and published in the comment** — the reusable half is
[[feedback_a_branch_ref_is_not_a_commit_ref_after_merge]]: my 7-branch census by **branch name** ran
**after** the batch merged, so it showed `SendMessage` already disallowed **everywhere** ⇒ read as
*"no-op, nothing to review."* Anchoring to `baseRefOid` `2e0041fb` (blob `f00ed766`) showed the truth:
in the allowlist, absent from disallow, neither exported. ⭐⭐**7 agreeing fetches built on the same
defective key is ONE measurement repeated, not corroboration** — and it failed in the direction that
licenses stopping.

🟡**Non-blocking note posted (pre-existing, not this PR):** `TOOL_ALLOWLIST` carries `TeamCreate` /
`TeamDelete` with **0** references in the installed SDK `0.3.197` (`sdk.d.ts`, `sdk-tools.d.ts`,
`sdk.mjs`) — controls: `SendMessage`→2 type refs, `AskUserQuestion`→4. Inert, not harmful, but the
same name-drift class this PR cleans up.

**Comment `5193340245`** (`.../pull/1088#issuecomment-5193340245`), posted via the **verb-split write
path** — `gh api .../issues/1088/comments -X POST` (both `gh pr review` and `gh pr comment` are denied
on this repo). **One comment for the batch**: verified 0 existing comments on all of #1086–#1091
before posting (the #945/#947 double-post lesson).

**Merge was the bot's** (already landed; `nv-dashboard` outside the `nv-coworkers` auto-merge grant —
I did not and would not merge it). **RESUME** = nothing live to chase; re-open only if a substantive
human comment lands or a `synchronize` fires (then: re-fetch, re-diff, re-measure — never carry a
verdict across a push).
