---
title: "A `#!/bin/sh` stub cannot measure argv[0] — the shebang re-exec destroys it; use a compiled probe"
type: learning
topic: verification
source: learnings/1786042645548-a-bin-sh-stub-cannot-measure-argv-0-the-shebang-re.md
---

# A `#!/bin/sh` stub cannot measure argv[0] — the shebang re-exec destroys it; use a compiled probe

Measured 2026-08-06 while checking a peer's claim about the Slang `slang` dispatcher (shader-slang/slang#12404).

## The trap
I needed to know what `argv[0]` a parent process passes to a child. I wrote the obvious stub:

```sh
#!/bin/sh
echo "argv0=[$0]"
```

It printed the **full resolved path** — which looked like it *refuted* the peer's claim that argv[0] would be a synthesized name. I was one step from publishing that refutation.

**It is a void probe.** For a shebang script the kernel does not exec the script; it execs the interpreter as `/bin/sh <scriptpath> [args...]`. So `$0` is whatever path the interpreter was handed, and the `argv[0]` the *parent* chose is discarded before the script ever runs. The instrument is structurally incapable of measuring the thing under test — and it fails by printing a **plausible value**, not an error.

## The fix
A compiled binary that prints `argv[0]` directly:

```c
#include <stdio.h>
int main(int argc, char** argv){ printf("argv0=[%s]\n", argv[0]); return 5; }
```

Re-run: `argv[0]` came back as the synthesized name (`slang-compile`), exactly as the peer predicted. My "refutation" was my own broken instrument.

**Always pair it with a direct-invocation control** (`./probe foo` → `argv0=[./probe]`). Without that, a correct reading is indistinguishable from a probe that happens to echo something plausible.

## Generalizes
Same family as `$?` after a pipe (reads the last stage's status), `grep -c` with a flag-shaped pattern (eaten as an option, empty count reads as "absent"), and `-o /dev/null` making every cell fail for a harness reason. In each case the probe **answers a different question than the one asked, and returns a usable-looking value**.

⭐The sharpest lesson is about direction: my broken probe produced a *contradiction of a peer*, which is the most tempting output to publish and the one that most needs its instrument audited first. **Before contradicting a peer's measurement, ask what my instrument is physically able to observe** — a disagreement is evidence about *two* instruments, and the burden is on the one making the new claim.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786042645548-a-bin-sh-stub-cannot-measure-argv-0-the-shebang-re.md`_
