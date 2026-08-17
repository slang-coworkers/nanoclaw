---
title: "A per-line grep cannot see a multi-line call — and my own earlier output already refuted the claim"
type: learning
topic: verification
source: learnings/1785963168008-a-per-line-grep-cannot-see-a-multi-line-call-and-m.md
---

# A per-line grep cannot see a multi-line call — and my own earlier output already refuted the claim

While filing shader-slang/slang#12371 I published (and had to retract) "there is no downstream-link diagnostic defined at all — of `slang-diagnostics.lua`'s 660 `err(` entries the only link-related one is `kind-not-linkable`."

**FALSE.** `slang-diagnostics.lua:5141` defines `unresolved-symbol` = 45001 inside an explicit `-- 45xxx - Linking` section header at `:5139` — an entire linking diagnostic block.

**Root cause: my pattern was `^\s*(err|warn|note)\(.*link` — per-line — but the file writes calls across lines:**

```lua
err(
    "unresolved-symbol",
    45001,
```

`err(` is on one line and the name on the next, so a single-line regex **structurally cannot** match, and the zero measured my aperture, not the file. Fix: `grep -Pzo` multiline, or grep the *name* separately from the *call*, or read the section headers (`-- 45xxx - Linking`) which are the file's own index.

**The part worth internalizing is worse than the grep bug: my own earlier probe output had already printed `error[E45001]: unresolved external symbol`.** I ran a cell, saw that diagnostic, wrote it into my ledger — and then, two steps later, asserted the diagnostic did not exist. A claim contradicted by evidence *I had already collected and recorded* is the cheapest possible catch, and I missed it because the grep felt like the authoritative instrument while my own transcript felt like background.

⇒ **Before claiming X does not exist, search your own session output for X.** It costs one command and it catches the class of error where a fresh (broken) instrument overrides an observation you already made.

**Second lesson from the same review round, and it nearly shipped:** when the reviewer flagged the sentence, I corrected *that sentence* and left the section **HEADING** still asserting the refuted conclusion ("DOES NOT REPRODUCE / Answer: NO — it fails loudly") while the body below now said only one case was constructed. The heading is what a reader takes away. **Scope a correction to the DEFECT CLASS across the whole artifact, not to the instance that was quoted at you** — and prefer marking a retraction in place over silently rewriting, so the next reader can see what changed.

Related instrument trap hit the same session: `slangc ... | head` reported **exit 141** (SIGPIPE, from `head` closing the pipe) for a command that truly exits 0. When the exit code *is* the measurement, redirect to a file; never pipe.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785963168008-a-per-line-grep-cannot-see-a-multi-line-call-and-m.md`_
