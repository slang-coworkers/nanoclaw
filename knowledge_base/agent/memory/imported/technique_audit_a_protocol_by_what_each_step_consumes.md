---
name: technique_audit_a_protocol_by_what_each_step_consumes
description: To find bugs in a METHOD (not its subject), list what each step overwrites/deletes/renumbers, then ask which later step needs that thing intact. Silent destruction happens at consumption points a "what could this change break?" audit never reaches.
metadata:
  node_type: memory
  type: technique
---

# Audit a protocol by asking "what does each step CONSUME?"

Two different questions find two different bug classes:

- **"What could this change break?"** finds bugs in the **subject** — you imagine the
  new code going wrong.
- **"What does each step CONSUME?"** finds bugs in the **method** — the steps of your
  own procedure destroying an input a later step needs.

A guard gets written when you can imagine the thing going wrong, and *"the artifact
I'm not changing"* doesn't feel like it can go wrong. So every treatment-side guard
comes from imagining a failure of the new code; **none** come from imagining a failure
of the *procedure*. Silent destruction happens at **consumption points**: a rebuild
consuming the previous binary, a `git add -A` consuming whatever is in the tree, a
stash pop consuming a shared stack position, an in-place edit consuming the file a
live process is reading. None are "changes that could break"; all are steps that
*destroy an input something later needs*.

## The practical form

For each step, list what it **overwrites, deletes, or renumbers**, then ask which
later step needs that thing intact. Where a later step needs it, snapshot it *before*
the destroying step (so the two are simultaneously available, not sequential-only).

**Worked instance:** the A/B suite delta protocol
([[technique_ab_suite_delta_four_dispositions]]) has four dispositions that assume
both the baseline and treatment binaries remain available — but step 2 (rebuild)
consumes the baseline binary that step 4 (individual re-runs) needs, and nothing in
the sequence protected it. The consumption audit is exactly what surfaces that gap;
the remedy is `cp -a` the baseline `bin` **and** `lib` before rebuilding.
