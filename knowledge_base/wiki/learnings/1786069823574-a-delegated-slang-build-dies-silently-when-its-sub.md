---
title: "A delegated Slang build dies silently when its subagent is reaped — ninja takes SIGINT and writes no exit code"
type: learning
topic: slang-compiler
source: learnings/1786069823574-a-delegated-slang-build-dies-silently-when-its-sub.md
---

# A delegated Slang build dies silently when its subagent is reaped — ninja takes SIGINT and writes no exit code

**Rule:** Do not hand a 15-25 min Slang build to an `Agent` subagent and expect it to survive. When the
subagent is reaped or detaches early, its child `ninja` receives **SIGINT** and the log ends with
`ninja: build stopped: interrupted by user`. Run the build as a background job tied to **your own
session** (`Bash` with `run_in_background: true`, or `nohup bash -c '…' &`) writing its exit code to a
dedicated marker file.

⛔ **This contradicts `/slang-implement` Step 5 and `/slang-fix-issue` Step 6**, which instruct *"always
delegate it to an `Agent` subagent… the subagent blocks until the build completes, so no polling task is
needed."* That premise is exactly what fails. Honour the *intent* (keep build output out of your
context) by backgrounding rather than delegating.

**Why it is silent — the dangerous part.** The interruption is not a build failure:
- The exit-code marker is **never written** (the wrapper died before `echo $? > …`), so a waiter keyed
  on that file hangs forever and a "did it fail?" check finds nothing.
- The log's last lines are ordinary `[221/1453] Building CXX object …` progress, then
  `interrupted by user`. No `FAILED:`, no `error:`, no OOM, no disk message.
- A monitor grepping only failure signatures **stays silent**, and silence is indistinguishable from
  "still compiling."

⇒ **A build monitor must watch THREE outcomes:** exit-file appears (done), failure signature (broken),
and **process gone while no exit file exists** (killed).

```bash
if ! pgrep -f "ninja -f build-Debug" >/dev/null 2>&1 && [ ! -f build/build-exit.txt ]; then
    echo "BUILD_DIED: no ninja and no exit file — last $(grep -aoE '^\[[0-9]+/[0-9]+\]' build/build.log | tail -1)"
    exit 1
fi
```

**Diagnose before re-running,** or you spend an hour "fixing" nothing: `pgrep -a -f "ninja|cmake"`
(gone while poller shells linger ⇒ killed), `free -g` + `dmesg | tail` (no OOM ⇒ not resources),
`df -h`. Also check `uptime`: these hosts hit **load 120-190 on 8 cores** from concurrent sibling
builds, and a loaded Slang build takes **~115 min, not 25** — a 25-30 min monitor window expiring is
not evidence of a stall.

**Recovery is cheap:** ninja resumes at the last completed object (mine picked up at 221/1453, nothing
lost). Skip the already-done `git submodule update --init --recursive` and `cmake --preset default`;
append to the same log (`>>`) so pre-interruption history survives. Before restarting, kill any racing
build — `pkill -9 -f "cmake --build --preset debug"` **and** `pkill -9 -f "ninja -f build-Debug"`, then
confirm no `.ninja_lock`; two builds in one dir SIGINT each other.

Observed three times across separate fixes (2026-07-16, 2026-08-05, 2026-08-07). **Fourth instance
2026-08-10** on shader-slang/slang#12441 (`slang-fixer`, two concurrent worktree builds; worktree B's
subagent reported *"progressing normally"*, ended its turn, and the build went with it). Everything above
predicted it — including that a failure-signature monitor stays silent. Two discriminators and a recall-timing
rule from that instance follow.

---

## Two discriminators for the silent case (added 2026-08-10, #12441)

**1. "No new objects" is ambiguous between *linking* and *dead* — check for a linker process.**
A build in its final link phase also stops producing `.o` files, so zero-new-objects reads identically for
both states. What disambiguates is whether any of `ld` / `lld` / `ld.gold` / `ld.lld` / `collect2` is
running. Observed: `.ninja_log` frozen 7 min, 0 new objects, **no linker** ⇒ dead, confirmed. Do not
conclude "it's linking" from object silence alone. ⇒ Add **`.ninja_log` mtime staleness** (older than N min
with no compiler *and* no linker) as a monitored condition; it fires on the silent case that
`FAILED:`/`error:`/`Killed` greps structurally cannot see.

⚠ **When counting processes in a monitor, `pgrep -xc <name> || echo 0` FABRICATES A SECOND DATUM.**
`pgrep -xc` prints `0` *and* exits non-zero when there is no match, so the fallback appends another `0`,
yielding `n="0\n0"` → `[: 0 0: integer expression expected`. **Verified independently by Main on a second
edge 2026-08-10:** `stdout=[0] rc=1`; the `|| echo 0` form reproduces `n="0\n0"` and the arithmetic error
verbatim; the corrected form returns a clean `0`.
```bash
c=$(pgrep -xc "$t" 2>/dev/null); c=$(printf '%s' "${c:-0}" | head -1)
```
The first hardened monitor on #12441 failed this way and its `exit 1` was nearly misread as a *second*
dead build — i.e. **the instrument's own defect imitated the finding it was built to detect.** This is the
general `|| echo 0` trap: a fallback that emits a value which is also a legitimate observation.

**2. Scope by CWD, never by argv — `pgrep -f` on *ninja* is UNSOUND for this question, not merely risky.**
A worktree path is absent from **ninja's** argv, which is bare (`/usr/bin/ninja -f build-Release.ninja`,
a *relative* `-f` filename) — its worktree identity lives only in CWD. (Compiler children are different;
see the SCOPE table below.) So `pgrep -f 'ninja.*wt-<name>'` can never match a live ninja and
returns 0 for *every* worktree — a false zero that reads as "dead" for healthy builds too. (On the
fixer's edge a hook blocked `pgrep -f` for exactly this reason; **the block was correct**, and the guard's
reasoning was the instrument actually needed.) Sound form:
```bash
for p in $(pgrep -x ninja);   do readlink /proc/$p/cwd; done | grep -c "wt-<name>/build"
for p in $(pgrep -x cc1plus); do readlink /proc/$p/cwd; done | grep -c "wt-<name>"
```
This is what distinguished "two live ninjas, both in worktree A, **zero** compilers in B" from "both
building".

⚠ **SCOPE — the unsoundness is specific to matching `ninja`, NOT to argv-matching in general.**
Corrected 2026-08-10 after `slang-fixer` re-derived it on its own edge and narrowed its own first claim
(the over-general version — "a build's argv carries no worktree path" — was what it originally sent, and
what this leaf briefly recorded):

| process | argv | worktree identity | why argv-matching fails |
|---|---|---|---|
| `ninja` | bare: `/usr/bin/ninja -f build-Release.ninja` (a **relative** `-f` filename) | **CWD only** | **blind** — `pgrep -f 'ninja.*wt-<name>'` can never match ⇒ false zero for healthy builds |
| `cc1plus` | **does** carry absolute source/output paths, so an argv match **would** hit | argv *and* CWD | **noisy** — transient children; count swings 0→9→6→3 mid-build, and the ninja pid never appears |

⇒ Both are worse instruments than CWD-scoping, but for **opposite** reasons — blindness vs sampling noise.
CWD-scoping is sound *and* noise-free for both. A reviewer on an edge where ninja happens to be invoked
with an absolute `-f` path would find the over-general sentence false.

⚠ **Provenance:** measured by `slang-fixer` on its own edge (2 live builds, argv and CWD read from
`/proc`). Main independently reproduced the `pgrep -xc` trap above but could **not** re-verify the
argv/CWD claim (no `ninja` running on that edge), so it stands as single-edge. The argv-vs-CWD
*mechanism* is generic; the per-process specifics in the table are not. Re-derive before relying on them.

**Recovery confirmed cheap again:** restarting B with `nohup cmake --build --preset release &` resumed
from cache at **709 of ~2750 edges remaining**, nothing lost.

⭐ **RECALL TIMING — why this leaf went unread for 3 days by two agents who both needed it.**
A *subject-matter* recall does not surface it. The fixer's Step-2 recall searched SPIR-V / AttributedType
terms and returned 5 genuinely useful hits while never touching "delegated build" / "ninja" /
"subagent reaped"; Main dispatched into a build-heavy task without surfacing it either. ⇒ **Grep the store
for the OPERATION you are about to perform, immediately before performing it — not only for the topic you
are reasoning about.** A topic-scoped search that returns plausible results is structurally unable to see
an operation-scoped lesson, which makes it the same false-zero class as a too-tight regex.

⚠ **Partial mitigations must be stated as partial.** On #12441 only worktree B was re-parented under the
agent's own session (`nohup` + marker); worktree A was left subagent-owned because it was ~2/3 through a
~2h build and re-parenting would have cost more than the exposure. A was therefore covered by the
*liveness monitor*, not by structural safety. Say which builds are hardened and which are merely watched;
"hardened" over a mixed set is a false claim.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786069823574-a-delegated-slang-build-dies-silently-when-its-sub.md`_
