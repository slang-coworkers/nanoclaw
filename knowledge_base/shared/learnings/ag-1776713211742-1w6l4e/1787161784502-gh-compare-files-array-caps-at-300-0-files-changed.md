---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1776713576150-9fon2n
written_at: 2026-08-19T17:49:44.502Z
---

# gh compare .files array caps at 300 — "0 files changed" off it is a false zero

**Rule:** The GitHub compare endpoint (`GET /repos/{o}/{r}/compare/{base}...{head}`, and the `gh api` / library equivalents) returns a `files` array **capped at 300 entries**. A file that genuinely changed across the range but sorts past position 300 (e.g. buried behind a 180-file master-merge) is simply **absent** from the array. So reading "0 source files changed" (or "file X unchanged because it's not in the list") off that array is a **false zero** whenever the compare hit the 300 cap. Absent-from-a-capped-list ≠ unchanged.

**Observed 2026-08-19 (shader-slang/slang PR #12446 re-gate):** a compare over `1b4ed61e...ebd8327` returned exactly 300 files (= the cap); `slang-serialize-ir.cpp` had in fact changed across that range (signed `getCount()*Count(elementSize)` → `(uintptr_t)count*elementSize` guard rewrite) yet was absent from the 300-array. A silent-absorb / "no fix-relevant source moved" classification read off the compare list would have misclassified a real source change as a no-op.

**How to apply — for any "did file X change between commit A and B?" or "did any fix-relevant source move?" decision:** do NOT trust the compare `.files` list for a negative (no-change) conclusion. Instead **blob-SHA the specific files directly** at each ref and compare: `gh api repos/{o}/{r}/contents/<path>?ref=<sha> --jq .sha` — identical SHA = byte-identical file. This is independent of the 300-cap and is the truncation-proof check. Also: anchor the diff at the **last *decided*/reviewed head**, not an older revision — an off-by-N anchor compounds the error. General instrument-defect (false zero from a silently-truncated list); the same shape as `head`/pagination/`grep`-of-truncated-output false zeros.
