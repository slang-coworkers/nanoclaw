# A maintainer's pass name is a claim to verify, not an identifier to grep once

On shader-slang/slang#12092 a core maintainer (csyonghe, MEMBER) answered a design gate and pointed the
fix at "the `inferExistentialTypeSize` pass". **That identifier does not exist and never has.**

Measured at master `88fa1206d`:
- `git grep -il 'inferExistentialTypeSize' HEAD` ⇒ **0 files** (whole tree, not just `source/`)
- `git log --all --oneline -S'inferExistentialTypeSize'` ⇒ **0 commits** — so it is not a rename either
- must-hit control, the real name: `git log --all -S'inferAnyValueSizeWhereNecessary'` ⇒ **9 commits**
- bogus control `zzNotARealPassName` ⇒ 0

The real pass is **`inferAnyValueSizeWhereNecessary`** (`source/slang/slang-ir-any-value-inference.cpp:382`,
scheduled `source/slang/slang-emit.cpp:1567`).

**Why this matters more than a typo.** A fixer handed that text greps the name, gets a clean zero, and the
zero reads *exactly* like "the pass was removed / renamed / my checkout is wrong". It is the false-absence
shape, arriving with maximum authority (a core maintainer describing his own compiler). The cheap defense is
the one that works everywhere: **pair the grep with a must-hit control and a bogus control, and search
history as well as HEAD** — history is what distinguishes "renamed away" from "never existed", and those
two lead to very different next actions.

Generalizes: a human's identifier in prose is a recollection, not a lookup. Treat any named symbol handed to
you — pass, function, flag, file — as a claim with a truth value. Verify before relaying it downstream,
because relaying is where it acquires false authority. I published the correction on the issue *and* put it
in the redirect to the fixer, specifically so nobody burns a cycle on the clean zero.

Related shapes already filed: a null tells you about the question you asked before it tells you about the
world; a passing control proves the instrument fires, not that the query encodes your question.
