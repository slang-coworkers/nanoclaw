---
title: "A log contains the program's text as well as its output"
type: learning
topic: misc
source: learnings/1786071161776-a-log-contains-the-program-s-text-as-well-as-its-o.md
---

# A log contains the program's text as well as its output

## The shape

Three times in one task, a correct-looking grep over a CI/test log returned the program's **source** rather than its **verdict** — and in all three cases stopping at the first match would have inverted the conclusion.

**1. A gate echoing its own script before deciding.** GitHub Actions echoes each `run:` block's text. So:

```
$ gh run view <id> --log | grep -i yield
  ^[[36;1m  echo "yielded=false" >> "$GITHUB_OUTPUT"^[[0m     <- script SOURCE
  ^[[36;1m  --max-yield-hours 12^[[0m                          <- script SOURCE
  Yielding to human/merge CI #30024 (pull_request, in_progress)  <- the VERDICT
```

Reading the first line gives "yielded=false" — the opposite of what happened.

**2. A workflow echoing its comment block.** `grep -i "lookback"` over a retry-worker run returned five lines of the workflow's own explanatory comment and zero lines of decision. The actual decision was `CI is still active (4 run(s)); not rerunning bot CI.` Stopping at the matches would have produced "the worker never considered my run."

**3. A test harness echoing the annotation it was checking.** `slang-test`'s failure output prints the expected annotation *and* a suggested replacement, so grepping for the annotation text finds it regardless of pass or fail.

## The rule

**Identify the decision line; don't grep for the topic.** A log is a transcript of a program *and* its execution. Grepping for a subject matches both, and source text usually appears first — before the code that produces the verdict has run.

Mechanical guards:
- Exclude echoed source. On GitHub Actions, `run:` blocks are wrapped in the escape sequence `^[[36;1m`: `grep -v $'\033\[36;1m'` or `grep -vE '\^\[\[36;1m'` on the captured text.
- Prefer the phrasing only the *output* can have. `"Yielding to"`, `"CI is still active"`, `"not rerunning"` are printed by the program; `--max-yield-hours` appears in its source.
- When a flag value matters, read it from the **file**, not the log — the log will show it in both places and you cannot tell which is authoritative.

## Companion: two constants in an odd relationship is a question, not a defect

I published a claim that a retry worker's `--lookback-hours 16` versus a gate's `--max-yield-hours 12` left a window where a run could age out unhandled. The answer was in a comment four lines above the flag:

> `--lookback-hours (16)` must stay above `wait-for-priority.py`'s `--max-yield-hours (12)` so a run ages out and **escalates** before this stops considering it.

The ordering was deliberate and built to prevent exactly the gap I described. I had inferred a defect from a numeric relationship without checking whether the authors had already reasoned about it — and this class of error concentrates in *other people's infrastructure*, where confidence is high and context is lowest. Before reporting a relationship between two constants as a bug, read the surrounding comment and the commit that introduced them.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786071161776-a-log-contains-the-program-s-text-as-well-as-its-o.md`_
