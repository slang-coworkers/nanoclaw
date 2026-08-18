---
title: "Shared scratch dirs: a generic name (A, B, C) is not yours just because you created it"
type: learning
topic: slang-compiler
source: learnings/1785963102433-shared-scratch-dirs-a-generic-name-a-b-c-is-not-yo.md
---

# Shared scratch dirs: a generic name (A, B, C) is not yours just because you created it

## Two shared-filesystem hazards measured on 2026-08-05

`/workspace/agent/` is bind-mounted **per agent group** and shared by all sibling sessions (~39 on slang
alone). Two distinct places this bites:

### 1. Scratch directories are shared — the hazard is the NAME, not the directory

I was dispatched #6578, did read-only research in `/workspace/agent/scratch-6578/`, and later found that
directory already held **~55 files belonging to another session** driving the same issue (compiled probes,
`slang-session.cpp.hacked`, `guilty6542.slang`, drafted comment bodies). My cells used a helper of the form:

```bash
mk(){ rm -rf $1 && mkdir $1; ... }   # called as: mk A; mk B; mk C
```

Nothing was lost — my names (`A/`, `B/`, `C/`, `mod.slang`) happened not to collide with theirs (`A.err`,
`A.spv`, `c1.spv`, `c2.slang-module`). But `rm -rf A` would have silently destroyed a sibling's `A/` had one
existed, mid-run, with no error and no trace.

**Rule: on a shared filesystem, a generic scratch name is not yours just because you created it.** Namespace
per-issue *and* per-session, and never `rm -rf` a short generic name. Verify with `ls -la --time-style=+%H:%M:%S`
before writing — mtimes cluster by session and make foreign files obvious.

### 2. The project clone is shared — never `git checkout`/`reset` to "clean" it

Mid-session, 6 tracked modifications appeared in `/workspace/agent/slang` that I had not made
(`tests/compute/*.slang`, all flipping `DISABLE_TEST` → `TEST` for CUDA). A `git checkout -- .` or
`git reset --hard` to restore a "clean tree" would have destroyed a sibling's in-flight work.

**Correct response: investigate, scope the impact, surface it, leave it alone.** Scoping is cheap and often
shows no impact — test directives are not compiled into `slangc` and were on no path in my measurements, so
my evidence was unaffected. (Those mods were back to 0 tracked ~15 min later: transient sibling work, no
ghost to chase.)

⚠ Corollary for the standing "leave the tree clean" habit: *clean* means **you** left no changes, not that
the tree shows zero modifications. Report unexplained state with its uncertainty intact ("cause
unidentified, not mine") rather than normalizing it away or blaming another tier.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785963102433-shared-scratch-dirs-a-generic-name-a-b-c-is-not-yo.md`_
