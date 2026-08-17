---
title: "slangc -v prints the stale CONFIGURE-TIME version, not the built source — judge binary freshness by object mtime vs the source's last commit date"
type: learning
topic: slang-compiler
source: learnings/1785881144512-slangc-v-prints-the-stale-configure-time-version-n.md
---

# slangc -v prints the stale CONFIGURE-TIME version, not the built source — judge binary freshness by object mtime vs the source's last commit date

Recorded separately from the #12349 triage learning because it generalizes to every Slang triage that cites a locally-built binary, and it has now bitten multiple sessions.

## The trap
`slangc -v` prints a string baked at **CMake configure time** (`cmake/GitVersion.cmake` runs `git describe`), NOT a description of the source that was compiled. Observed 2026-08-04: a Debug build whose tree was at HEAD `91c454cc8` printed **`2026.13.1-50-g3649fb982`** — a real but ANCESTOR commit, 82 commits behind. The string is plausible, well-formed, and wrong, which is why it survives scrutiny. A different session hit the same thing and used it to argue a binary was stale when it wasn't.

⇒ **`-v` cannot answer "was this binary built from the code I am reading?"** It answers "when was the build directory last configured?"

## The correct freshness check — and it is per-claim, not global
Compare the **object file's mtime** against the **last git-modification time of each source your claim depends on**:

```bash
# what the claim depends on
for f in source/slang/slang-type-layout.cpp source/slang/slang-reflection-json.cpp; do
  git log -1 --format="%cI  $f" -- $f
done
# what was actually compiled
find build -name 'slang-type-layout.cpp.o' -exec stat -c '%y  %n' {} \;
```
Object mtime LATER than the source's last commit ⇒ that object is valid for claims about that file. This is the right granularity: a binary can be simultaneously stale overall and perfectly valid for your specific claim.

## Corollary: scope a stale binary instead of discarding it
When the binary IS older than HEAD, don't throw it away — ask **which files the staleness touches**. On #12349 the binary predated HEAD by ~4.5h, so I enumerated the intervening commits and diffed only the paths that mattered:

```bash
git diff --name-only <last-pre-build-commit>~1 HEAD -- source/ include/ prelude/
```
Result was one file, `source/core/slang-signal.cpp` — nothing in layout/reflection/emit ⇒ binary valid for the claim, no rebuild needed (a Slang rebuild is 5-20 min, so this is worth the 30 seconds). The inverse also happens: a *fresh-looking* mtime with a stale `-v` tempted me to trust it globally, which would have been wrong for a different claim.

Related failure mode from the same day: a 5-hour-stale Debug slangc reported an assert at `:5182` where the current source has `:5235` — a file:line that looks entirely real and checks out as a valid location, just in the wrong revision. **Never cite an assert file:line from a binary you have not freshness-checked against the claim.**

## When the claim is about a RELEASE version, stop inferring and download it
If a reporter names a version, don't reason from "did the relevant files change since then" (that argument is weak when they changed a lot — here 845+/6- in one file). Fetch the actual release; it ships the library and headers too, so you can build a harness against the reporter's exact `libslang.so`:

```bash
gh release download v2026.12 -R shader-slang/slang -p 'slang-2026.12-linux-x86_64.tar.gz' -D rel
tar xzf rel/slang-2026.12-linux-x86_64.tar.gz -C rel
./rel/bin/slangc -v   # prints exactly 2026.12 — for a release tarball -v IS trustworthy
```
(For a *release* binary `-v` is reliable, because configure-time and source coincide. The trap is specific to local dev builds.)

⇒ Rule: **a version claim about someone else's binary is a measurement you can actually take**, for about a minute of wall clock. "Verified at HEAD, presumed at their version" is a weaker statement than it looks, and reviewers rightly push on it.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785881144512-slangc-v-prints-the-stale-configure-time-version-n.md`_
