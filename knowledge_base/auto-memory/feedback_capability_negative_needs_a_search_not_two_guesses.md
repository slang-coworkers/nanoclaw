---
name: feedback-capability-negative-needs-a-search-not-two-guesses
description: "I reported \"no built slangc, no torch ⇒ cannot reproduce\" from two guessed ls paths; a find / located slangc in my OWN tree and nvcc was installed. A capability negative needs an exhaustive search, and a tier below me reproduced what I declared unreproducible."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5998cff2-0986-4076-bf33-eb6d163a5534
---

# "I can't reproduce this" is a CLAIM — it needs a search, not two guesses

**2026-08-04, slang#9736.** I triaged from source reads and told both the triager and the
operator: *"repro NOT executed — no built `slangc`, no `torch` in this container."* I put
that in the child memory, the index row, the dispatch, and the operator rollup.

`slang-triager` then **executed all of it** and posted a measured verdict.

## What my instrument actually was

```
ls build/Debug/bin/slangc build/Release/bin/slangc   # cwd was /workspace/agent, NOT .../agent/slang
```

Two **guessed relative paths**, from the wrong directory, silently resolving to
`/workspace/agent/build/...` which never existed. I read one empty result as *"no slangc
anywhere."* The honest instrument:

```
find / -name slangc -type f 2>/dev/null      # ⇒ /workspace/agent/slang/build/Release/bin/slangc  (MY OWN TREE)
                                             #  + 9 more across peer group worktrees
```

And **`nvcc` I never probed at all** — it is installed at `/usr/local/cuda/bin/nvcc`
(12.6). I inferred its absence from `torch` being absent, which is a non-sequitur: both
of #9736's errors are **compile/link-time**, needing neither a GPU nor `torch`.

## The two independent failures

1. **Scope error.** `ls <two guesses>` authenticates *those two paths*, not "the machine."
   A negative over a set requires a search over the set. This is the same shape as
   [[feedback_search_code_total_count_is_not_a_file_count]]: **a count/absence
   authenticates a COMMAND OVER A SCOPE — name the scope.**
2. **Bundled unrelated negatives.** "no slangc, no torch ⇒ cannot reproduce" bundles three
   claims and tests one badly. `torch`'s absence was true and **irrelevant**; nvcc's
   presence made Error 1 testable with *no slangc at all* (just the prelude text).

## Why this is worse than an ordinary measurement error

A capability negative **propagates as permission to skip work.** I didn't just get a fact
wrong — I told a downstream tier the evidence ceiling was lower than it was, and put
"⚠️ repro NOT executed" into the memory index where the next agent inherits it. The
triager reproduced it anyway *because they probed rather than adopted my caveat*. Had they
deferred to me, the maintainer would have received a source-read triage on an issue that
was fully measurable, on a box that had every tool.

⭐⭐ **A caveat you inherit is a hypothesis, not a constraint.** Re-probe it before
adopting it — especially one shaped "we lack X."
⭐⭐⭐ **State capability negatives as the command you ran**, never as a property of the
environment: *"`ls <path>` found no slangc"* ≠ *"there is no slangc."* The first is
falsifiable and cheap to correct; the second silently lowers everyone's ceiling.

## Related, and where the pattern already bit

[[feedback_control_the_instrument_not_the_reasoning]] — same root: the inference was fine,
the measurement's scope was wrong. Also matches the already-recorded
`GH_TOKEN` 401 case (spy#1072: *"asserted it live 6× then RETRACTED"* ⇒ **re-probe
capability-negatives every round**) — I had this exact lesson on file and still shipped a
capability negative from two guesses.

## Checks to run before writing "cannot reproduce"

- `find / -name '<tool>' -type f 2>/dev/null | head` (+ a control on a tool you know exists)
- `which -a <tool>`; `<tool> --version` — a version string is the only proof it *runs*
- Ask **which of the reported errors actually needs the missing tool.** Compile/link-time
  errors rarely need a GPU or a runtime; often the prelude/header text alone suffices.
- Peer group worktrees under `/workspace/extra/ephemeral/prod-groups/*/` often hold built
  binaries even when mine doesn't.
