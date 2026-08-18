---
title: "Before triaging a config-driven hook or gate, check it is REGISTERED — an unregistered hook makes every defect in it moot"
type: learning
topic: agent-ops
source: learnings/1785935338415-before-triaging-a-config-driven-hook-or-gate-check.md
---

# Before triaging a config-driven hook or gate, check it is REGISTERED — an unregistered hook makes every defect in it moot

## The trap

shader-slang/slang#12366 reported four real defects in `.claude/hooks/pre_tool_use.py` (the format-on-`git add`
hook), each verified empirically against the file. Every one was correct **as a reading of the file**. But
`.claude/settings.json` at master HEAD is 94 bytes and holds only an `env` key — the `hooks` block was deleted in
`5e0a22a4f` "Remove CLAUDE hooks" (#9775, 2026-01-29). **Nothing invokes the file.** That flips the maintainer
question from "fix the selection logic" to "delete the orphan, or fix AND re-register" — and it demotes severity,
because the reported impact ("contributors and agents reasonably trust it") requires execution.

**Rule: for any behaviour mediated by a config file — hooks, CI jobs, git hooks, lint gates, pass registries —
verify the REGISTRATION before auditing the LOGIC.** Reading the implementation tells you what it *would* do.
Cheap check, and it can invalidate the whole report.

## How to establish "not registered" defensibly

Content-grep the WHOLE tree, not just the obvious config, and always with a non-zero control:

```bash
git grep -l pre_tool_use HEAD        # 0 files tree-wide
git grep -l formatting.sh HEAD       # 14  <-- control proves the instrument reads
git grep -lEi 'PreToolUse|"hooks"|claude/hooks' HEAD -- .github/   # 0 across 64 workflows
git grep -li claude HEAD -- .github/ # 6   <-- control on the SAME path
```

**Scope the conclusion to what the instrument covers.** The defensible claim is *"not referenced by any tracked
configuration at HEAD"* — never *"it never runs"*. Claude Code hook entries **merge** across
user → project → local settings levels rather than replacing each other, so a user-level, managed, plugin, or
gitignored-local layer could still register it. That's unknowable from the repo.

## Two things that generalize beyond hooks

**1. Look for a live sibling that already does the job.** `extras/git-hooks/pre-commit` (+`install-git-hooks.sh`,
#8872) is documented in `CONTRIBUTING.md`, selects the staged set, `exit 1`s on failure, re-stages, and resolves
its path from `git rev-parse --show-toplevel`. The orphan was a strictly worse duplicate of a working tool. Finding
it changed the recommendation from *fix* to *delete*. **But don't oversell the replacement**: codex flagged that it
passes `--modified` (= `git diff --name-only HEAD`), not the staged set it computed — I measured that a partially
staged file's **unstaged hunk gets absorbed into the commit**. Better ≠ correct.

**2. `PreToolUse` runs BEFORE the tool call** ("Before a tool call executes. Can block it"); `PostToolUse` runs
after. The issue asserted the opposite and derived a stranded-worktree symptom from it. The symptom is real, the
mechanism wasn't.

## The measurement error I made, and the fix

I ran a scenario × ordering matrix and concluded "the strand does not reproduce under true ordering". **Too strong
— codex constructed two true-order strands and I reproduced both:** (a) stage via a route the hook's prefix matcher
misses (`cd x && git add`, `git -C … add`, `git stage`, an IDE) then a matched `git commit` — the hook rewrites the
worktree but not the already-populated index; (b) matched `git add` stages formatted rev A, rev B arrives, plain
`git commit` commits A and strands B.

Root cause of my error: **I enumerated the flows I thought of, then reported the null as a property of the
ordering.** A null from self-chosen cells is a claim about my imagination. When the conclusion is "X cannot
happen", ask an adversarial reviewer to *construct* X before publishing.

**Second instrument bug, same session:** my first matrix read the file selection *after* the commit — a different
state than the hook sees. Selection is the entire claim, so this was load-bearing. **Capture the state the
component actually observes, at the moment it observes it.**

## Two grep footguns that produced false readings

- **A flag-shaped pattern is eaten as an option**: `grep -cF '--since master --modified' f` → *"unrecognized
  option"*, printing an empty count that reads exactly like an absent claim. Use `grep -cFe '<pattern>'`.
- **`git log -L`, `-S`, `--follow` for provenance**: `-S` spanning a library and its consumer in one command can't
  distinguish "export introduced" from "consumer started calling". Pair every ref/path probe with a control
  (`| wc -c`, a must-hit token, a bogus SHA that must *error* rather than silently return 0).

## Dedup aperture

My first dedup (`pre_tool_use`, `PreToolUse`, `formatting.sh hook`) missed **#8637** — MEMBER-filed, Type=Build,
*"extras/formatting.sh should check/format also non-committed changes"*, i.e. claim 1's defect class. It surfaced
only when I checked Issue-Type convention for siblings, by accident. Searching `formatting.sh in:title` would have
found it immediately. **Search the artifact the defect lives in, not only the words the report used.**

That detour paid off twice: reading #8637 on its merits led me to measure `--since master --modified`, which
**already selects the union today** (`list_files()` appends the trailing `HEAD` only when `--modified` is absent,
`extras/formatting.sh:271-273`) — so the selection half is a one-flag change, not a rewrite, and #8637's request
is already implemented. Adjacent issues can hold the fix, not just context.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785935338415-before-triaging-a-config-driven-hook-or-gate-check.md`_
