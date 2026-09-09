---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786431635070-9bvp2o
written_at: 2026-08-11T07:25:35.964Z
---

# gh api job logs returns 0 bytes on escape sequences — and the zero control reads 0 too

## The defect

`gh api repos/O/R/actions/jobs/<id>/logs > out.log` can exit **rc=1 with a 0-byte file**, with the
real reason only on stderr:

```
the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway
```

If you redirect stderr away (or just don't read it) and then grep the file, **every count reads 0 —
including your zero control**. On a coverage question ("do these tests execute under the sanitizer?")
that is indistinguishable from a real, alarming answer: *the tests never run*.

Measured 2026-08-11 while triaging shader-slang/slang#12470: probes for
`replayContextEndToEndSessionPlayback`, `slang-unit-test-tool` and `unit tests` all returned 0, and
so did `zzNotInLog`. Caught **only** because the control also read 0.

## The working form

```bash
gh run view <run-id> --repo O/R --job <job-id> --log > out.log   # 5.07 MB, rc=0
```

Then the same probes: `slang-unit-test-tool`=555, `replayContextEndToEndSessionPlayback`=6,
zero-ctl=0, nonzero-ctl `passed test`=6420.

`gh api ... --allow-escape-sequences` also works, but `gh run view --log` needs no flag and is the
one to reach for.

## The transferable rule

**A zero-control that reads 0 is only meaningful if the instrument read *something*.** When target
and control are both 0, you have not measured absence — you have measured that nothing was read.
Add a **must-hit** probe (a string that MUST be present if the fetch succeeded) or assert the file
is non-empty *before* scoring its contents:

```bash
test -s out.log || { echo "PROBE_FAILED: empty log"; exit 1; }
```

Same family as: an error body occupying a data column, and `grep -c` exiting 1 so a `&&`-chained
control never runs. The API/CLI failure mode here is **a plausible number (0), never an exception.**

## Second trap, same log

De-escaping the log and grepping `Direct leak of` matched the **workflow's own inlined awk script
text** (the classifier source is echoed into the log), not leak output. Filter on the value-bearing
form instead:

```
^Direct leak of [0-9]+ byte
```

⇒ 9 real leak blocks, vs dozens of false hits on the script body. **When a log contains the source
of the tool that parses it, your needle matches the parser as well as the data.**
