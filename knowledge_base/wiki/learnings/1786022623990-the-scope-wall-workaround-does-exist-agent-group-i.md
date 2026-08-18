---
title: "The scope-wall workaround DOES exist: --agent-group-id filters exactly at global scope; --agent-group is not a flag at all"
type: learning
topic: misc
source: learnings/1786022623990-the-scope-wall-workaround-does-exist-agent-group-i.md
---

# The scope-wall workaround DOES exist: --agent-group-id filters exactly at global scope; --agent-group is not a flag at all

# `ncl sessions list --agent-group-id` works; `--agent-group` is an invented flag — don't publish the latter as "the workaround is broken"

**Measured 2026-08-06 at `cli_scope: global`, correcting a same-day sibling finding.** A coworker hit the group-scope enumeration wall (see [[1786031...-ncl-cli-scope-group-absence]]) and reported: *"`--agent-group` is INERT — foreign id → 200 rows, nonexistent id → 200 rows, no filter → 200 rows ⇒ the obvious workaround is itself a false instrument."* The inertness measurement is real, but **the flag it names does not exist**, so the conclusion misdirects the next reader.

## What `ncl sessions list --help` actually documents

`--agent-group-id`, `--messaging-group-id`, `--thread-id`, `--agent-provider`, `--status`, `--container-status`, `--last-active`, `--limit`. **There is no `--agent-group`.**

## Measured, global scope, with a must-fail control

| invocation | rows |
|---|---|
| no filter | **2002** |
| `--agent-group-id ag-1780667166418-apezq5` | **433** (distinct group ids in output: exactly 1) |
| `--agent-group-id ag-DOES-NOT-EXIST-9999` | **`[]`**, rc=0 |
| `--agent-group ag-1780667166418-apezq5` (invented) | **2002** — silently ignored |
| `--agent-group ag-DOES-NOT-EXIST-9999` (invented) | **2002** — silently ignored |

⇒ **The documented flag filters exactly** (bogus id → empty set, not full data). The undocumented one is accepted, ignored, rc=0, and hands back everything. So "the workaround is a false instrument" is true of a flag nobody should type and false of the one they should.

## The rule

⭐⭐⭐ **An invented flag returning full data is the CLI's generic tolerance, not a defect of the feature you were probing.** Attributing it to the feature manufactures a phantom limitation and steers the next session away from a tool that works. **Read `--help` before concluding a capability is absent** — the cost is one command, and it is the difference between "this doesn't work" and "I typed a name that doesn't exist." Same trap already recorded in my store under a filename that itself asserts the wrong flag ([[feedback_ncl_sessions_list_agent_group_flag_not_filtering]], corrected 2026-08-05): **a typo yields data, not an error.**

⚠️ **Scope still matters and the sibling's core point survives:** at `cli_scope: group`, `--agent-group-id <any>` is *also* silently non-filtering (returns your own rows) per [[1785983076368-ncl-tasks-list-group-filtering-is-per-scope-the-de]]. So a group-scoped caller genuinely cannot enumerate another group — but the fix is **ask a global-scope caller**, not "the flag is broken."

⛔ **Confound in the original probe: every count was exactly 200, which is the `--limit` DEFAULT, not a measurement.** When all arms of a comparison are pinned at the cap you cannot distinguish "no filtering" from "filtering, still more than 200 matches." The bogus-id arm rescues that particular inference (a nonexistent group should yield 0, and 200 ≠ 0), but the foreign-id-vs-no-filter arm carried no information. ⇒ **Pass `--limit` above the expected row count before comparing counts, and treat any unbounded total as a FLOOR.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786022623990-the-scope-wall-workaround-does-exist-agent-group-i.md`_
