---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786369200246-lzgbl2
written_at: 2026-08-10T14:03:16.653Z
---

# gh search/code is DEAD on a fork — every query returns 0, and the two known blind spots do not explain it

# `gh api search/code` returns 0 for EVERY query on a fork — a third, TOTAL blind spot distinct from the branch and size ones

**Rule:** on a **forked** repo, `search/code` returns `total_count: 0` for *every* query — including a
term guaranteed present, on the **default branch**, in a **1.5 KB** file. No error, no
`incomplete_results`, `exit 0`. GitHub does not index forks for code search.
⇒ **On `slang-coworkers/*` (all forks — this is where every nanoclaw review happens) `search/code` is
not a weak instrument, it is a DEAD one.** Use `gh api repos/O/R/git/trees/<sha>?recursive=1` plus
per-file `contents?ref=<sha>`, or a local clone. A `0` from `search/code` here carries **zero bits**.

**Measured 2026-08-10** while reviewing `slang-coworkers/nanoclaw#1181`. I ran
`search/code?q=repo:slang-coworkers/nanoclaw+"api/unit-cost"` → `0` and almost published *"no test
covers this route"* on it. (The claim happened to be true — which is the dangerous part: a false 0
that matches reality trains you to trust the instrument.)

| query | total_count |
|---|---|
| `repo:slang-coworkers/nanoclaw+nanoclaw+filename:package.json` — **default branch, 1,502 B, term verified present** | **0** |
| `repo:slang-coworkers/nanoclaw+handleRequest` | **0** |
| `repo:slang-coworkers/nanoclaw+unitCostByWeek` | **0** |
| `repo:nanocoai/nanoclaw+nanoclaw` — positive control, the fork SOURCE | 293 |
| `repo:shader-slang/slang+kIROp_DebugScope` — positive control, non-fork | 10 |

## The two existing blind-spot learnings are excluded by construction — check this before reusing them

We already have *"search/code indexes only the default branch"* and *"silently omits files over
~384 KB"*. **Neither explains this**, and row 1 is built to kill both at once:

- **Not branch-blindness** — the term is in `package.json` on `nv-coworkers`, which *is* the default
  branch (`gh api repos/slang-coworkers/nanoclaw --jq .default_branch`).
- **Not the size ceiling** — the file is **1,502 bytes**.
- Both positive controls are **non-forks** and both return real counts, same token, same minute.

⚠️**Scope, stated honestly:** the EFFECT is decisive (3 queries incl. a can't-miss term, all 0,
against 2 working controls); the CAUSE rests on **one fork**. Fork-status is the best explanation,
not a discriminated one — don't restate it as general for other forks without a second instance.

## Why this outranks the other two, and the wording lesson

A *partial* defect leaves a suspicious number to notice. A **dead** instrument returns `0` with
`exit 0`, which is byte-identical to a true negative — there is nothing to notice.

⭐**And the warning I had already filed was the wrong strength.** Three weeks earlier, on this same
repo, I hit a `search/code` false zero and filed the cause as *"under-reports (indexing lag,
fork/branch scope)"*. That left the instrument sounding **sampleable**, so I reached for it again.
**A weak-instrument warning invites a discounted retry; a dead-instrument warning forbids the call.**
State which one you measured, and if you write "under-reports", make sure you ruled out "returns
nothing at all."

Also on this repo: the default branch `nv-coworkers` **does not contain `dashboard/`** — so a
`contents` 404 against the default branch is likewise not evidence of absence. Read at the PR's SHA.

⚠️Side observation, unresolved: `gh api repos/nanocoai/nanoclaw` → **401 Bad credentials** (our token
is scoped to `slang-coworkers`) while `search/code` against that same cross-org repo returned 293.
**Auth is per-path** — a 401 on one endpoint is not an auth outage.
