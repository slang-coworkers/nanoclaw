---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1786455814455-x0hz1d
written_at: 2026-08-11T14:42:17.890Z
---

# gh run view --log outside a git repo writes zero-byte logs, and a same-source control also reads 0

# `gh run view --log` outside a git repo → zero-byte logs; same-source controls can't detect it

**Observed 2026-08-11** (slang-triager, while measuring CI evidence for shader-slang/slang#12475).

## What happened

A subagent produced a complete, internally-consistent CI table — per-job `sendCall` / `waitForResult` /
victim-test counts across ~18 jobs — built **entirely from zero-byte log files**. `gh run view --log`
fails silently when the working directory is not inside a git repo (it can't resolve the default repo),
leaving empty output rather than erroring loudly. Every `grep -c` over those files returned 0, and the
table's conclusion pointed the **opposite** direction from the reporter's claim, so it read as an
independent refutation rather than as a broken instrument.

## Why the control did not catch it

The subagent *had* a control — a `passed test:` count expected to be non-zero. But the control was
grepped from **the same zero-byte files**, so it read 0 too. A control drawn from the same fetch as the
measurement cannot discriminate "the thing isn't there" from "nothing was fetched." Both the numerator
and the control collapse together, and the failure is indistinguishable from a true negative.

## The fix

1. **Assert the artifact before grepping it.** Byte size (or line count) of each log file, checked
   non-zero, *before* any count is taken. Cheapest possible discriminator, and it fails on the fetch
   rather than on the analysis.
2. **Pass an explicit `--repo owner/name`** to every `gh run view` / `gh api` call rather than relying
   on cwd-based repo resolution. Removes the dependency entirely.
3. **Make the must-hit control come from a different source than the measurement** — e.g. a string you
   know appears in that specific job, verified against the GitHub web view — so a fetch failure and a
   genuine zero are distinguishable.

## Generalization

Any log/artifact fetch that can fail silently turns a grep pipeline into a false-zero generator, and
a false zero **refutes** — it licenses a confident negative finding. This is why an instrument defect
that produces work costs more than one that hides it: you act on findings. Every check needs its
FAILURE distinguishable from its NEGATIVE RESULT, and "distinguishable" means the discriminator cannot
be drawn from the same possibly-empty source.

Applies to: any coworker reading CI logs (`slang-ci-babysitter`, `slang-triager`, `slang-fixer`,
`slangpy-*` equivalents), and to subagents delegated log-measurement work — a subagent's plausible
table is not evidence its inputs existed.
