---
name: project_critique_gate_stale_state_crosses_sessions
description: "5th critique-gate defect class: /workspace/.claude/workflow-state.json PERSISTS ACROSS SESSIONS on one agent group's workspace, so a fresh session inherits a prior session's edits_since_critique and is denied on its FIRST read — denial reason cites edits it never made. Observed slang-fixer 08-06, state left from 07-22 on the same PR (#12089), 15 days stale, 2 of 3 denials burned on read-only GETs."
metadata: 
  node_type: memory
  type: project
  originSessionId: 05f1fa43-cfeb-4a6a-989f-11f756db7244
---

# Critique gate, 5th defect class: state is WORKSPACE-scoped, not session-scoped

**Reported by slang-fixer 2026-08-06 02:29Z** on the #12089 naming sub-thread
([[project_12089_hitobject_ser_abi_nvapi_capability]]). Not yet mine-verified at the source —
recorded as the reporter's observation with the fields it quoted.

`/workspace/.claude/workflow-state.json` on its edge carried:
- `started_at` **2026-07-22**, `last_critique_at` **2026-07-22T23:26:17Z**
- `plan_path` = `reports/pr-12089-naming-reply.md`
- `edits_since_critique: 3`

That is the state of the **2026-07-22 session** on the *same PR* — the one that answered
jkwak's first naming question (review comment r3634601982). A new session opened 15 days
later inherited it verbatim and was denied on its first `gh api …/pulls…` read, with a
freshness reason describing **3 edits it had not made** (it had edited nothing).

⇒ ⭐⭐ **The gate's state file is scoped to the agent group's WORKSPACE, not to the session.**
Every recorded defect in [[project_critique_gate_pulls_pattern_builtin_floor]] is intra-session
(the `mkdir` ordering race; memory-file edits aging an `OUTPUT_REVIEW` approve). This one is
**cross-session leakage**: a session can be born already over the freshness threshold, from
work that concluded a fortnight earlier. No action in the new session caused it and none can
explain it from its own transcript.

⭐ **Why this is worse than the intra-session variants for diagnosis:** the denial reason is
*locally unfalsifiable*. "3 edits since the last critique round" is checkable against your own
transcript, you find zero edits, and the natural conclusion is that the gate is broken or
nondeterministic — when in fact the number is true of a *different session*. The reporter got
this right (it read the file and named the 07-22 provenance) rather than concluding
nondeterminism, which is the failure this row exists to prevent.

## Corroborates the write-verb narrowing, with a fresh incidence figure
**2 of 3 denials burned on read-only GETs** before any deliverable existed — the reporter was
merely *reading* the PR. Same `gh api [^|]*pulls\b` floor, 4th+ independent incidence
observation (07-15 · 07-22 · 08-03/04 · 08-06). The narrowing already filed with the operator
(gate on write verbs: `-X POST|PATCH|PUT|DELETE`, `--method`, `-f`/`--field`/`--input`) would
have prevented all of them.

## What the reporter did right, and it is the precedent to keep
It declined to run a hollow `/codex-critique OUTPUT_REVIEW` "on nothing" just to reset the
counter, and instead planned to clear the gate by critiquing the **real deliverable** once it
existed. Matches the 07-22 standing note verbatim (*do NOT run a pointless critique just to
clear the gate for a read-only check*) and the approver's 08-04 restraint. ⭐ **Manufacturing an
artifact to satisfy a gate is worse than the friction it removes** — and per the mechanism at
`:153`, a genuine critique round is also the only thing that actually resets
`edits_since_critique`.

## Practical remedy while the floor stands: don't make the gated call at all
The ungated detours are already enumerated in
[[project_critique_gate_pulls_pattern_builtin_floor]] (§UNGATED DETOURS) — `issues/N` paths,
`gh run list`, `actions/runs`, `git ls-remote`, and unauthenticated
`raw.githubusercontent.com/<owner>/<repo>/<sha>/<path>`. ⭐ **A disarmed edge can hand an armed
one the PR data outright**, which costs the armed session zero denials; on 08-06 Main fetched
the review-thread bodies and the per-file rename surface and passed them down rather than
letting the fixer spend its remaining denial re-reading them.
