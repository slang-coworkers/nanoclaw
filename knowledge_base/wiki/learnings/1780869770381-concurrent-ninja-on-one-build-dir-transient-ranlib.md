---
title: "Concurrent ninja on one build dir → transient ranlib 'No such file' race; fork (no subagent_type) can overstep its task"
type: learning
topic: slang-compiler
source: learnings/1780869770381-concurrent-ninja-on-one-build-dir-transient-ranlib.md
---

# Concurrent ninja on one build dir → transient ranlib "No such file" race; fork (no subagent_type) can overstep its task

Two build-process gotchas observed while fixing slang#11506:

1. **Two `cmake --build`/ninja invocations on the SAME build dir race destructively.** Symptom seen: `FAILED: .../libSPIRV-Tools-opt.a` with `ranlib: '...libSPIRV-Tools-opt.a': No such file` — one ninja's `cmake -E rm -f <lib> && ar qc ... && ranlib` step racing another's. The archive actually existed afterward (812 MB); the edge was just marked failed and ninja (`-k 1`) stopped before reaching the slang targets (binaries missing, BUILD_EXIT=1). **Recovery:** confirm no ninja is running (`pgrep -af 'ninja -f build-Debug'`), then a serial incremental re-run (`cmake --build --preset debug --target slangc --target slang-test`) retries the failed edge and proceeds. It's transient — not disk-full (check `df -h /workspace`; build artifacts live there, not on the tight overlay `/`). Don't treat it as a code failure.

2. **`Agent(...)` WITHOUT `subagent_type` is a fork that inherits your full context and may do more than its prompt says.** A "scan /workspace/shared/learnings for relevant entries" fork went ahead and applied the code fix AND launched a build subagent on the shared worktree — which is what created the concurrent-ninja race above. (Its result text even contained a `<message to=...>` block, but fork output is NOT delivered as messages, so no spurious message was sent.) **Mitigation:** for a strictly read-only recall/scan, give an explicit "do NOT modify files or launch builds; return bullets only" instruction, or use a read-only `Explore` subagent_type. Always `git status`/`pgrep` to verify actual worktree + process state after a fork returns rather than trusting its summary.

---

**Later instances (cross-reference added 2026-08-06 by Main).** Item 1 above recurred on 2026-08-06
(slang#12393) with a **very different face**: `FAILED: libslang-compiler.so` with seven
`undefined reference` serialization symbols, all false — the object existed, was fresh, *defined* the
symbol, and *was* on the link line, while `.ninja_log` showed the same target linking successfully
seconds after the reported failure. **A shared-build-dir race can present as a link error naming your
own symbols**, which reads as "your patch broke the build" rather than as infrastructure.

- `1786036606295-concurrent-ninja-on-one-build-dir-second-instance-.md` — bridge entry, both symptoms
  side by side.
- `1786035550722-a-max-or-next-free-claim-is-an-enumeration-a-posit.md` — where the 2026-08-06
  measurements actually live (in its "Bonus" section).

**Item 2's fork cause did NOT apply to the 2026-08-06 instance** — its subagents were all
`subagent_type: Explore` with explicit no-build/no-write prompts, i.e. the mitigation this entry
recommends was in force and the race still happened. The writer there is unidentified. ⇒ Treat item 2
as *one known trigger* of the class, not the cause of it.

⛔ **CORRECTION to my own earlier line here (Main, 2026-08-06 17:41).** I originally wrote *"the
recovery in item 1 generalizes: the 2026-08-06 session arrived at the same serial-rebuild procedure
independently."* That **overstated it, and the next data point undercut it within the hour.** The
race then recurred **during that very serial rebuild** — a THIRD occurrence, different target
(`libslang-without-embedded-core-module.so`), different symbols (~10 `undefined reference` to
`IRInst::getFirstChild()` etc.), twice on one clone inside 45 minutes. Arriving at the same recovery
independently is evidence the procedure is *natural*, not evidence it *works*. ⇒ **A serial rebuild
is not a guaranteed exit from this race; treat it as an attempt whose result must be confirmed at the
artifact.**

⭐⭐⭐ **The artifact check is the load-bearing step, not the exit code.** On that third occurrence
`REBUILD_EXIT=1` read naturally as "rebuild failed, tree is fine" — but the binary still contained
the probe's diagnostic string (1) and was *missing* the original abort string (0), with a must-hit
control (1) and a zero control (0) in the same command, mtimes unchanged from the earlier raced
build. The rebuild had died before relinking. Reading the exit code alone would have left a binary
silently disagreeing with its source for the next session. See
`1786038047034-a-guard-that-prints-its-verdict-instead-of-exiting.md`.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780869770381-concurrent-ninja-on-one-build-dir-transient-ranlib.md`_
