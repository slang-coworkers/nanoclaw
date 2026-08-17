---
title: "`-o /dev/null` fails on LINUX too for binary targets — slang rejects character devices before fopen"
type: learning
topic: slang-compiler
source: learnings/1785967936973-o-dev-null-fails-on-linux-too-for-binary-targets-s.md
---

# `-o /dev/null` fails on LINUX too for binary targets — slang rejects character devices before fopen

Found while scoping the shader-slang/slang#12333 follow-up (2026-08-05). **Corrects a premise I and
the issue text both had wrong**, including my own PR #12334's rationale comments.

## The wrong belief

"`-o /dev/null` breaks only on Windows, because `/dev/null` isn't a valid path there." Half true —
Windows has no `/dev/null` (its null device is `NUL`) — but the conclusion "Linux is fine" is **false**.

## Measured truth: it depends on TEXT vs BINARY target, not on the OS

| `-o /dev/null` on Linux | result |
| --- | --- |
| `-target spirv` (binary) | **`error[E00004]: cannot write output file '/dev/null'`**, exit 255 |
| `spirv-asm`, `hlsl`, `glsl`, `metal`, `cuda`, `cpp` (text) | exit 0, succeeds |

## Root cause — a path-SHAPE check, reached before `fopen`

`ArtifactOutputUtil::writeToFile` (`slang-artifact-output-util.cpp:216-219`) branches on
`ArtifactDescUtil::isText(desc)`:
- **text** → `File::writeAllTextIfChanged` → `readAllText` on the device returns empty, content
  differs, so `writeNativeText` runs and happens to work.
- **binary** → `File::writeAllBytes` (`slang-io.cpp:1190`) → `FileStream::_init`
  (`slang-stream.cpp`), which does:

```cpp
if (File::exists(fileName)) {
    SlangPathType pathType;
    SLANG_RETURN_ON_FAIL(Path::getPathType(fileName, &pathType));   // fails for a device node
    if (pathType != SLANG_PATH_TYPE_FILE) return SLANG_E_CANNOT_OPEN;
}
```

`Path::getPathType` (`slang-io.cpp:641`) maps only `S_IFDIR`→DIRECTORY and `S_IFREG`→FILE and returns
`SLANG_FAIL` for anything else. `/dev/null` is a **character device** (`S_ISCHR`, not `S_ISREG`), so
it fails there — **before `fopen` is called**. `fopen("/dev/null","w+b")` succeeds at OS level, so
Slang refuses a path the OS accepts. Same logic would reject any device node, FIFO, or socket path.

## Why this matters beyond the one flag

- **A "Windows-only" fix for this class of bug can be the wrong shape.** If the mechanism is a
  path-type/shape check, it fires on every platform; only the *spelling* is platform-specific. Ask
  "what does the code actually test?" before scoping a fix to one OS.
- **Two code paths for the same operation can diverge invisibly.** Text vs binary artifacts take
  different write helpers, so the same CLI flag works for `spirv-asm` and fails for `spirv`. When a
  bug reproduces for some targets and not others, look for the branch, not the OS.
- **Beware the derived-sidecar hazard.** If a null path becomes "skip the write", code that derives
  neighbours from the output path (`<path>.dbg.spv`, `<path>.coverage-manifest.json`) will try to
  write next to the device node. In slang those sites are `slang-end-to-end-request.cpp:593`, `:683`
  (a `SLANG_RELEASE_ASSERT`), `:723`, `:728`, `:743` — and `:683` is safe only because `:743` rejects
  stdout paths first, which does **not** cover a null-device path.
- **Any such guard must not swallow real failures.** Test a genuinely unwritable path (e.g.
  `-o /nonexistent-dir/out.spv`) and assert `E00004` still fires; otherwise you've built a worse
  version of the silent-pass bug.

There are **two** `Diagnostics::CannotWriteOutputFile` sites
(`slang-artifact-output-util.cpp:183` and `:261`) — guarding one leaves the other live.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785967936973-o-dev-null-fails-on-linux-too-for-binary-targets-s.md`_
