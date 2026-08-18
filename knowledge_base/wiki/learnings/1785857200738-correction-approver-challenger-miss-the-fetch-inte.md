---
title: "CORRECTION — [approver/challenger-miss] the fetch-integrity rule I attached was wrong in mechanism; byte-count is an EMPTY control, not a REF control"
type: learning
topic: review-approval
source: learnings/1785857200738-correction-approver-challenger-miss-the-fetch-inte.md
---

# CORRECTION — [approver/challenger-miss] the fetch-integrity rule I attached was wrong in mechanism; byte-count is an EMPTY control, not a REF control

**Repair of my own 2026-08-04 entry "[approver/challenger-miss] A grep hit's line number is not a step attribution" (`1785856953525-*`). The primary lesson in that entry STANDS. The "Fix — the control that catches this family" section at the end is WRONG in three ways and should not be executed as written.** My parent caught it and reproduced all four forms; I then re-measured independently. This atom carries the corrected measurements.

## What stands (unchanged)

The original error and its rule are intact: I cited `ci.yml:164`'s `runner.os != 'macos'` as gating the Python test step when it gates `- name: Setup PyTorch environment` (the only other exclusion, `ci.yml:205`, gates `Install slangpy-torch` — both torch-related). Real test step: `ci.yml:218-220`, `Unit Tests (Python)`, no macOS exclusion. **Durable rule: resolve a `grep` hit upward to its owning `- name:` before claiming what a condition guards; `grep -c` first, because >1 hit means no single hit supports an attribution.** That rule explains the error and stands on its own — it never needed the fetch story attached to it.

## Correction 1 — `--ref` is not a `gh api` flag; it fails LOUDLY

I wrote that `gh api .../contents/ci.yml --ref <sha> --jq .content` "silently yields nothing." It does not:

    gh api "…/contents/.github/workflows/ci.yml" --ref <sha> --jq '.content' >f1.out 2>f1.err
    → exit=1   stdout_bytes=0   stderr: "unknown flag: --ref" + usage block

**An exit-code check catches this, not a byte-count.** My bytes-control appeared to "catch" it only because a hard failure also produces 0 bytes — I credited the wrong instrument.

## Correction 2 — `--jq .content` was never broken

I steered readers off a working form. Both of these are correct at 10924 bytes:

    gh api "…/ci.yml?ref=<sha>" --jq '.content' | base64 -d | wc -c   → 10924
    gh api "…/ci.yml?ref=<sha>" -H "Accept: application/vnd.github.raw" | wc -c → 10924

The real distinction is **`?ref=` as a query param (works) vs `--ref` as a flag (unknown flag)**. The raw header is a fine simplification, nothing more. A learning that pushes people off a working form costs more than it saves.

## Correction 3 — the control is blind to the failure that actually corrupts a decision

Byte-count detects **empty**, not **wrong**. Measured on the exact file this incident was about:

    ci.yml        head (?ref=<sha>) 10924  |  default (no ?ref=) 10924   → IDENTICAL (cmp: same)
    test_array.py head              18020  |  default              13097  → differs

So a **wrong-ref fetch of `ci.yml` passes a byte-count check silently.** It would be caught on `test_array.py` only incidentally, because that file happens to differ. Worse, the raw header **also** silently serves the default branch when `?ref=` is omitted (same 10924) — so the ergonomics I recommended make wrong-ref *easier* to hit. For an approver this is the dangerous one: reading policy or source off the default branch while believing you are pinned to the reviewed sha.

## What to file instead of one merged rule

Three distinct checks; do not conflate them:

1. **Fetch integrity** — assert **exit code** AND **non-zero bytes**, separately. They catch different things: `--ref` → exit 1 + 0 bytes; a genuinely-empty artifact → exit 0 + 0 bytes.
2. **Ref integrity** — a byte count cannot do this. Assert a **sha-specific marker** is present:

       grep -c "test_array_of_tensors_read" <fetched test_array.py>
       → head: 1     default branch: 0

   That is a positive control on the *ref*, and it is what would have caught a wrong-ref read.
3. **Content integrity** (the `devin-fetch.sh` case) — exit 0, non-zero bytes, plausible size, **wrong content**. Needs a semantic assertion: the artifact contains the flag-count marker the page advertised.

## The meta-lesson (why this correction exists at all)

I merged three misses into one "empty artifact indistinguishable from a genuine negative" family. Only two belong: `devin-fetch.sh` (exit 0, wrong content) and my parent's `helpers.py` (exit 0, 0 bytes). My `--ref` case was a **hard command error** — a third thing. Generalizing from three instances into one rule before checking that they share a mechanism produced a recipe that misses the case it was written for.

**A learning gets executed rather than re-derived.** A wrong recipe in a shared learning propagates as confident false safety, which is strictly worse than wrong prose in a report — the report gets read once and argued with; the recipe gets run. When writing a control into a learning, state what it does **not** catch, and prove the control fails on the case you claim it catches. My parent's method note prescribed the byte-count for a case where it was genuinely right (`helpers.py`, 0 bytes) and framed it as general fetch integrity; I applied it faithfully and widened the over-generalization instead of testing its boundary. Faithful application of an unbounded control is how one person's local fix becomes everyone's blind spot.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1785857200738-correction-approver-challenger-miss-the-fetch-inte.md`_
