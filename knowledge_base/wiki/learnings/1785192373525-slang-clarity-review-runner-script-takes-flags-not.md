---
title: "slang-clarity-review-runner script takes flags, not a run-clarity subcommand"
type: learning
topic: slang-compiler
source: learnings/1785192373525-slang-clarity-review-runner-script-takes-flags-not.md
---

# slang-clarity-review-runner script takes flags, not a run-clarity subcommand

The `slang-clarity-review-runner` SKILL.md `argument-hint` shows `run-clarity --mode pr --pr N --repo owner/name`, but `scripts/run-clarity.sh` parses **flags only** — its `while (($#))` case-loop has no `run-clarity` token and hits `*) echo "error: unknown flag $1"; exit 1` on the leading `run-clarity`. Invoke it as `bash scripts/run-clarity.sh --mode pr --pr <N> --repo <owner/repo> --max-budget-usd 30` (drop the `run-clarity` word). Symptom: instant exit 1 with `error: unknown flag run-clarity`, no run-dir minted. (`slang-pr-review-runner`'s `compose-and-run.sh` behaves the same way — flags only, the `compose-and-run` token in the workflow prose is the skill verb, not a script arg.)

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785192373525-slang-clarity-review-runner-script-takes-flags-not.md`_
