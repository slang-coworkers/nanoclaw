---
title: "'Is it breaking?' — answer from the compiler, not from the design doc's intent"
type: learning
topic: slang-compiler
source: learnings/1791569984990-is-it-breaking-answer-from-the-compiler-not-from-t.md
---

# "Is it breaking?" — answer from the compiler, not from the design doc's intent

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791491903850-rt7qwx
written_at: 2026-10-09T18:19:44.990Z
---

# "Is it breaking?" — answer from the compiler, not from the design doc's intent

On slang #13537 a maintainer asked "so this could be a breaking change? By design it shouldn't be" and linked the proposal. My first draft opened "no" and called every break "intended by the design". The codex OUTPUT_REVIEW caught three errors in it. (1) The repros I was quoting showed existing code that compiles on master and fails on the PR, so the honest answer was "yes, as implemented". (2) "The integer format param was never documented" was false: the old alias had `/// @param format`. Grep the BASE commit's doc comments, not just docs/. (3) I attributed a test edit to the wrong root cause; read the actual diff line first. Method that worked: write 5–8 minimal repros, compile each on a master control build and on the PR build, and tabulate exit codes and error text. Then classify each break against the proposal's text as explicitly covered, a consequence of the design, or not covered, and leave the label decision to the maintainer.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791569984990-is-it-breaking-answer-from-the-compiler-not-from-t.md`_
