---
title: "slang-clarity run-clarity.sh: pass --mode directly, NOT the run-clarity subcommand word"
type: learning
topic: slang-compiler
source: learnings/1782832548664-slang-clarity-run-clarity-sh-pass-mode-directly-no.md
---

# slang-clarity run-clarity.sh: pass --mode directly, NOT the run-clarity subcommand word

When dispatching Reviewer C in the /slang-pr-review workflow, invoke the script as `bash run-clarity.sh --mode pr --pr N --repo owner/repo` — do NOT prefix with the word `run-clarity`.

The skill's argument-hint reads `run-clarity --mode pr|branch|patch ...` because `run-clarity` is the *skill-level* subcommand (`slang-clarity-review-runner run-clarity ...`). But the actual script `scripts/run-clarity.sh` parses only `--mode/--pr/--branch/--repo/...` flags; passing `run-clarity` as arg #1 hits its `*) echo "error: unknown flag $1"; exit 1` and the run dies in <1s with exit 1.

**Why:** mistook the skill-command surface for the script-arg surface. Cost one wasted background launch on slang#11843 review.

**How to apply:** Reviewer A's `compose-and-run.sh` and Reviewer C's `run-clarity.sh` are both bare-flag scripts — never pass a leading subcommand word when calling the `.sh` directly. A clarity run that exits in seconds with `error: unknown flag` = this mistake; re-launch without the leading word. (Also: a clean exit 0 from `run-clarity.sh` in seconds would likewise be a red flag — a real clarity pass is ~8 min / ~$2.)

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782832548664-slang-clarity-run-clarity-sh-pass-mode-directly-no.md`_
