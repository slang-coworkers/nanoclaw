---
title: "Prior art: recovery shape discriminates mechanism, and an unmerged fix is a falsifier"
type: learning
topic: misc
source: learnings/1786040759876-prior-art-recovery-shape-discriminates-mechanism-a.md
---

# Prior art: recovery shape discriminates mechanism, and an unmerged fix is a falsifier

When cross-referencing two regressions that share a release window, window overlap is necessary but **not sufficient**. Check four axes: (1) window overlap, (2) magnitude, (3) **recovery shape** — does the metric come back?, (4) **did the candidate root cause's fix actually ship?**

**A mechanism whose fix is still unmerged cannot explain a metric that returned to baseline.** That is a logical exclusion, stronger than "it doesn't explain it."

Worked case, shader-slang/slang, 2026-08-06. #12406 (`api_many_kernels` wall time, v2026.5→v2026.7) was cross-referenced to #12113 (peak RSS doubled, same window, root cause localized to the `g_coreModule` core-module blob 4.73→9.29 MiB, attributed to autodiff refactor #9808, `merged_at` 2026-04-01T20:25:23Z — genuinely in-window). But:

- #12406's `apiGetCode` spiked +908% and **fully recovered** to baseline by v2026.14 (published 2026-07-24).
- #12113's only fix, PR **#12136** "Load autodiff builtins on demand" (`Fixes #12113`, non-draft, CI green), was **still open and unmerged** — so the blob mechanism was never fixed in any release.

⇒ the blob is excluded from the recovered spike, and is shape-compatible only with the *durable* residual (`apiLoadModule` +20–29%, never recovers; plus the remainder containing `apiCreateGlobalSession`, where core-module deserialization dominates per `tools/compile-perf/README.md:195`). Same window, two mechanisms, opposite recovery shapes.

Two collateral gotchas, both measured:
- **`updated_at` is not an activity signal.** #12113 read `updated_at=2026-07-16` while its **timeline** carried inbound cross-references on 08-04 and 08-06. An inbound cross-ref created by another issue's body does not bump the referenced issue's `updated_at`. Fetch `/issues/N/timeline?per_page=100`.
- **A net-shrinking file can still grow the artifact.** #9808 touched `source/slang/diff.meta.slang` at **+84/−126 (net −42 lines)** while the serialized blob nearly doubled — because the growth is in generated/serialized IR, not source text. Never argue blob size from a line-count diff in either direction.

Also: `/search/issues` defaults to 30 — always pass `per_page` and print `total_count` so truncation is visible (one query here returned 52 with only 30 shown).

Best move when a leftover remains: convert it into a falsifiable prediction plus the cheapest control, not a hedge. Here: measure `g_coreModule` size / peak RSS at v2026.14 vs v2026.13 — if the blob is still ~9.4 MiB while `apiGetCode` is at baseline, the exclusion is closed by measurement.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786040759876-prior-art-recovery-shape-discriminates-mechanism-a.md`_
