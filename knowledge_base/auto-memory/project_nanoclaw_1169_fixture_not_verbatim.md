---
name: project_nanoclaw_1169_fixture_not_verbatim
description: "nanoclaw#1169 (szihs, nv-dashboard, OPEN) F05 kb-doctor artifact validation. Reviewed INLINE, comment 5237800293. Body verified by execution. 1 🟠: fixture labelled VERBATIM has findings[] hand-emptied — provable by counts-sum arithmetic. 3 🟡. TWO of my framings were refuted by adversaries and I had the refutation of one ON SCREEN already."
metadata:
  node_type: memory
  type: project
  originSessionId: 29108104-19da-446e-85bb-a01b2d15bc4d
---

# nanoclaw#1169 — "a drift report we cannot fully understand is unavailable, never zero (F05)"

PR https://github.com/slang-coworkers/nanoclaw/pull/1169, author **szihs**, base **`nv-dashboard`**,
head **`550a19a88`**, merge-base `c7d5752d2`, **5 files +473/−50**. `ci`+`label` pass,
`mergeStateStatus CLEAN`, 0 reviews / 0 comments at my post. My comment **`5237800293`**
(posted via `gh api -X POST .../issues/N/comments` — **`gh pr comment` returned
`GraphQL: Resource not accessible by integration (addComment)`**; the REST path works).

Direct follow-up to [[project_nanoclaw_1121_kb_doctor_artifact]]; closes both findings in
`PR_1121_CODE_REVIEW_2026-08-06.md`. Producer is `scripts/kb-doctor.py`, **`origin/nv-main` only**.

**Routing: INLINE by Main.** `pr_ready_for_review` carried the generic *"route to the project's
`*-pr-approver`"* string again; no nanoclaw approver is wired. Standing rule:
[[project_nanoclaw_pr874_webhook_route_approver]].

## Body verified BY EXECUTION

Both named route tests fail on base (head `server.test.ts` × base `server.ts`):
`expected 'no drift report' to match /unreadable/` + `expected true to be false`,
`2 failed | 2 passed`. 22/22 validator green. Producer really stamps `+00:00` — a `Z`-only regex
would reject every genuine artifact. ⭐**The body discloses that its own 22 validator tests cannot
fail pre-fix** — that disclosure is what made the rest cheap to trust.

## 🟠 The fixture labelled VERBATIM has `findings` emptied — arithmetic, not judgement

Producer builds counts *from* findings (`counts.{ok,drift,unknown} = len(rep.of(STATE))`,
`findings: rep.findings`, only 3 states ever passed to `add()`) ⇒
**`ok+drift+unknown == len(findings)` by construction.** Fixture: sum **4** beside `findings: []`.
Reproduced the exact counts `{ok:1,drift:0,unknown:3}` from the real producer (scratch repo with a
SKILL.md `python` block matching `data/shared/.learnings_wiki.py`, no git dir) → **4 findings**,
`unknown[0..1]` byte-identical. Two independent corroborations: producer writes `indent=1` with
`counts` expanded, fixture is indent-2 inline; and `unknown[2]` is truncated
(`fatal: not a git repository` vs `… (or any of the parent directories): .git`) — but **that leg is
a negative claim about MY git 2.39.5, so I published it as corroborating only**. Innocent
explanations all excluded: nothing rewrites the file, `scrub_kb_pii.py` is rooted at
`knowledge_base`, `format:fix` is `src/**` only, and prettier on real output keeps all 4 findings.
**Not test-invalidating** (validator never reads `findings`) — the cost is that the fixture
does not pin the shape it claims to pin.

## ⭐⭐⭐ TWO of my framings were REFUTED by adversarial passes — and one refutation was already on my screen

1. **"same class of false zero, one field over"** → overstated. `findings` is absent from
   `KbDoctorView`, so the API never emits it; census over 6 branches + head finds **no reader**, and
   `dashboard/public/` fetches `/api/funnel` + `/api/regression-quality` but **not** `/api/kb-health`.
   No false zero can reach a human through it. Downgraded to a fixture-integrity point.
2. **My proposed one-liner** (`ok+drift+unknown === findings.length`) **turns the PR's own suite
   `7 failed | 15 passed`** — the test helper's base doc is itself `counts{ok:4}` + `findings: []`,
   and the naive form throws on absent `findings`. ⭐⭐⭐**I HAD RUN THIS MYSELF and printed
   `7 failed | 15 passed` before drafting — then proposed the fix anyway.** Running an experiment is
   not reading it: a result that contradicts the fix you are about to recommend is invisible if you
   only scan for whether the *finding* reproduced.

## ⚠️ Two instrument errors of my own, both caught by control

- **I read the WRONG `ci.yml`.** For a `pull_request`, GitHub runs the **PR branch's** workflow
  (`f6686458`, same on `nv-dashboard`); I first read `origin/nv-main`'s `a02e21a` from a composed
  worktree — a confident answer about a file that never executes. Correct ordering in the executing
  file: merge (line 14, `if: github.base_ref != 'main'` ⇒ fires for a nv-dashboard base) → 
  `setup-python@v5` 3.11 (148) → `pnpm exec vitest run` (191), one job, one tree. ⇒ the body's
  "cross-branch import needed" blocker is **false in CI**; a live-producer test executes there, and
  mutating the stamp to `strftime` leaves the fixture test **green/blind** while the live test goes
  **red**.
- **`git worktree add <branch>` MOVED the `pr1169` ref.** My compose-merge advanced the branch
  pointer from `550a19a88` to `361690877`, so a later `git diff --stat` reported **503 files /
  +83782** instead of 5 files / +473. ⭐⭐**Caught by absurdity, not by a check** (503 files for a
  5-file PR). Recovered by proving every measured blob byte-identical to the real head
  (`fixture 0e3ed2c1`, `validator dd66d9a1`, `server.ts c5074765`) and re-running the load-bearing
  measurements after `git reset --hard`. ⇒ **use `git worktree add -d <sha>` (detached), never a
  branch name, and re-verify the ref after any worktree op.**

## Other 🟡 published

- `counts.ok` unvalidated (`-999` accepted); `findings`/`counts.ok` outside the net (see above).
- **`vitest run dashboard/` = 139 tests, 134 passed / 5 failed**, not the body's "114 passed".
  The 5 are **byte-identical at base** (`113 tests, 108 passed / 5 failed`) — export/import cases,
  not introduced — and CI is green because the composed tree supplies what they need.
- Prettier note **accurate** (`format:check` is `src/**/*.ts`; both files fail at base too; new
  files clean). `pnpm-lock.yaml` genuinely absent from the diff, as claimed.
- Deployment framing confirmed and **understating itself**: `kb-doctor.py` does not exist on
  `nv-dashboard` at all, so there is no producer on this branch to deploy alongside the consumer.

RESUME = szihs replies to `5237800293` ⇒ follow-up = regenerate the fixture verbatim (fixes label
*and* coverage), optionally add the live-producer test now that the stated blocker is disproved.

See also [[project_nanoclaw_1167_volatile_set_unknown]], [[project_nanoclaw_1166_deployed_closure_inert]],
[[project_nanoclaw_1080_kb_health_route]].
