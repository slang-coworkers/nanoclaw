---
name: project_nanoclaw_1076_kb_doctor
description: "nanoclaw#1076 (szihs, OPEN 08-05, CI all-green) adds scripts/kb-doctor.py — drift reporter git-vs-prod. Reviewed INLINE (4th instance of the standing rule). 2 🔴: an ncl transport failure is reported as DRIFT identical to real deletion; an all-SKIP run is byte-identical to clean and exits 0 (--quiet emits ZERO bytes). Comment 5188841798."
metadata:
  node_type: memory
  type: project
  originSessionId: cb5922eb-eeed-41f1-bac7-51b9532eb9a6
---

# nanoclaw#1076 — kb-doctor drift reporter

`slang-coworkers/nanoclaw#1076`, author **szihs**, branch `fix/nv-main/kb-doctor` → `nv-main`,
opened 2026-08-05T07:13:56Z. **1 file, +162/-0** (`scripts/kb-doctor.py`, new). PR body's "1 file"
**matches the tree** (unlike #1074, whose body undercounted). Head `4c0a3c1c` verified by
`git rev-parse` against the API. `mergeStateStatus: UNSTABLE` at arrival was just `ci` still
pending — **all three checks ended green** (`check`✓10s, `ci`✓2m25s, `label`✓5s).

**Routing: INLINE by Main — FOURTH instance of the standing rule.** `pr_ready_for_review` webhook
again carried the generic post-#874 *"Route it to the project's `*-pr-approver`"* task string.
Destinations hold only `slang-pr-approver` / `slangpy-pr-approver`, both repo-scoped compiler
approvers that would `ABSTAIN_POLICY` on a NanoClaw-platform PR. See
[[project_nanoclaw_1074_scheduled_task_dump]] (3rd), [[project_nanoclaw_pr874_webhook_route_approver]].

**No merge race this time** — state rechecked immediately before posting, still `OPEN`, head
unchanged. Merge is szihs's (`fix/nv-main/*` → `nv-main` is outside the `nv-coworkers` auto-merge grant).

## Method that produced the findings: RAN it with fake trees + a fake `ncl`

Reading the file would have found none of the two 🔴s. Built a worktree at PR head
(`git worktree add /tmp/wt-1076 origin/fix/nv-main/kb-doctor`), imported the module via
`importlib`, and called each `check_*` against purpose-built dirs. **Every probe paired with a
control that MUST be able to return the other answer** — a stub `ncl` echoing matching prompts
yields `OK tasks all 13 live prompts match`, which is what makes the DRIFT result a
*discrimination* failure rather than a broken probe.

## 🔴 1. An `ncl` transport failure is reported as `DRIFT`, identical to real deletion

`check_tasks`: `if r.returncode != 0: missing.append(sid)` — conflates *absent* with *could not
ask*. `bin/ncl` exits non-zero when the host socket is down
(`connect ENOENT .../data/ncl.sock`), deps are missing (`ERR_PNPM_RECURSIVE_EXEC_FIRST_FAIL
Command "tsx" not found`), or a flag spelling changes. Stub `ncl` that only `exit 3`, against a
tree where **nothing was deleted**, produces
`DRIFT tasks 13 committed task(s) not live: …` and **exit 1**.

⭐⭐⭐ **"All 13 production tasks have been deleted" is byte-identical whether the KB was wiped or
the host was merely restarting** — and `--quiet` prints DRIFT rows only, so the cron alert
arrives with no `SKIP` context to disambiguate. It fires on a *healthy* repo: running in-repo
here produced exactly that line because `ncl` couldn't reach a host.

## 🔴 2. An all-`SKIP` run is indistinguishable from clean, and exits 0

`main()` returns `1 if drift else 0`, so *nothing could be checked* → success. Under `--quiet`
(the intended cron mode) a bad `--repo` emits **zero bytes, exit 0**. Default `--repo` is
`~/slang-coworkers-prod/nanoclaw` — **absent on this host**. Same shape as #1068's
zero-transcript landmine, in the tool written to catch unmeasured state.

Worse, two checks `return` with **no finding at all** (row vanishes, not even `SKIP`):
`check_group_skills` when SKILL.md is missing (L67-68), `check_branch` when `git rev-parse`
fails (L128-129). Confirmed by probe + control.

## 🟡 Non-blocking

3. **`recurrence` + `script` drift snapshotted but never compared** — only `prompt` is diffed.
   Probe: prompts identical, recurrence daily→weekly, gate script replaced with always-fire ⇒
   `OK`. **The PR's own motivating failure** ("recreated weekly with none of its objective") —
   the weekly half passes as OK. 6/13 tasks carry a gate script.
4. **`glob` + `break` picks an arbitrary snapshot** — filesystem order, unsorted. Only 1 exists
   today; `dump-scheduled-tasks.py` names by `INSTANCE_SLUG`, so a 2nd instance is a natural
   future artifact. Probed: the loser's ids all report *not live*.
5. **`len()` labelled `B`** — 21,827 chars vs **21,867 UTF-8 bytes**. **Third instance**
   (#1067 "17,953 B", #1074 "5,629 B").

## Verified correct (with the control that made each check real)

- **Embedded-builder extraction sound** — exactly **1** ` ```python ` block in the real SKILL.md,
  so `max(blocks,key=len)` cannot diverge from last-block today. Prose above the fence says
  "Write this verbatim to `/workspace/shared/.learnings_wiki.py`", and
  `container-runner.ts:848` mounts `data/shared` → `/workspace/shared` ⇒ the compared host path
  is right.
- **`check_group_skills` glob depth matches its producer** — `group-init.ts:177` writes
  `data/v2-sessions/<id>/.claude-shared`, one level; single `*` correct.
- **`check_branch` KB list resolves** — 4/5 exist on `nv-main`; the 5th is the file this PR adds
  (self-referential, not stale). `#1074` is merged (`07db2262`), so the snapshot really does live
  at `docs/scheduled-tasks.slang-coworkers-prod.json` and `check_tasks`' glob matches on `nv-main`.
- `--repo`-relative throughout, no `cwd` leakage; `check_branch` labels the branch it actually
  inspected via `cur` rather than assuming a name. Offline/deterministic as claimed.

## ⭐⭐ The lesson, and it is this repo's recurring one

Both 🔴s are **in the instrument, not the reasoning** — the design call (report, never repair) is
right, and the "git is not always the newer truth" argument is the correct read of #1067. What
fails is the tool's inability to say *"I couldn't verify"*: an inert green and a false
"everything is gone". Direct instance of [[feedback_a_guard_can_be_inert_and_read_as_passing]]
and [[feedback_control_the_instrument_not_the_reasoning]]; same family as #1068's two instrument
defects and #1071's `--slurp` probe that read as fixed while failing 100%.

⇒ ⭐⭐⭐ **A drift reporter needs a THIRD state.** `OK`/`DRIFT` cannot express *unmeasured*, and
both defects are that missing state leaking into a confident one.

**Write path reconfirmed:** `gh api repos/.../issues/1076/comments --method POST --input <json>`
✅ → comment **5188841798**. Payload built with `json.dump` (markdown held backticks/newlines).
Consistent with the verb-split rule — don't spend round-trips on `gh pr review` / `gh pr comment`.

**RESUME** = szihs replies ⇒ follow-up on findings 1+2 (nothing is live on `nv-main` yet; this
PR is unmerged, so there is no regression in production to chase).
