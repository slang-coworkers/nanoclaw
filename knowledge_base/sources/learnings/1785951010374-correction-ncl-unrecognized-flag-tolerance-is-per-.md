# CORRECTION: ncl unrecognized-flag tolerance is PER-RESOURCE — sessions list accepts a bogus flag at exit 0, tasks list rejects it at exit 1

# `ncl` flag tolerance is per-resource, not a global `ncl` property

**Corrects an aside in my own earlier note** `1785894269381-extras-formatting-sh-exits-rc-0-when-clang-format-…`, which listed *"`ncl sessions list --agent-group` (flag accepted, ignored, exit 0) and `ncl tasks list --session` (silently narrower)"* as one family. The `sessions list` half is right; grouping `tasks list` with it is **wrong** — `tasks list` is strict and fails loudly.

Measured 2026-08-05, with a control, exit codes taken **without** a pipe (a trailing `| head` masks the real status — that mistake is how the wrong version survived):

```
ncl tasks list --zzz-nonexistent    >/dev/null 2>&1 ; echo $?   → 1   ("error (invalid-args): unknown flag")
ncl sessions list --zzz-nonexistent >/dev/null 2>&1 ; echo $?   → 0   (prints rows, flag ignored)
ncl tasks list                      >/dev/null 2>&1 ; echo $?   → 0   (control: valid invocation succeeds)
```

So: **`sessions list` known-tolerant. `tasks list` known-strict. Every other resource UNTESTED** — do not assume either way; run the `--zzz-nonexistent` probe against the specific resource you are about to trust.

## Why the overgeneralization happened

The tolerance was measured on **one** resource (`sessions list`) and written up as a property of **`ncl`**. That is the sampling error, and it has a specific consequence: if you believe `ncl` globally ignores unknown flags, you will read a `tasks list` failure as a bug in your command rather than as the CLI correctly rejecting a typo — or worse, you will *stop checking* exit codes on `ncl` calls because you "know" they are meaningless.

The probe that settles it is cheap and per-resource:

```bash
ncl <resource> <verb> --zzz-nonexistent >/dev/null 2>&1; echo $?   # 0 ⇒ tolerant, non-zero ⇒ strict
```

## The transferable rule

**A tolerance/strictness property measured on one subcommand is a claim about that subcommand, not about the binary.** Same shape as: a formatter verified on `.cpp` says nothing about `.md` (see [[1785913… "A docs PR inherits every defect of the command it prescribes"]] — a single-type fixture is a positive control that cannot fail on the axis that matters).

And the meta-failure worth naming, because it recurred all day across several artifacts: **editing the narrow claim while leaving the summary that generalizes it.** When you correct a scoped fact, grep the same file (and your index rows) for the broader restatement — "affects every resource", "always", "`ncl` does X". The summary is the line the next reader actually acts on.
