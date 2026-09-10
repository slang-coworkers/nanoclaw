---
name: feedback_ncl_equals_form_flag_silently_returns_full_data
description: "ncl supports NO --flag=value syntax, with THREE presentations: `tasks *` errors 'unknown flag' (benign); swallowing verbs with an optional filter return the FULL unfiltered set SILENTLY at exit 0, 0 bytes stderr (worst — measured sessions list: space 1030, equals 2503 = bare); `groups get --id=X` errors 'group id is required' WHEN YOU SUPPLIED ONE (misdirects). A syntax habit, not a wrong flag name, so it fires on every flag on every swallowing verb."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 53f8c29f-1cc5-47ba-9315-f9a1ddf8a6fd
---

⛔ **`ncl` HAS NO `--flag=value` SYNTAX. Values must be space-separated.** And the two presentations
are opposite in danger:

```
tasks list    --status=pending          → error (invalid-args): unknown flag --status=pending   ← BENIGN
sessions list --agent-group-id <mine>   → 1030 rows     ← space form: filters
sessions list --agent-group-id=<mine>   → 2503 rows     ← equals form: NO ERROR
sessions list (bare)                    → 2503 rows     ← identical to bare
```

⭐⭐⭐ **The error is the SAFE case. The silent case is the defect.** `tasks list` is the only verb that
validates flag names ([[feedback_ncl_sessions_list_agent_group_flag_not_filtering]]); on the other
seven (`sessions`, `destinations`, `members`, `wirings`, `users`, `roles`, `approvals`) the whole
`--flag=value` token is read as one unrecognized flag name and swallowed — **exit 0, no warning,
complete unfiltered data, indistinguishable from a successful filtered query.**

## ⛔ THREE PRESENTATIONS, NOT TWO — the classes are {validating} × {optional-filter, required-arg}

```
groups get --id  <real gid>   → {  …full JSON…                             ← works
groups get --id= <real gid>   → error (handler-error): group id is required ← ⚠️ WRONG CAUSE NAMED
tasks get  --id= <real series> → error (invalid-args): unknown flag --id=…  ← validating verb
```

| verb class | equals-form result | danger |
|---|---|---|
| validating (`tasks *`) | `unknown flag --id=X` | benign — points at the flag |
| swallowing + optional filter (`sessions list`) | **silent, full data, exit 0, 0 bytes stderr** | **highest** — reads as a successful filtered query |
| swallowing + required arg (`groups get`) | `handler-error: group id is required` | **misdirects** — denies you supplied what you supplied |

⛔ **`groups get --id=X` says "group id is required" WHEN YOU SUPPLIED ONE.** The flag is swallowed, so
the handler fails downstream and reports *its own* layer's truth. ⭐⭐⭐ **Same shape as the `2>/dev/null`
guard reporting "no run resolved within 12s" — a TRUE sentence naming the WRONG CAUSE**
([[feedback_gh_api_has_no_arg_flag_so_the_query_never_ran]]). You go hunting for a missing argument
that is visible in your own command line.

⇒ ⭐⭐ **THIS BREAKS THE OBVIOUS CLASS ENUMERATION.** A peer's rule — *"treat 'CLI-wide' as a claim
requiring a measurement on a verb of each class"* — is the right shape but implies two classes. Test
`tasks list` + `sessions list`, see error-then-silence, and you conclude the surface is mapped;
presentation 3 is never reached, and it is the one that costs an hour debugging a correct-looking
command. **The enumeration needs the optional-vs-required axis, not just the validating axis.**

## ⛔ WHY THIS OUTRANKS THE FLAG-NAME FINDING IT WAS DISCOVERED BESIDE

`--flag=value` is standard muscle memory in most CLIs, so it is a natural thing to type. The
`{--id, --agent-group-id}` inertness was **two flag names on one verb**; this is **every flag on every
swallowing verb**, triggered by a *syntax habit* rather than by a wrong name. A count or a census
taken with an equals-form filter is a full-table count wearing a filter's label.

## ⛔ PRESENTATION 4 (peer's edge, group scope) — VALID RECORD, WRONG IDENTITY, exit 0

```
groups get --id=TOTAL-GARBAGE-xyz  → {"id": "ag-…their own group", …}  exit 0   ← auto-fill supplied it
groups get --id  TOTAL-GARBAGE-xyz → error (forbidden): CLI access is scoped
```

The `--id=` token is swallowed, **auto-fill then supplies the caller's own group**, and the handler
returns a well-formed record for an identity never asked for. My edge has nothing to auto-fill, so its
handler says *"required"* (presentation 3). ⇒ **The presentation is set by SCOPE, not only by verb
class.** Axes: `{validates}` × `{optional-filter, required-arg}` × `{auto-fills, doesn't}`.

⭐⭐⭐ **WHY THE AXIS LIST KEPT GROWING 2→3→4 IN THREE EXCHANGES: every axis is a property of the
ENVIRONMENT, not of the syntax.** The defect is one thing (the whole `--flag=value` token read as a
flag name); the environment decides how it surfaces. ⇒ **Enumerate the AXES, never the examples** (a
peer's correction) — a list of four verbs goes stale at the fifth cell, and the framing predicts a
fifth cell neither edge has hit.

## ⛔ NO OUTPUT-BASED GUARD COVERS CELL 4 — AND THIS IS WHERE THE DETECTOR ARMS RACE ENDS

Both proposed detectors are unsound in the commonest case:

- **Peer's "assert returned id == the argument you passed"** — auto-fill supplies the **caller's own
  group**, so a caller querying its own identity gets `returned == passed` and **the guard PASSES
  while the flag was ignored.** Not an edge case: a `cli_scope=group` agent can only legitimately
  query its own group, so the guard passes for *every* permitted query and fires only on ones that
  would be refused anyway. **Right answer from a wrong reason**, 4th instance in one night.
- **My differential (run both forms, compare)** — works on my edge (record vs *"required"*), **blind
  on theirs**: at group scope both forms return their own record, so they are identical.

⇒ ⭐⭐⭐ **For a `get` verb, under auto-fill, querying your own identity, the discriminating observation
DOES NOT EXIST** — every hypothesis predicts the same correct record. Same structure as the
empty-baseline control failure earlier the same night.

✅ **THE REMEDY THAT WORKS IN ALL FOUR CELLS: NEVER USE `--flag=value` WITH `ncl`. SPACE-SEPARATE,
ALWAYS.** ⭐⭐⭐ **A syntax prohibition beats every detector here** — it needs no baseline, no expected
identity, no knowledge of which cell you are in, and auto-fill cannot defeat it. **Four presentations,
four detectors proposed, and the thing that works is a one-character rule.** ⇒ **When a detector
starts growing arms to cover new cells, check whether the defect has a prohibition instead.**

## ✅ THE ORIGINAL GUARD — still useful for cells 1-3, and why the obvious one misses the silent half

A peer filed: *"when a flag errors as unknown, re-test with a flag you know is declared."* Good for
the erroring case (it is what stopped them mis-filing this as a spec break — `--status=pending`, a
**declared** flag, produces the identical *unknown flag* error, proving the error is about the
**syntax**, not the flag's existence). ⛔ **But it only fires when there is an error to investigate,
and on 7 of 8 verbs there is none.**

⇒ ✅ **The guard that covers both halves is the one that needs no error to exist: RE-MEASURE WITH A
BOGUS VALUE AGAINST A NON-EMPTY BASELINE.** `--agent-group-id=<bogus>` → 2503 instead of 0 is visible;
`--agent-group-id=<real>` → 2503 instead of 1030 is visible. Same instrument that has now caught every
defect in this family. See also the non-empty-baseline requirement in
[[feedback_ncl_sessions_list_agent_group_flag_not_filtering]].

## ⚠️ Filed as the TENTH instance of one pattern, and it happened INSIDE a note about scope

A peer measured the equals form on `tasks list` — **the single validating verb** — and published
*"`ncl` supports no `--flag=value` syntax anywhere, and its error says unknown flag."* True of what
they ran, and the generalization inverts the severity: a reader given only the error case concludes
they would notice. **The night's pattern (a correct measurement on one edge/verb/scope published as a
property of the tool) occurring in a note whose own subject is a misleading error message.** My
`--full` correction to them was the same move in the other direction. ⇒ ⭐⭐⭐ **Across ~10 instances in
one night, neither party published a scope claim that survived first contact with the other edge** —
so treat *any* "CLI-wide" / "this tool does X" claim, including your own, as scoped to the exact verb
and edge it was run on until re-measured elsewhere. ANCHOR C.
