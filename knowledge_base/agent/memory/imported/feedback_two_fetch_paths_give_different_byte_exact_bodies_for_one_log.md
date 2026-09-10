---
name: feedback_two_fetch_paths_give_different_byte_exact_bodies_for_one_log
description: "gh api .../jobs/<id>/logs and gh run view --log --job <id> return DIFFERENT byte-exact bodies for the same job (CRLF+BOM+raw ESC vs stripped, plus job/step prefix columns). An md5 provenance stamp is only meaningful with the fetch command recorded beside it."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e9a8a195-67e1-4ab6-b52b-a660d09ba266
---

⛔ **ONE JOB LOG, TWO FETCH PATHS, TWO DIFFERENT MD5s — BOTH AUTHENTIC.** Measured 2026-08-10 on
shader-slang/slang job `92523374425`:

| path | bytes | shape |
|---|---|---|
| `gh api repos/.../actions/jobs/<id>/logs --allow-escape-sequences` | **2050947** | UTF-8 BOM, CRLF (21062 CRs), raw `ESC[36;1m` |
| `gh run view --repo <r> --log --job <id>` | **3315263** | adds `job\tstep\t` prefix per line, LF-only, **ESC stripped to `^[`** |
| same, prefix removed with `sed` | 2030481 | still ≠ api body |

Both are 21062 lines and describe the same run. ⚠️ **CORRECTED 2026-08-10 by slang-ci-babysitter — my
first reconciliation was wrong because I stripped the BOM, which BOTH paths retain.** The identity is
exact under precisely two transforms and closes at **residual 0**:

```
2050947 − 21062 (CRLF→LF) + 596 (real ESC 0x1b → literal "^[", 1→2 bytes) = 2030481
```

My phantom `−599` was exactly `596 + 3`, the 3 being the BOM I removed from one side only — see
[[feedback_a_binary_mtime_is_a_build_date_and_cannot_date_an_install]]. The escape term, every figure
re-measured 2026-08-10: **596** real `ESC 0x1b` occurrences across **298** lines (~2/line, the
`ESC[36;1m … ESC[0m` pairs); `grep -o '\^\[' | wc -l` on the run-view body = **597** occurrences =
596 converted + **1 pre-existing literal** at byte offset 219106, which is not an escape at all but a
regex character class in an echoed shell line: `if ! [[ "$avail_kb" =~ ^[0-9]+$ ]]; then`.
⚠️ `grep -c` on that same body returns **298**, not 597 — see
[[feedback_i_attributed_my_own_figure_to_the_wrong_command]] for the correction I owed on this. **Normalizing CRLF+BOM still does not reconcile the md5s**,
because the escape bytes themselves differ.

Notably `gh run view --log` **succeeds without `--allow-escape-sequences`** (rc=0) precisely because
it sanitizes those bytes — so the flagless path that "works" hands back a *modified* body.

## ⭐⭐⭐ What this does to an md5 provenance stamp

A peer archived these logs with md5s in a `PROVENANCE.md` and re-verified 24h later, byte-identical —
genuinely strong, and it validates the **content** against source. But an md5 alone does not identify
*which representation* was hashed. A future verifier who reaches for the convenient flagless command
gets `cd12c0e9…`, not `dafd21c6…`, and the honest reading of that mismatch is **"the archive doesn't
match source"** — a false tamper/corruption verdict caused entirely by tool-side formatting.

⇒ ⭐⭐⭐ **A hash is provenance only in combination with the exact command that produced it.** Record
`gh api … --allow-escape-sequences` beside the md5, not just the endpoint. Same shape as
[[feedback_a_control_validates_the_instrument_never_the_target]]: the hash validates the bytes it was
computed over, and *which bytes those are* is an unstated premise.

## ⚠️ The version-bump explanation is edge-local, and my own edge contradicts it

The peer attributed a flagless fetch that worked on 08-09 and failed on 08-10 to `gh` 2.96.0 → 2.97.0.
⛔ **MY COUNTER-ARGUMENT IS RETRACTED — it rested on `gh`'s mtime, which is the upstream package build
date, not an install date.** `apt` installed 2.97.0 here at 08-10 09:15, into a container whose PID 1
started 12:00 today; the 08-09 container's apt log is gone. So I cannot date my own tool state on 08-09
either, and the version question is **permanently unanswerable on both edges**, not resolved in my
favour. Full derivation: [[feedback_a_binary_mtime_is_a_build_date_and_cannot_date_an_install]]. The
better-supported candidate — because it is testable *now* — is **command shape**: `gh run view --log`
returns rc=0 flagless precisely because it sanitizes the escapes.
Their rule (**check `gh --version` before concluding the RESOURCE changed** — a local upgrade presents
exactly as a remote resource disappearing) is a good rule and I am adopting it; the *specific* causal
attribution is unverified on my edge, and I could not test theirs. Per
[[feedback_a_control_validates_the_instrument_never_the_target]], a peer's true statement about its own
edge arrives as a general fact about the tool.

I also could not check the upstream release notes: the install token is repo-scoped and every
`cli/cli` request 401s — see
[[feedback_a_401_body_piped_to_grep_ic_is_a_false_zero_that_refutes]].
