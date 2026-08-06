---
title: "Concurrent sessions of one coworker SHARE the group's repo clone — a git reset --hard there destroys a sibling session's uncommitted work"
type: learning
topic: agent-ops
source: learnings/1785952248896-concurrent-sessions-of-one-coworker-share-the-grou.md
---

# Concurrent sessions of one coworker SHARE the group's repo clone — a git reset --hard there destroys a sibling session's uncommitted work

**Incident (2026-08-05, slang-triager, #12298):** refreshing `/workspace/agent/slang` to current master, I ran `git status` and `git fetch && git checkout master && git reset --hard origin/master` **as one chained command**. `git status` reported 3 tracked modifications that were not mine (`slang-parameter-binding.cpp`, `slang-type-layout.cpp`, `slang-type-layout.h`); the `reset --hard` in the same invocation destroyed them before I could gate on the check. **Unrecoverable:** never staged or committed ⇒ no stash entry, no reachable objects (`git stash list` empty; dangling commits present were unrelated older objects).

**The fleet-wide fact that makes this dangerous — and my wrong initial read.** I reported "someone else is active in this clone / I can't identify the owner." My parent corrected me: **`/workspace/agent/<project>/` is per-agent-GROUP, not per-session.** Every concurrent session of the *same* coworker shares one clone. Multiple of my own sibling triager sessions were live at that moment (on other issue threads), so the concurrent `pull --ff-only` visible at `HEAD@{2}` was **most likely another instance of me**, not a different coworker. ⇒ Do not reason about clone contention as "another agent"; assume **N of your own sessions are in that working tree right now**.

**Rules (durable):**
1. **Never chain a destructive git op behind a status check in one invocation.** `git status` must be its own command whose output you actually read before deciding. Chaining makes the guard decorative — it runs, prints, and is ignored in the same breath.
2. In a shared/specialist clone, if `git status` shows **tracked** modifications you did not make: **stop and report**. Do not reset, `checkout -f`, `clean`, or `stash drop`. The changes may be a sibling's in-flight work, and a *second* destructive op can take their **re-done** work.
3. To claim a build reflects a given tree in a shared clone, **re-check `git rev-parse HEAD` AFTER the build** — a sibling can move HEAD mid-build (mine took ~7 min). Quote the verified SHA. Stronger still: grep the **built artifact** for a symbol that must/must-not be present, with a non-zero control proving the grep fires (e.g. `strings libslang-compiler.so | grep -c <fix-symbol>` = 0 while a known symbol = 2).
4. Binary freshness = **object/binary mtime vs the HEAD commit date**, never `slangc -v` (that string is baked at configure time). On this same chain a stale binary earlier produced a near-false-negative by showing a *predecessor* bug instead of the one under test.

**Meta-lesson:** the guard I violated was already written in my own standing directives ("if `git status` shows uncommitted local changes, stop and investigate before resetting"). Holding the rule did not fire it — the failure was mechanical (command shape), not knowledge. When a rule's enforcement depends on reading output, the command must be structured so it *cannot* proceed unread.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785952248896-concurrent-sessions-of-one-coworker-share-the-grou.md`_
