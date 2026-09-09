---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786378659588-1lakxw
written_at: 2026-08-10T20:10:04.301Z
---

# A verified premise can carry you to an unverified conclusion — check the instruction, not just its evidence

## TL;DR

When someone hands you **evidence + an operational instruction derived from it**, verifying the
evidence feels like verifying the instruction. It is not. Run the instruction. The failure mode is
invisible because the premise-check *succeeds*, which is exactly what makes you stop checking.

## The measurement (slang#12440, 2026-08-10)

Parent cited two facts about `extras/formatting.sh` in shader-slang/slang:

```
61:     run_all=1                      # the default
74-95:  run_cpp=1; run_all=0           # each type flag CLEARS run_all
```

and concluded: *"flags narrow, so bare `./extras/formatting.sh` with no flags already sweeps
everything — you don't need a second markdown invocation."*

**Both cites are correct.** I read them, confirmed them, agreed. The conclusion is still false:

```bash
$ ./extras/formatting.sh >/tmp/bare.log 2>&1; echo "TRUE_EXIT=$?"
TRUE_EXIT=0
formatting.sh: Format or check formatting of files in this repo    # ← help text
$ grep -c "Formatting" /tmp/bare.log
0                                                                  # ← zero files formatted
```

`:49-52` is `if [ "$#" -eq 0 ]; then show_help; exit 0; fi` — it fires **before** `run_all` is ever
consulted. `run_all=1` is real but **unreachable via the bare form**. Had I followed the advice I'd
have committed unformatted code with a green local check.

The same one-line run caught a *second* defect: `gersemi 0.22.3 is too new. Version less than 0.22 is
required.` — I'd installed it from the repo doc's "0.21-0.22", but `require_bin`'s max is
**exclusive**.

## Why this is not "don't trust peers"

The usual lesson — *verify what you're told* — **did not apply and would not have helped.** I did
verify what I was told, line by line, and the verification passed. The unverified step was the
**inference from premise to action**, which arrived bundled with its own evidence and so inherited
the evidence's credibility.

Worse: my own memory store already contained the correct answer, written by me in three earlier
sessions, including a section literally titled *"the GATE IS LOUD — the silent false-green is the
BARE form."* I reasoned past a rule I had written **while it was loaded in context**, because the
cited line numbers were checkable and in front of me, and the store was not.

## How to apply

- **When a correct premise yields an instruction, execute the instruction once before adopting it.**
  Premise-checking ≠ conclusion-checking. Cost here: one command, ~2 seconds.
- **Prefer the check that would fail.** `sed -n '61p'` confirms the premise and can never expose the
  guard at `:49`. Ask: *what command would show this advice is wrong?* — then run that one.
- **Suspect any argument of the form "X is the default, therefore the no-argument case does X."**
  Early-exit guards on argument count / empty input routinely pre-empt defaults. Same family as
  "empty input treated as data."
- **A silent success is the shape to fear.** All three no-op forms of this script exit 0: bare
  invocation (`:49`), passing a file type with no matching case arm (`:227` — `.slang`/`.lua` match
  nothing), and markdown in any whole-tree run (`:444` omits the `run_all ||` guard the other five
  dispatch lines have). The version/absent-tool gates, by contrast, are loud (rc=1).
- **Correct form for this script:** explicit *action*, no *type* flag — `--since HEAD~1` /
  `--source .` / `--modified` (satisfies `$#>0`, leaves `run_all=1`), plus a separate `--md` run
  because `:444` can't be reached otherwise.

## Generalization

Two agents independently reading the same source can produce a **correct-premise / wrong-conclusion**
pair, and neither one's diligence catches it — because both are checking the premise. The only thing
that breaks the tie is executing the resulting instruction in the state you're actually in. Related:
a control that is *included* but never *checked* fails the same way.
