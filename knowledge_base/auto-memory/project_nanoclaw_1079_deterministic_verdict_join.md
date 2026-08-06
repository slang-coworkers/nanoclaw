---
name: project_nanoclaw_1079_deterministic_verdict_join
description: "slang-coworkers/nanoclaw#1079 host-side verdict stamp — reviewed POST-MERGE (5th szihs merge race); the PR's own 'harmless no-op' coexistence claim is FALSE on multi-revision PRs, reopening #1075's relocation defect through a new door"
metadata:
  node_type: memory
  type: project
  originSessionId: pr1079-deterministic-verdict-join
---

# nanoclaw#1079 — `fix(approval-ledger): stamp the human verdict host-side, not via an agent turn`

author **szihs**, base **`nv-main`**, head `02a5426952618a4166b3e8dc3a44e20678550795`,
3 files +183 −1. **MERGED `2026-08-05T08:25:31Z`, ~11 min after opening (08:14:15Z).**
Comment posted: [`5189680092`](https://github.com/slang-coworkers/nanoclaw/pull/1079#issuecomment-5189680092).

**ROUTING: inline by Main, NOT dispatched.** Webhook task string said "route to the project's
`*-pr-approver`" — standing rule OVERRODE it, same as #1050/#1051/#1071/#1072/#1075: nanoclaw is
the platform repo, no nanoclaw approver is wired, and a slang/slangpy COMPILER approver on a
nanoclaw PR is nonsensical. See [[project_nanoclaw_pr874_webhook_route_approver]].

## What the PR does (and gets right)

Moves the human-verdict join off an LLM turn: `notifyApproverOfTerminalPr` now calls
`recordHumanVerdict` directly (`webhook-github.ts:~801`) before waking anyone, and
`github-webhook-server.ts:~378` adds `head_sha` to the terminal payload. **`head_sha` is a genuine
fix** — without it the join always passed a *decided* sha, always matched exact, and `join_mode`
(added in #1075 as the over-credit tripwire) would have been dead on arrival.

## 🔴 The finding — "harmless no-op" is false on a multi-revision PR

PR body: the agent's own later `record_human_verdict` "becomes a harmless no-op returning `false`",
so both paths coexist with no flag day. **True only when the PR has ONE decision row.** With ≥2 it
writes, to the wrong row — this is [[project_nanoclaw_1075_ledger_join_hardening]]'s RELOCATION
defect reached through a new door: the host stamp now *guarantees* a first write, so a second event
always lands in the fall-through.

`res.changes === 0` stays overloaded — *"no such commit"* OR *"already stamped"* — and only the
first should fall through to `head_advanced`.

```
R0 WOULD_APPROVE @10:00 (superseded) , R1 BLOCK @12:00 (operative), merges at head YY
host stamp,  head_sha=YY   -> head_advanced:R1   R1=MERGED             correct
woken agent's MCP call     -> head_advanced:R0   R0=MERGED   <-- WRONG ROW
```

Damage is precisely the bias `join_mode` exists to detect: superseded `WOULD_APPROVE` recorded as
`MERGED`/`head_advanced` = agreement with a merge, on a revision the approver itself superseded
with `BLOCK`.

**THREE independent second-event triggers, none exotic:**
1. the woken agent calls the tool — `slang-pr-approver` SKILL.md (`nv-slang` branch, lines ~188-193)
   still instructs exactly this on `pr_merged`/`pr_closed`;
2. webhook redelivery — the `rowId` guard dedups the **wake** (`webhook-github.ts:~836`), and the
   stamp runs *before* it, unguarded;
3. close → reopen → merge — `reopened` hits the `action !== 'closed'` skip
   (`github-webhook-server.ts:352`), so two `closed` events arrive.

**Why CI is green: every `store.test.ts` fixture holds ONE decision row**, so the fall-through has
nowhere to land. Same shape as #1075 — assertion right, FIXTURE too small.
`does not overwrite on the EXACT path either` still passes under the bug. And the two NEW tests in
`webhook-github.test.ts` **mock `recordHumanVerdict` outright** ⇒ they pin the call ARGUMENTS, not
the join behaviour.

## The fix I proposed — and the two one-liners I rejected first

```diff
-        WHERE repo=? AND pr_number=? AND human_verdict IS NULL
+        WHERE repo=? AND pr_number=?
         ORDER BY datetime(decided_at) DESC, rowid DESC LIMIT 1
+  if (latest && latest.human !== null) return false;   // last call already scored
```

⭐⭐**Both narrower guards leave a hole, and only a case MATRIX found it:**
- guard "exact row exists but is stamped" → still relocates on **redelivery** and on
  **close→reopen→merge** (verdict sha differs ⇒ never reaches the guard);
- guard "this verdict already present for the PR" → still relocates on **close→reopen→merge**
  (the two verdicts differ).

Verified: patched the merged tree, **full suite `1339 passed`** incl. my 2-row regression test,
with first-verdict-wins and `datetime()` ordering intact. Unpatched, the same test fails on
`expect(second).toBe(false)` (returns `true`) against the REAL store, unmocked.

## 🟡 Verdict vocabulary — flagged, not a live bug

Host writes `'MERGED'`/`'CLOSED_UNMERGED'`; the MCP tool schema
(`container/agent-runner/src/mcp-tools/core.ts:621`), migration 929's column comment,
`funnel.ts:268`, and SKILL.md all say `APPROVED | CHANGES_REQUESTED | …`. **Checked the base tree
(`363031d`) with a positive control: NO production path wrote `'MERGED'` before this PR — only
`store.test.ts` fixtures did** ⇒ this PR promotes a test-only token into the ledger, while
historical prod rows carry `APPROVED`/`CHANGES_REQUESTED` (measured in container logs: 10×
APPROVED, 1× CHANGES_REQUESTED, 0× MERGED). Nothing branches on the value today.

## Merge-race count is now FIVE for szihs + `nv-main`

#1066 (−26s), #1068 (+104s), #1071 (mid-session), #1075 (+8.5min), **#1079 (+11min)**.
⇒ post-merge review remains the DEFAULT posture. Blob-hash check done: all **3** files at merged
`a5e5b48` byte-identical to reviewed head `02a5426`. CI at head: `label`/`check`/`ci` all success.

**RESUME** = szihs replies ⇒ follow-up PR for the relocation defect. Note #1075's relocation
finding was ALSO never fixed — #1079 makes it strictly easier to hit, so ONE follow-up closes both.

## Process notes worth keeping

- ⛔**`gh pr comment` failed `GraphQL: Resource not accessible by integration (addComment)`; the
  REST fallback `gh api repos/<r>/issues/<n>/comments --method POST --field body=…` SUCCEEDED**
  (comment `5189680092`, author `nv-slang-bot`). Same token. ⇒ a GraphQL permission denial is NOT
  evidence the bot cannot comment — retry REST before reporting a credential failure.
- ⚠️**A redelivery arrived after my clone dir was wiped, and my first re-verification `cd`'d into
  the deleted path — the grep printed nothing and I nearly read that as "token absent at base".**
  See [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].
- Debounce applied on the 2nd webhook: `head.sha` unchanged (`02a5426`), `merged_at` unchanged
  (`08:25:31Z`), 0 comments, 0 reviews ⇒ genuine redelivery. But the *review itself had never been
  posted*, so the correct action was to POST, not to drop. ⭐⭐**"Genuine redelivery" licenses
  dropping the RE-RUN, never skipping work that was never delivered — check whether the artifact
  exists before treating a duplicate trigger as a no-op.**
