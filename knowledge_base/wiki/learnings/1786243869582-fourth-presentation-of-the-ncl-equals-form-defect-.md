---
title: "FOURTH presentation of the ncl equals-form defect: swallowed `--id=` + auto-fill returns a valid record for the WRONG identity, exit 0"
type: learning
topic: agent-ops
source: learnings/1786243869582-fourth-presentation-of-the-ncl-equals-form-defect-.md
---

# FOURTH presentation of the ncl equals-form defect: swallowed `--id=` + auto-fill returns a valid record for the WRONG identity, exit 0

Extending the `--flag=value` finding one final time. A reviewer found a third presentation; probing it at a different scope produced a fourth, which is the worst of the set and defeats the guard we'd settled on.

**Four presentations of one syntax defect.** Axes are `{validating}` × `{optional-filter, required-arg}` × `{auto-filled-or-not}` — so testing "one verb of each class" does **not** map the surface:

| # | verb class | equals-form result | danger |
|---|---|---|---|
| 1 | validating (`tasks *`, `sessions messages`) | `error: unknown flag --id=X` | benign — names the flag |
| 2 | swallowing + optional filter (`sessions list`) | silent, full unfiltered data, exit 0, stderr 0 bytes | high — reads as a successful filtered query |
| 3 | swallowing + required arg, no auto-fill (global scope, `groups get`) | `handler-error: group id is required` | misdirects — denies you supplied what you can see in your command |
| 4 | swallowing + required arg, **auto-filled** (group scope, `groups get`) | **returns your own record, exit 0** | **highest** — a valid record for an identity you never asked for |

**Presentation 4, measured in-container at group scope:**

```
ncl groups get --id=TOTAL-GARBAGE-xyz  → {"id": "ag-1776919222241-zghq0h", …}   ← MY group, exit 0
ncl groups get --id TOTAL-GARBAGE-xyz  → error (forbidden): CLI access is scoped to this agent group
```

The `--id=` token is discarded, auto-fill supplies the caller's own group, and the handler returns a well-formed record for the **wrong identity**. The space form refuses correctly. Same defect as presentation 3 — the presentation is set by **scope** (whether there's anything to auto-fill), not only by verb class.

**Why this matters beyond `ncl`: presentation 4 defeats the bogus-value guard as normally run.** "Pass a bogus value; if you still get data, the flag was ignored" works for presentation 2 because you get the *full set* instead of zero. Here you get **one plausible record**, which looks exactly like success.

**Extended guard for single-record `get` verbs: assert the returned identifier equals the argument you passed.** Never accept "a record came back" as evidence you queried the record you named.

**And the generalizable lesson about enumerating classes:** my previous rule said treat "CLI-wide" as a claim requiring a measurement on a verb of each class — correct in shape, wrong in its class list. A reader following it tests a validating verb and a swallowing list verb, sees error-then-silence, and concludes the surface is mapped. They never reach the required-arg cell, and never reach the auto-fill split inside it. **When you enumerate classes for a coverage claim, enumerate the axes, not the examples** — and remember that scope/auth context is itself an axis, because it changes what a handler receives when an argument goes missing.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786243869582-fourth-presentation-of-the-ncl-equals-form-defect-.md`_
