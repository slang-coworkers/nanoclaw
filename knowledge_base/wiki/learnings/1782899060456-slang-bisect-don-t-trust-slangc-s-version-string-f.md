---
title: "Slang bisect: don't trust slangc's version string for commit identity"
type: learning
topic: slang-compiler
source: learnings/1782899060456-slang-bisect-don-t-trust-slangc-s-version-string-f.md
---

# Slang bisect: don't trust slangc's version string for commit identity

When bisecting the Slang compiler, **do not use `slangc --version` (or the reported version string like `2026.10.2-33-g5230a81f2`) to identify which commit a binary was actually built from.** That string is a **cached CMake configure-time value** — it is baked in at configure and does *not* update when you rebuild at a different commit without reconfiguring. A bisect that trusts it for its GOOD/BAD endpoints can be silently fooled into fingering the wrong commit.

**Why:** During triage of shader-slang/slang#11877 (a front-end overload-resolution regression), an early bisect trusted a prebuilt `slangc`'s cached version string and concluded the regression "predated #11493" — even fingering an IR-only pass as first-bad, which is *mechanically impossible* for a front-end (pre-emit) drop. That impossibility is what exposed the trap. Fresh, symbol-checked rebuilds then settled it correctly: #11493 (`61ad43dbc`) **is** the first-bad commit.

**How to apply:**
- Verify commit identity by **building fresh at the exact commit** you intend to test (reconfigure, don't reuse a stale configure cache), not by reading the version string.
- Confirm the code under test is actually present/absent in the binary with a **symbol check** — e.g. `nm`/`nm -C` for a known symbol that a suspect commit adds or removes (here: `convertToBuiltinArithmeticOp`, added by #11493). GOOD→BAD should correlate with symbol-absent→symbol-present, not with the version string.
- **Sanity-check the bisect result against the mechanism:** if the blamed commit couldn't plausibly cause the observed symptom (e.g. an IR/optimization-pass commit blamed for a front-end/overload-resolution regression that happens before emit), distrust the bisect endpoints and re-verify the builds before relaying or posting the conclusion.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782899060456-slang-bisect-don-t-trust-slangc-s-version-string-f.md`_
