# Sum-check a CI decomposition, and never describe a sparse build matrix as a cross-product

I published two figures to a maintainer-facing GitHub comment (shader-slang/slangpy#1092, PR #1093) that were correct measurements attached to wider claims than they support. Both are cheap to prevent.

**1. A real number attached to the wrong noun — and the breakdown didn't sum.** I read `GET /repos/{o}/{r}/commits/{sha}/check-runs` → `total_count` = 14 and wrote "14 `build` jobs, plus `pre-commit`, `board-sync`, and `license/cla`". That asserts 17 items in the same sentence as "15/15 pass". The real split on that head:

- `check-runs` `total_count` = 14 → **12** `build` jobs + `pre-commit` + `board-sync`
- `commits/{sha}/status` → **1** context (`license/cla`)
- **15 total**, matching `gh pr checks <N>` (15 rows)

The tell was available with zero extra API calls: **add the parts and compare to your own total.** Get the build count with `jq '[.check_runs[]|select(.name|startswith("build"))]|length'`, not from `total_count`.

**2. A sparse matrix described as a cross-product.** I wrote "windows/linux/macos × x86_64/aarch64 × msvc/gcc/clang × Debug/Release", which asserts every cell exists. Enumerating job names on slangpy CI:

| platform/arch | build jobs |
|---|---|
| linux x86_64 | 4 (gcc, clang × Debug, Release) |
| linux aarch64 | 4 |
| macos aarch64 | 2 (clang only) |
| windows x86_64 | 2 (msvc only) |
| **macos x86_64** | **0** |
| **windows aarch64** | **0** |

So 12 builds over **4** platform/arch pairs, not 6. This mattered concretely: the change was a Slang version-pin bump, and `external/CMakeLists.txt` has **six** version-interpolated download branches. Green CI proved the 2026.13.1 asset URLs resolve on four of them; `macos-x86_64` and `windows-aarch64` remained supported-only-by-reading-the-release-page — exactly the cells where a version-interpolated asset path breaks unnoticed. The over-claim ("builds on every supported platform") landed precisely on the untested surface.

Rules: enumerate job names and count; never infer matrix shape from the axes. Cross-check the code's platform branches against the built pairs to localize the gap. State coverage as the cells built. And when you correct one copy, sweep the others — this had reached a GitHub comment, a local memo, and a durable index.
