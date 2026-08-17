---
title: "[approver/infra-abstain] A duplicated script where only ONE copy has a distribution path diverges forever — my devin-fetch.sh decode fix is real, verified, and container-local (fleet-wide the bug is still live)"
type: learning
topic: review-approval
source: learnings/1785848201040-approver-infra-abstain-a-duplicated-script-where-o.md
---

# [approver/infra-abstain] A duplicated script where only ONE copy has a distribution path diverges forever — my devin-fetch.sh decode fix is real, verified, and container-local (fleet-wide the bug is still live)

## The situation

`devin-fetch.sh` exists in two skill copies that have diverged:

- `slang-pr-review-runner/scripts/devin-fetch.sh:222-224` — **decodes** the
  `agent-browser eval` output before parsing, with a comment naming the exact
  failure mode. Listed in `.external-skills.json` → `shader-slang/slang-skills@main`.
- `nanoclaw-pr-review-runner/scripts/devin-fetch.sh:149` — **did not decode.**
  **Absent** from `.external-skills.json`; its own SKILL.md says *"Local skill; no
  upstream sync."*

Consequence measured earlier: pages captured through the nanoclaw path land as a
JSON-quoted single line, so the newline-anchored section splitter finds nothing and
`devin-flags.md` ships an **empty `## Flags`** — a false-clean on the tier where
Devin is the sole review signal. Confirmed in 5 of 170 local artifacts, with
findings genuinely lost in slang#12246, slang#12324, slang-rhi#800, slang-rhi#801.

## The fix, and its verified scope

I ported the conditional decode into the nanoclaw copy (one hunk). Verified on real
artifacts, both arms:

- JSON-quoted page (#12246): 1 line → **309 lines**; splitter yields 2 parts and
  recovers the exact `Investigate`-severity finding that had been lost.
- Already-plain page (#12133): **26,479 → 26,479 bytes, byte-identical** — the
  `raw.startswith('"')` guard makes it idempotent, so it is safe on the ~91% of
  captures that are already plain.
- `bash -n` clean; end-to-end through the script's own extractor emits a populated
  Flags section.

**And it reaches nobody else.** `/home/node/.claude` is on `/dev/vda1` —
per-container disk, not a shared volume. A peer tier reports the same path at
**8,944 bytes, mtime Jul 26, zero `startswith` guards**, while mine is **9,313
bytes with the guard**: the same path holding different content in two containers
is direct proof it isn't shared. `/workspace/shared` is mounted **ro**, so it
can't be used to publish either. Not a git repo; no copy in the `slang-skills`
upstream.

## The actual defect class — propagation asymmetry, not duplication

I first called this "one copy repaired twice, the other zero times." That
understates it. The real shape:

> **The synced copy gets repairs that propagate. The local-only copy gets repairs
> that don't.**

Duplication alone would produce drift that any single fix could close. Duplication
where **only one copy has a distribution path** guarantees permanent divergence:
every repair to the orphan is per-container and dies with the container, so the
orphan's bug count only ever grows relative to the synced twin. That is why the
same script has *two* un-propagated fixes in it (see below), not one.

## Second un-propagated fix in the same file — do not bundle it

The slang copy's comment records a splitter rewrite for the 2026 Devin UI: *"the
legacy split was on `\n\s*\d+\s*Flags?\s*\n` which only matched the old combined
Flags toggle — the 2026 UI has separate `N Bugs` and `N Flags` lines, so we walk
both."* The nanoclaw copy still uses the legacy single split.

Keep it separate, for a reason stronger than scope: the two fixes have **different
test-data requirements.** My decode fix is verified on pages with a combined Flags
line; it will still under-read a page rendering separate Bugs/Flags sections.
Bundling them would let a pass on my corpus imply coverage it doesn't have.

## Rules

1. **Before treating a skill/script edit as shipped, ask where the file lives and
   what carries it.** Three states, and they demand different actions:
   *synced* (edit reverts silently — change upstream), *local-only in a shared
   mount* (edit reaches co-tenants), *local-only per-container* (edit reaches
   nobody — needs an upstream home or an operator action). Check
   `.external-skills.json` **and** `df`/`mount` on the path — the manifest answers
   the first question, the mount answers the second, and they're independent.
2. **`durable for me` ≠ `fixed`.** A verified change in a per-container path is a
   correct fix with a distribution bug sitting on top of it. Report both, and don't
   let the strength of the verification imply a reach it doesn't have.
3. **When you find a script duplicated across skills, check whether both copies
   have a distribution path** before proposing a fix to either. If only one does,
   the durable remedy is to give the orphan an upstream home (or delete it in
   favour of the synced copy) — not to patch it again.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785848201040-approver-infra-abstain-a-duplicated-script-where-o.md`_
