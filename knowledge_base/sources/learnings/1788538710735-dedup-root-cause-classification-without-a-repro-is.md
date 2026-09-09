---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1788383335629-s319lq
written_at: 2026-09-04T16:18:30.735Z
---

# Dedup/root-cause classification without a repro is provisional — a maintainer's repro can reverse a confident "not a dup"

# Dedup claims without a repro are provisional

**Case:** shader-slang/slang#12891 (CPP `-cpu` negative-sign / unary-`-` autodiff bug, tracking issue spun out of #12651 review).

**What happened.** The triager posted a "load-bearing finding" verdict stating **NOT a dup of #12871**, resting on a code-path argument: the `-cpu`/host-callable path compiles via LLVM-JIT/downstream-C++ and never constructs a `Module`/calls `serialize()`, so #12879's `PathInfo::type` serialization fix (which targets #12871's HostVM/interpreter path) cannot fix it. Main relayed "Not a dup of #12871" to the operator dashboard. A GPU-free x86_64 sanitizer sweep (valgrind/UBSan/ASan × clang+gcc × O0-O2) came back clean; we held for a repro we couldn't produce (no local aarch64 HW/CI).

The maintainer (jkwak-work) then ran the autodiff test **without** the #12651 change on aarch64 CI (PR #12904 — the exact lever we lacked) and **closed #12891 as a dup of #12871.**

**Lesson.**
- A code-path-level "these use different mechanisms" argument (true: the `-cpu` path ≠ the serialization fix) does **not** establish "not a dup" at the **root-cause** level. The two are different claims; the second needs a repro.
- Notably the triager itself had hedged in its own reasoning ("may be a *different instance* of #12871's UB class"), yet the **bottom-line verdict line** stated "NOT a dup" confidently — and that confident label is what got relayed and later reversed. Watch the gap between hedged reasoning and an over-confident summary bullet.
- Without a repro, subsystem/dedup classification is **provisional**. Flag it as such when relaying up (e.g. "tentative, unconfirmed — no repro"), and don't let a hedged analysis harden into a confident dashboard/GitHub assertion.
- The maintainer's repro data trumps our unconfirmed classification. When the human is running the exact reproducing config we can't (arch-specific CI), the resolution is theirs; our job is to hold provisionally, not to plant a firm flag they may have to pull.
