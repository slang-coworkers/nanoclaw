---
title: "Adding a slangc CLI option trips check-cmdline-ref CI; the bot can't self-fix it via /regenerate-cmdline-ref"
type: learning
topic: slang-compiler
source: learnings/1782520511938-adding-a-slangc-cli-option-trips-check-cmdline-ref.md
---

# Adding a slangc CLI option trips check-cmdline-ref CI; the bot can't self-fix it via /regenerate-cmdline-ref

Adding any `-fxxx` option to `initCommandOptions` (slang-options.cpp) changes `slangc -help-style markdown -h`, and the `check-cmdline-ref` CI job (`.github/workflows/ci.yml`) hard-`exit 1`s on any diff vs the committed, auto-generated `docs/command-line-slangc-reference.md`. So **every CLI-option PR must regenerate that doc** or `check-cmdline-ref` (and its `check-ci` aggregate rollup) goes red. (Note `docs/user-guide/08-compiling.md`'s `CompilerOptionName` table is NOT CI-enforced and is already non-exhaustive — it omits recent options — so a missing row there is not a CI failure.)

**The bot CANNOT self-fix this red (shader-slang/slang#11789, 2026-06-27):**
- The canonical fix is the `/regenerate-cmdline-ref` slash command (`.github/workflows/regenerate-cmdline-ref.yml`, via slash-command-dispatch), which runs real `slangc -help-style markdown -h` and pushes the regenerated doc. BUT commenting `/regenerate-cmdline-ref` as `nv-slang-bot[bot]` does **NOT dispatch** — slash-command-dispatch requires the commenter to clear a write-permission level the bot identity doesn't meet. Verify with `gh run list -R shader-slang/slang --workflow=regenerate-cmdline-ref.yml -L 5` — if no run appears for your PR/branch, it didn't fire.
- The other fix is `slangc -help-style markdown -h > docs/command-line-slangc-reference.md` locally — needs a working build (blocked when disk-full).

**Do NOT hand-edit `docs/command-line-slangc-reference.md` to add the row** unless you can build to diff-verify. It's auto-generated; the generator emits a deterministic-but-fragile format (per-option block: blank, blank, `<a id="flag-no-dash"></a>`, `### -flag`, then the concatenated help-text string with exactly ONE trailing space, then two blank lines; options appear in registration order). Guessing the byte-exact output (especially trailing whitespace) is the same don't-ship-unverifiable failure mode as pinning an unvalidated FileCheck pattern — a near-miss keeps it red AND adds a wrong doc line.

**Right disposition when you can't build/dispatch:** post a concise PR note documenting that the only red is `check-cmdline-ref`, it's doc-staleness not a code defect, and the one-line regen fix — and hand off to a maintainer/adopter with build+dispatch rights. CI's own failure log already emits the fix instruction. On a won't-merge frozen reference the red is immaterial; don't escalate or churn.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782520511938-adding-a-slangc-cli-option-trips-check-cmdline-ref.md`_
