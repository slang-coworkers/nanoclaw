---
title: "Slang local build: ninja skips rebuild after git checkout (source mtime < object); zombie-PID waiter trap; parse SPIR-V without spirv-dis"
type: learning
topic: slang-compiler
source: learnings/1782871600830-slang-local-build-ninja-skips-rebuild-after-git-ch.md
---

# Slang local build: ninja skips rebuild after git checkout (source mtime < object); zombie-PID waiter trap; parse SPIR-V without spirv-dis

Three operational traps hit while reproducing a Slang bug at HEAD (2026-07-01), all cost real time:

1. **ninja skips the rebuild even though source content is at HEAD.** A `git checkout`/reset updates file CONTENT but can leave source mtimes EARLIER than the existing `.o` files (objects built later from an older commit). ninja compares mtimes → sees object newer than source → "nothing to do". Symptom: `cmake --build ... --target slangc` runs only the version-header step and the binary keeps old behavior; `slangc -v` shows the OLD `git describe` (compounded by the known stale-`-v` cache trap — real version is `git describe --tags` in the repo, not the binary string). FIX: force-touch the files that actually changed, then build:
   `git diff --name-only <object-build-commit>..HEAD -- source include prelude tools | while read f; do [ -f "$f" ] && touch "$f"; done`
   (the object-build commit is the sha in the stale `slangc -v`.) Then `cmake --build --preset release --target slangc`. Verify the target `.o` mtime is now newer than your touch.

2. **`until ! kill -0 $PID` never exits on a zombie.** A finished background build process can become `<defunct>` (Z state) if unreaped; `kill -0 <pid>` still returns success for a zombie, so a PID-based waiter loops forever. Symptom: waiter/Monitor times out while `ps -o stat -p $PID` shows `Z`. Don't wait on the PID — append an explicit terminal marker to the log (`... && echo BUILD_SUCCESS >> log || echo BUILD_FAIL >> log`) and wait on `grep -q "BUILD_SUCCESS\|BUILD_FAIL" log`.

3. **spirv-dis/spirv-opt not built → can't get `-target spirv-asm`** (E00100 "failed to load downstream compiler 'spirv-dis'/'spirv-opt'"; only CMakeFiles stubs exist under build/external/spirv-tools/tools/). To inspect binding/descriptor decorations anyway: emit BINARY spirv directly, skipping spirv-opt with `-O0`: `slangc x.slang -target spirv -entry main -stage <s> -O0 -o x.spv`, then parse the SPIR-V words in Python (magic 0x07230203; OpName opcode 5 maps id→name; OpDecorate opcode 71, Binding=decoration 33, DescriptorSet=34). This gives exact Binding/DescriptorSet per named var without any external tool.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782871600830-slang-local-build-ninja-skips-rebuild-after-git-ch.md`_
