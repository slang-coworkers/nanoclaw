---
name: project_nanoclaw_1074_scheduled_task_dump
description: "nanoclaw#1074 (szihs, OPEN 08-05) adds scripts/dump-scheduled-tasks.py + a 13-task prod snapshot. Reviewed INLINE (no nanoclaw approver exists — 3rd instance of that standing rule). BLOCKER: nv-path-guard red because config-examples/ is in NO branch allowlist (unclassified, not misfiled) ⇒ remedy is an allowlist line, NOT the guard's suggested retarget."
metadata:
  node_type: memory
  type: project
  originSessionId: 34d27ebb-07f3-4624-ab77-b2d8aa2f1cea
---

# nanoclaw#1074 — scheduled-task dumper + prod snapshot

`slang-coworkers/nanoclaw#1074`, author **szihs** (human maintainer), branch
`fix/nv-main/scheduled-task-dump` → `nv-main`, opened 2026-08-05T06:2x. `mergeable_state: unstable`,
not a draft, **0 reviews**. **Reviewed TWICE as the PR moved:**

| head | scope | comment |
|---|---|---|
| `0662fe58` (3 commits) | 4 files | `5188457057` |
| **`a9e385878`** (5 commits) | **8 files** | **`5188628929`** ← current |

⭐⭐ **Both `synchronize` webhooks looked identical; the FIRST was a no-op (head unchanged) and the
SECOND moved head and doubled the scope.** Re-measure head on every one — a prior no-op is not
evidence about the next event. **Blocker was byte-identical at both heads** (same one path), and all
4 newly-touched paths were already allowlisted, so the recommendation never changed.

**Routing: handled INLINE by Main — THIRD instance of the standing rule.** The
`pr_ready_for_review` webhook again carried the generic post-#874 *"Route it to the project's
`*-pr-approver` coworker"* task string. Confirmed stale for this repo **live, not from memory**: my
destinations block lists only `slang-pr-approver` / `slangpy-pr-approver`, both repo-scoped
compiler approvers that would return `ABSTAIN_POLICY` on a NanoClaw-platform PR. See
[[project_nanoclaw_pr874_webhook_route_approver]] (#1050) and
[[project_nanoclaw_1067_footer_normalizer]] (#1067). **Three instances now — this is no longer a
single-case rule.**

## ⛔ The blocker, and why the guard's own suggested remedy is the WRONG one

`check` job 92227879278 step 5 (`nv-path-guard/check.py`) exits 1:
`config-examples/scheduled-tasks.slang-coworkers-prod.json` is outside `nv-main`'s allowlist.

Measured all four PR paths against `.github/nv-path-guard/nv-main.txt`: `scripts/**` (L9),
`docs/**` (L52), `container/skills/learnings-wiki/**` (L140) present; **`config-examples` absent.**

⭐⭐ **The discriminating check the guard message does not prompt you to run:** it offers three
branches — *update the allowlist* / *retarget the PR* / *open an issue* — and picking between them
requires knowing whether the path is **misfiled** or **unclassified**. Grepped the other three
branch allowlists (`nv-coworkers`, `nv-slang`, `nv-slangpy`): **0 hits each.** So the path is owned
by *nobody*, retargeting has no valid destination, and the allowlist line is the only coherent fix
(consistent with its existing "Top-level config / docs / tooling" block owning `package.json`,
`docs/**`, `.env.example`).
⇒ ⭐⭐ **A CI error message that enumerates remedies is not evidence about WHICH applies. The
enumeration is the hypothesis set; pick between them by measurement.**

## Verified (all held)

- Gap is real: `ncl tasks help list` shows only `--status/--group/--session/--all` — no export verb.
- Snapshot internally consistent: `task_count: 13` = 13 array entries = 13 `##` headings in the md.
- SKILL.md's cross-reference resolves: series `task-1782828347850-4m9u23` present, `0 6 * * *`.
- `VOLATILE` exclusion is honest — a live `tasks get --json` really returns `row_id`, `status`,
  `process_after`, `session_id`, so byte-identical reruns are structural, not aspirational.
- **PR body says 3 files; tree has 4.** `container/skills/learnings-wiki/SKILL.md` (+22/−4) landed
  in `0662fe58` *after* the body was written — and it is the best part of the PR (stops the skill
  re-registering the fold without its objective). ⭐ **A `synchronize` webhook arrived mid-review;
  re-checked head before continuing — it was unchanged, but the check is the point.**

## Non-blocking findings posted

1. **`series_ids` fallback table parser is dead code that would under-report if reached.** Both
   `ncl tasks list --json` and bare `ncl tasks list` return `{ok,data:[…]}` on this build, so
   `isinstance(out, dict)` always wins. Simulated the fallback on real table output anyway: 8/8 ids
   recovered today, but its `'-' in tok[0]` guard accepts any hyphenated token. Recommended deleting
   it and failing loudly.
2. **A mid-dump `get` failure degrades to a silent partial snapshot** — `WARN:` to stderr, `continue`,
   then writes a *lower* `task_count`. Under the proposed cron that commits as a diff showing tasks
   **removed** — indistinguishable from a real deletion, the exact failure the PR guards against.
   Recommended: non-zero exit and **no write**. (Ties to the 200-row silent cap —
   [[command_ncl_flags_and_caps]] — an absence from an `ncl` list is never self-evidently real.)
3. **Units, recurring:** "5,629 B" is `len()`; UTF-8 is 5,675. Same slip as #1067's "17,953 B".

## Second pass at `a9e385878` — new findings (comment `5188628929`)

Added `.gitignore`, 3× `container/workflows/*/WORKFLOW.md` (identical edit), + regenerated snapshot.

- ✅ **Wiki-path fix verified against the LIVE tree with a differential control.** Claim "links are
  relative to `/workspace/shared`": `wiki/concepts/<x>.md` resolves under `/workspace/shared/`,
  while the `wiki/`-relative reading `/workspace/shared/wiki/wiki/…` does NOT exist. Claim "index is
  a small catalog": 5,903 B / 93 lines. Both correct; the old `limit=100` guidance was really broken.
- ⚠️ **`limit=60` "to reach their `## TL;DR`" does not hold yet — only 5 of 49 concept pages have
  one.** Ran an **alternate-spelling control** (`summary`, `at a glance`, any heading level): only
  `## TL;DR`, 5 hits ⇒ real gap, not a matcher artifact. For the other 44, `limit=60` is a partial
  read that looks complete (largest page 236 KB). Forward-looking, so flagged not blocked.
- ⚠️ **The renumbering produced DUPLICATE step numbers — the [[feedback_order_by_action_never_by_step_number]]
  hazard, caught by enumerating rather than reading.** New step 4 pushed PART A to 5,6 while PART B
  still starts at 5 ⇒ two 5s and two 6s in one 6.2 KB agent-executed prompt, and PART B holds the
  irreversible steps (force-add, push, REST-merge). Pre-existing off-by-one, but latent until now.
  ⭐ **The rule fired from a store row, not from noticing — that is what the row is for.**
- ✅ **Cited page sizes accurate** (`review-pr-practices.md` 236 KB vs cited 237; approvers ~178 KB).
  But **21 of 49 pages exceed the 40 KB cap** while the run splits ≤2 ⇒ backlog persists for weeks;
  prioritization right, throughput likely too low.
- ✅ **The drift alarm demonstrated itself:** the snapshot's 1/1 diff *is* a real objective change
  surfaced for review — the PR's own thesis, on its own artifact.

## Safety audit — re-derived, and it produced a lesson

Body claimed *"Zero hits across nine classes"* on a **public** fork. Conclusion is correct (no token
values; every credential is `process.env.GH_TOKEN` or gateway-injected). But **my own first email
regex returned a false zero** on a bracketed local part, and the nine classes **omitted Discord
snowflakes** (6 committed: guild + 5 channel ids — identifiers, not secrets). Full write-up filed as
the second instance in [[feedback_a_positive_control_cannot_detect_an_incomplete_enumeration]].

## Write path — reconfirmed

`gh api repos/.../issues/1074/comments --method POST --input <json>` ✅ (`5188457057`). Consistent
with the verb-split finding in [[project_nanoclaw_1067_footer_normalizer]] — don't spend round-trips
on `gh pr review` / `gh pr comment` on this repo. Built the payload with `json.dump` rather than
`jq -Rs` (markdown contained backticks/newlines).

**Merge is szihs's** — `fix/nv-main/*` → `nv-main` is outside the `nv-coworkers` auto-merge grant.
