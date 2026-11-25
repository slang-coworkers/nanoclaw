---
type: chain
title: "slang#14693 — MDL perf: apiLoadModule 1.10-1.19x regression since 11-21 (suspect #14509) — TOT-scan find, filed-only"
description: RECOVERED 2026-11-23 — the apiLoadModule "regression" self-recovered on the 11-23 nightly (run 45116441940 green at head ced08cd4) with NO perf-relevant code change on the suspect path (only CI/parser-side merges since first-red). Re-attributed to a degraded nightly runner lifting the whole sample distribution (which also explains the rerun-minima signature). Recovery + re-attribution comment posted 11-23 (7106560618); close left to maintainers unless the signature returns. Filed 11-22 as #14693 after two-night + rerun-minima evidence; the original window analysis stands in the issue for the record.
tags: [slang, mdl-perf, apiLoadModule, perf-regression, tot-scan, filed-only]
---

# slang#14693 — MDL perf apiLoadModule regression (11-21/22)

- **What:** Nightly MDL Perf Test `api_module_graph_bin/apiLoadModule` flagged two consecutive nights:
  11-21 run 44869688840 (head 0a87e896) 1.10x 84.8→93.7ms; 11-22 run 44988301006 (head 411af9b9) 1.19x
  84.8→101.1ms — analyze step "1 confirmed regression(s)", artifacts perf-confirmation-44988301006-1.
  apiTotal warns 1.10–1.14x both nights. Real-shift evidence: rerun samples [103.0, 95.8, 93.0, 101.1,
  103.3] — minimum ~10% above baseline median (noise-floor cases have minima AT baseline).
- **Suspects (window ef93f4b7d 11-20 → 0a87e896 11-21):** #14509 integer constant-folding overhaul
  (skiminki-nv, primary — front-end on the module-load path); #14630 sized/unsized buffer types
  (secondary); #14452/#14636 low. 11-22 adds only #14674 (CI tiering, perf-neutral) — persisted.
  Attribution = window reasoning; 4-commit window is bisectable.
- **Dedupe:** #12406 (old ~5× API-path regression, apiLoadModule never recovered) CLOSED 09-14 —
  referenced in the issue for history, not a duplicate.
- **Filed:** 11-22 ~08:2xZ, #14693 (reproduced + Type Bug). Fix = bisect + the owning PR's author;
  no fixer chain started (perf bisect is maintainer terrain or operator-GO'd work — held).
- **11-23 18:37Z — maintainer ping (jhelferty-nv, comment 7110425466):** "I believe these changes
  were necessary. Can you propose whether there is a more efficient way to restructure those
  checks for performance to address the performance regression?" → dispatch `slang-fixer` on the
  canonical thread, MODE proposal-first. Escalated to the operator (fixer-chain fan-out).
- **11-23 19:35Z — fixer chain COMPLETE, verdict posted ([comment 7111816336](https://github.com/shader-slang/slang/issues/14693#issuecomment-7111816336)):**
  **no restructuring warranted — #14509's checks are not what regressed.** Local A/B on the
  nightly's exact workload (Release builds dbdcb1e6b/f0b143178/ef93f4b7d/0a87e896, compile-perf
  api_module_graph_bin, interleaved 12 runs/side): #14509 pairing +1.4% overlapping spreads
  (pre-registered ≥5% bar never met), full window opposite-sign; callgrind whole-window Ir
  +0.023%, fold machinery (tryFoldImpl/MathIntOps/narrowValueToConstantType) at 0.00%; bin-load
  counter runs no front-end folding, corpus is float-only. Best explanation: degraded nightly
  runner (matches 11-23 green recovery, no code change). Main verified the comment live before
  relaying. The 18:49Z hypothesis comment (7110703992) was corrected in place by the 19:35Z
  comment. **Attribution UNRESOLVED** — no visible session claims it: ncl transcripts record no
  bash gh writes, so transcript greps cannot attribute GitHub posts (only an inbound
  webhook/reason would show, and none does); every session live at 18:49:24Z was grepped clean.
  Verified solid: the ONLY sessions with any 14693 presence are Main (sg4j0w, no posts) and the
  fixer's 18:38–19:35 turn — no live unowned poster exists. A 4th bot comment, the 16:04Z
  green-recovery update (run 45116441940), likewise predates the mention window and is
  unattributed (likely the TOT-scan chain-of-record; benign, consistent with the filing).
  Durable rule (fixer's learning): re-fetch the thread right before posting; own the
  same-identity supersession explicitly.
- **Parked on jhelferty-nv's response** (close-as-environmental is the fixer's recommendation;
  closing is maintainer-only). One-shot re-check scheduled: task `recheck-14693-jhelferty-c13e`,
  process-after 2026-11-26 19:45Z (no recurrence). Future mentions route via webhook normally.
  Re-run path if the counter re-flags: fixer's saved A/B (scratch-14693/ab2.sh + lib-* builds,
  worktree wt-slang-14693) re-runs in ~5 min.
- **Also from the same scan (NOT filed):** CMake Options weekly red — deterministic C1001 at
  slang-emit-hlsl-prelude.cpp(468) on all 33 windows-aarch64 legs (MSVC 14.52 image 20261116.315.1);
  same toolchain family as the 11-20 Release ICE. #14642 moved release.yml to a native-ARM64 runner
  (green) but cmake-options.yml didn't get the change → red every Saturday until it does. Routed to the
  operator as an extension of the #14471/#14499 toolchain-pin conversation, no new issue.

# Citations
- https://github.com/shader-slang/slang/issues/14693
- https://github.com/shader-slang/slang/actions/runs/44988301006
- https://github.com/shader-slang/slang/pull/14509
- https://github.com/shader-slang/slang/issues/12406
