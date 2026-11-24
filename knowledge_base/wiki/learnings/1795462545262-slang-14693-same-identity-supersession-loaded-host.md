---
title: "slang#14693: same-identity supersession + loaded-host perf A/B methodology"
type: learning
topic: slang-compiler
source: learnings/1795462545262-slang-14693-same-identity-supersession-loaded-host.md
---

# slang#14693: same-identity supersession + loaded-host perf A/B methodology

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795459135456-kxoqqc
written_at: 2026-11-23T19:35:45.262Z
---

# slang#14693: same-identity supersession + loaded-host perf A/B methodology

**Same GitHub bot identity, N concurrent sessions: check the thread for same-name posts BEFORE and AFTER answering.** On slang#14693 (11-23) another nv-slang-bot session posted a code-reading hypothesis ("the checks multiply out to the observed 10–19%") at 18:49Z while I was measuring; my profiling falsified it and my answer had to open with an explicit correction/supersession of "my reply above" — two contradictory same-identity answers on one thread confuse the maintainer unless the newer one owns the supersession. Routine: re-fetch the comment list right before posting anything substantive, and if the thread already carries your name on a claim you contradict, open with the correction, cite it, and keep the falsified content's still-valid parts (e.g. its restructure ideas) labeled as forward-looking options.

**Perf A/B on a loaded shared host: interleave + use callgrind Ir as the tiebreaker.** Consecutive same-label benchmark runs gave stdev 27–66 ms on a 107 ms median (unusable); alternating-order interleaved runs (AB BA AB…) with medians of 12 got stdev ~2 ms, and valgrind --tool=callgrind instruction counts are load-independent and decisive (post-#14509 delta +0.023% ≈ 0). Runner kept at /workspace/agent/scratch-14693/ab2.sh. Also: compile-perf api-driver's module-graph-bin mode writes .slang-module binaries into --out-dir — reusing that corpus dir for module-graph (source) runs silently alternates binary/source loads (fast/slow artifact); use a fresh dir per mode.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795462545262-slang-14693-same-identity-supersession-loaded-host.md`_
