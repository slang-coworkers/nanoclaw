---
title: "A decoy that differs from the real subject in the property under test validates nothing — real ninja argv is bare; the worktree path is only in cwd"
type: learning
topic: misc
source: learnings/1786224759545-a-decoy-that-differs-from-the-real-subject-in-the-.md
---

# A decoy that differs from the real subject in the property under test validates nothing — real ninja argv is bare; the worktree path is only in cwd

## The measurement

Live `cmake --build` in a git worktree, read while provably running (`pgrep -x ninja` non-empty first):

```
cmake  argv: cmake --build --preset release --target slangc     cwd: …/wt-12434-verify/build
ninja  argv: /usr/bin/ninja -f build-Release.ninja slangc       cwd: …/wt-12434-verify/build
```

**The worktree path appears only in `cwd`. Never in argv.** Consequences:

- A regex half like `ninja.*wt-slang-12386` **can never match a real build.** One agent's waiter used
  exactly that; the alternative written to scope the check was **inert**, and its only observable effect
  was self-matching the waiter's own argv. An alternative that cannot match reads identically to one that
  legitimately found nothing.
- `ps -eo args | grep -E "<worktree>" | grep -v grep` does **not** match the ninja or cmake. Against a
  live build it returned 2 — both transient compiler children (`/bin/sh -c … c++`, `objcopy
  --only-keep-debug /abs/path/…`) that happen to carry absolute paths. Explicit pid-membership check: the
  ninja PID was **not** among them. So it reads whatever the compiler is doing that instant, and 0
  whenever no such child is mid-flight, while a build runs.

## The root error: decoy fidelity

The argv-grep instrument had been "validated" against a decoy built as
`exec -a "cmake --build decoy-longlived" sleep 500` — which puts the pattern in argv **by construction**,
the exact property a real `ninja` lacks. So an argv-matching instrument was tested against a subject
engineered to be argv-matchable.

⇒ **Fixing a control's *existence* does not fix its *fidelity*.** Sequence observed across one session:
(1) no control → added one; (2) control couldn't fail → made it able to fail; (3) control could fail but
its *subject* was unrepresentative. Each fix left residue one layer down.

**Test for decoy fidelity:** name the property the instrument keys on (here: "pattern present in argv"),
then ask whether the *real* subject has that property for the *same reason* the decoy does. If the decoy
acquires it by construction and the real subject acquires it incidentally — or not at all — the decoy is
invalid regardless of how the test comes out.

## What actually works, each measured against a live build AND an impossible control

```
pgrep -x ninja                                          → 1 live / 0 after exit   (cannot scope)
for p in $(pgrep -x ninja); do readlink /proc/$p/cwd; done | grep -q "<worktree>"
                                                        → 1 live / 0 impossible   ✅ scopes
```

`pgrep -x` reads `comm`, so it is argv-spoof-immune but cannot scope to a directory at all.
**`/proc/<pid>/cwd` is the only form that answers "is a build running in *this* worktree,"** and it is
argv-immune by construction. Best of all: watch the **output artifact** (binary mtime, file sentinel).

Related trap in the same family: a liveness instrument validated only against "nothing is running" is
vacuous. One agent's first two candidate replacements read 0 for a *real* ninja because the probe used
`ninja -n` — too fast to observe. A `sleep`-backed positive pole is required before either pole means
anything.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786224759545-a-decoy-that-differs-from-the-real-subject-in-the-.md`_
