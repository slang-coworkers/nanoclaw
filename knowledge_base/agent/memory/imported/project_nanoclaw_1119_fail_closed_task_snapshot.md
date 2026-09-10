---
name: project_nanoclaw_1119_fail_closed_task_snapshot
description: "nanoclaw#1119 (szihs) fail-closed dump-scheduled-tasks. MERGED 4min after opening — review is post-merge. CONFIRMED BY CONSTRUCTION: 'both files in one step' is false — commit() renames JSON first, so an md-rename failure leaves JSON replaced + exit 3 'Nothing was replaced'. Also session_id is non-VOLATILE but committed 13×."
metadata: 
  node_type: memory
  type: project
  originSessionId: 76bf8f33-f156-4aa2-a8bb-618680375b4f
---

# nanoclaw#1119 — fail-closed scheduled-task snapshot

`slang-coworkers/nanoclaw#1119`, author **szihs**, branch `fix/nv-main/fail-closed-task-snapshot`
→ `nv-main`. Head `c975544c0`. 3 files, +345/−36.

⛔ **MERGED AT 13:41:44Z — 4 minutes after opening (13:37:14Z), while I was still reviewing.**
Merge commit `49ed5a0ca`. So `nv-main` already contained all three PR files **byte-identical**
(blob shas `b1b6edfb578` / `af68c984b98` identical at both refs, confirmed via GitHub API at two
refs, not just locally). ⭐⭐ **`diff base..head` being EMPTY did not mean "no changes" — it meant
the base had moved past the PR.** The discriminating check is `merge-base --is-ancestor` plus
`.merged` on the API, not a diffstat.

**Routing: handled INLINE by Main — FOURTH instance of the standing rule.** The
`pr_ready_for_review` webhook again carried the generic *"Route it to the project's
`*-pr-approver`"* task string. Destinations hold only `slang-pr-approver` / `slangpy-pr-approver`,
both repo-scoped compiler approvers that return `ABSTAIN_POLICY` on a NanoClaw-platform PR.
See [[project_nanoclaw_1074_scheduled_task_dump]] (3rd), `#1050`, `#1067`.

## ⛔ Finding 1 — "both files in one step" is FALSE, and the error message actively misleads

PR body: *"renamed — **both files in one step**, so JSON and Markdown can never disagree."*
`commit()` loops `os.replace(tmp, dest)` over staged pairs **sequentially**. JSON is staged
first (`staged.append` order), so it renames first. If the md rename then fails, JSON is
**already replaced** — and the handler prints **"Nothing was replaced."** and returns 3.

⭐⭐ **Confirmed BY CONSTRUCTION, twice, with different mechanisms** — not by reading:

| construction | result |
|---|---|
| md dest replaced by a **directory** (`os.replace` onto a dir → `IsADirectoryError`) | exit 3, JSON **replaced** with the changed prompt (`grep -c "CHANGED PROMPT"` → 1), md stale |
| md's **parent dir chmod 0o500** between stage and commit (`PermissionError`) | `commit()` raised, JSON `task_count` **99** on disk, md still old header |

Both leave exactly the JSON/Markdown disagreement the PR claims is impossible, *and* the
staged-temp cleanup in `discard()` cannot undo an already-completed rename. Fix is a real
two-phase commit (stage all → rename all with rollback), or narrow the claim in body+docstring.

⭐⭐ **The test suite cannot catch this: all 6 cases fail BEFORE the commit phase** (get-fails,
list-fails, empty-list) or succeed wholly. There is no case where one rename fails and another
succeeds — the exact interleaving the strongest claim rests on is untested.

## ⚠️ Finding 2 — `session_id` is not in VOLATILE but is committed 13×

`VOLATILE` = `row_id, process_after, tries, completed_runs, failed_runs, recent_log, status,
created_at, origin_session_id, id, ok`. **`session_id` absent**, and the committed snapshot
carries 13 of them (`sess-1776713258088-orggk2`, …). `toOutput` sets `session_id: session.id`,
i.e. the *system session that runs the task* — runtime state by the file's own definition
(*"Definitions only — runtime state is excluded so a diff here means a task's instructions
changed"*). If a session is ever re-minted the dump churns and the drift alarm fires falsely.
⚠️ **Severity bounded honestly: I could NOT show churn.** `git log -- <the JSON>` returns
**zero commits** (the snapshot has no history to inspect), and the test stub never emits
`session_id` (`grep -c` → 0), so no evidence either way. Reported as a latent gap, not a bug.

## ✅ Verified — and one candidate REFUTED before filing

- **Prompt truncation — REFUTED.** `toOutput` truncates at 120 chars
  (`slice(0, 117) + '...'`), which would make the JSON a corrupt "restore source". But
  `getTask` **overrides** with `prompt: content.prompt` (full). Confirmed empirically:
  committed prompts run 43 → **6,227** chars, and **zero** are exactly-120-with-ellipsis.
  ⭐⭐ **A truncation at the shared helper is not a truncation at the verb — read the override
  before filing.** This would have been a false high-severity finding.
- **Markdown regenerated but header omitted.** Executed the new `render_md` against the
  committed JSON: output differs from the committed md by exactly **3 lines** — the new
  *"13 task(s), complete — the generator exits non-zero…"* header block is **absent** from the
  committed file. So the snapshot was hand-edited or produced pre-change; a regen will diff.
- **Trailing whitespace: real, 2 → 0.** Base `b2a5c24fe` had **2**, merge `49ed5a0ca` has **0**.
- **CI was green at head before merge** (`check`/`label`/`ci` all success, 13:39:43Z).
- **`compose` on nv-main flipped success → failure at this merge** — but **all 4 assertion
  failures are in `setup/nv-owned-drift.test.ts`, #1120's file, not #1119's**, and
  `scripts/dump-scheduled-tasks.test.ts` shows **✓ 6 tests** in that same composed run.
  ⭐⭐ **Attributing a red compose to the PR that merged next to it would have been wrong;
  the per-file log line is the discriminator.**
- Body's *"#1119, the path-guard verifier"* is a **self-reference typo** — the PR-mate is
  **#1120** (`owned-drift verifier: fail closed`, merged).

## ⛔ Instrument defects hit during THIS review (both produced wrong numbers first)

1. ⭐⭐⭐ **`grep -cE '[ \t]+$'` counts lines ending in the letter `t`** — BRE/ERE does not
   interpret `\t`. It reported **15** trailing-whitespace lines in a file that has **0**;
   the "offenders" were lines ending in `daily-report`, `--argjson wf "$wf" \`, etc.
   `grep -P` is required. ✅ **Control that catches it in one line:**
   `printf 'abct\nxx \n' | grep -cP '[ \t]+$'` must print **1**, not 2.
   ⇒ *A whitespace regex needs a positive AND a negative control, because its false positives
   look exactly like findings.*
2. ⭐⭐ **`git fetch` clobbers `FETCH_HEAD`** — my second fetch overwrote the first, so base
   and head resolved to the **same** blob and both "219 lines / identical md5". Nearly
   concluded the PR was a no-op for the wrong reason. Fetch into **named refs**
   (`origin/nv-main:nv_main_1119`) and `rev-parse` each.
3. Recurring: **`cd X && git …` — cwd resets between Bash calls**, so ref ops silently ran
   outside the clone and diffed an unrelated tree. Use `git -C $R` always.
   ([[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]])

**Not cron-wired**: no reference under `.github/` or `launchd/`; the only consumers are
`kb-doctor.py` and `learnings-wiki/SKILL.md`. So the PR body's *"this script is cron-driven"*
describes intent, not current wiring.

**Merge was szihs's own** — `fix/nv-main/*` → `nv-main` is outside the `nv-coworkers` grant.
Write path for comments: `gh api repos/.../issues/1119/comments --method POST --input <json>`
(see [[project_nanoclaw_1067_footer_normalizer]] — don't spend round-trips on `gh pr review`).
