---
title: "Two concurrent cmake --build runs on one tree corrupt static archives — `ranlib: malformed archive` is a race, not a bad patch"
type: learning
topic: ci-tooling
source: learnings/1786044235419-two-concurrent-cmake-build-runs-on-one-tree-corrup.md
---

# Two concurrent cmake --build runs on one tree corrupt static archives — `ranlib: malformed archive` is a race, not a bad patch

A slang build failed with:
```
FAILED: external/spirv-tools/source/opt/Debug/libSPIRV-Tools-opt.a
/usr/bin/ranlib: external/spirv-tools/source/opt/Debug/libSPIRV-Tools-opt.a: malformed archive
```
Nothing was wrong with the source. **Two `cmake --build --preset debug` invocations were running on the same build dir**, and two `ar qc` processes appended to the same archive concurrently.

**How it arose (the trap):** a build delegated to an `Agent` subagent had its `ninja` reaped when the subagent's turn ended (`ninja: build stopped: interrupted by user`). I relaunched detached with `setsid`. But the subagent was **still alive** and retried on its own ~48 s later ⇒ two writers. Both "fixes" were individually reasonable; together they raced.

**Diagnosis, in order:**
```bash
pgrep -ax ninja                 # >1 on the same -f build-Debug.ninja = race
ar t <archive> | wc -l          # members vs expected object count
ls -la <archive>                # SIZE IS THE TELL
```
The size discriminator is decisive: the archive read 54 MB, then **754 MB** minutes later for the same 120 objects. A plausible-looking member count (120, matching the `.o` count) did **not** reveal it — only the size did. Checking objects individually was a dead end: all 120 `.o` files were valid ELF and non-empty, because the corruption was in the *archive*, not its inputs.

**Recovery:** kill every builder, `rm -f` the bad archive (ninja relinks it), relaunch **one** writer. Sibling archives were intact — verify with `ar t <a> >/dev/null` over recently-modified `.a` files rather than assuming.

**Prevention:** before relaunching any build, assert no builder is already running — and remember that stopping a subagent's *child* does not stop the *subagent*, which may retry. Kill the task, then the processes, then check `pgrep` is 0, and only then launch.

⚠ `pgrep -fc 'cmake --build'` returned 2 after everything was dead — it was matching **my own probe's shell command line**. Match on the executable (`pgrep -cx ninja`) or exclude the probe; a `-f` pattern that appears in your own command line can never reach 0.

Harmless follow-on: after killing ninja mid-flight the next run prints `ninja: warning: premature end of file; recovering` for its deps log and proceeds normally.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786044235419-two-concurrent-cmake-build-runs-on-one-tree-corrup.md`_
