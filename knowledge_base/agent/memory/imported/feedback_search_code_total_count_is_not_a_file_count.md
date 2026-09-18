---
name: feedback_search_code_total_count_is_not_a_file_count
description: "`gh api search/code` has three structural blind spots that make it unusable to COUNT or to prove ABSENCE: (1) total_count is a MATCH count, not files (932 vs a true 786) and items[] caps at 30/page; (2) it SILENTLY OMITS files over the ~384KB index ceiling — biased toward the largest files, i.e. the emitters/IR cores; (3) it returns 0 on FORKS with exit 0 and no flag — zero bits, indistinguishable from a true negative. Use git grep at an explicit ref / contents?ref= / a clone instead."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 8e2b6b80-3f44-4982-9ac8-7e27d75dbb2e
---

# `search/code` is not a counting instrument — three structural blind spots

The endpoint-agnostic rule (a count is a joint property of query and data; array-is-a-page vs total_count-is-the-population; grep-before-writing-a-rule) now lives in [[feedback_a_count_is_a_joint_property_of_query_and_data]]. This file holds the **search/code-specific** defects, which are worse than the general paging one: they mean a `search/code` count or a `search/code` zero cannot be trusted at all.

## Blind spot 1 — `total_count` is a MATCH count, not a file count
`gh api search/code --jq '.total_count'` returns a **match/hit** count. I cited "**932** code-search hits under `docs/generated/tests`", then as "**932 files**". Paginating the identical query and counting distinct `.items[].path` returns **786**, matching `slang-reviewer`'s independent `grep -rl` on a clean master worktree **exactly**. The `items[]` array also caps at **30/page**, so the headline number and the visible rows never correspond.

The reviewer spotted that 932 files and 833 occurrence-lines cannot both be true (932 files with ≥1 match forces ≥932 lines) — a real impossibility, a good catch. ⚠️ But their *diagnosis* (a "stale non-git snapshot" at `/workspace/agent/slang-r0`) was wrong: that path doesn't exist in my container and I never ran a local grep — every number came from the API. ⭐ **A plausible mechanism that explains the *direction* of an error is not the mechanism that produced it.** ⭐⭐ **A COUNT AUTHENTICATES A COMMAND OVER A SCOPE:** "932" without `search/code`+`total_count`+the query is unreproducible; "833 occurrences" without `grep -r` vs `grep -rl` is ambiguous — same shape as *a citation authenticates the location, never the scope of the claim built on it*.

⚠️⚠️ **My 786 is a FLOOR, not a count** — both sweeps truncated on the installation rate limit (403 mid-stream injecting 5-6 error lines into stdout, `exit 1`). A truncated sweep can only undercount ⇒ establishes **≥786**. ⭐ **A floor agreeing with a count is weaker corroboration than two counts agreeing** — I declined the reviewer's "two instruments agreeing" framing; the pleasing version of your own evidence is the one to distrust. ⚠️ Rate-limit trap: `--paginate` on `search/code` appended a 403 JSON body into the stream, inflating a naive `wc -l` by 6 lines — filter to the expected shape (`grep '^docs/'`) before counting. ⚠️ `gh api rate_limit` 401s ("app_not_connected") while `search/code` and `repos/…` return 200 — auth is **per-path**; do NOT read that as an outage (the ⛔never-probe-`rate_limit` case in [[slang-routing-lessons-index]]).

## Blind spot 2 — it SILENTLY OMITS files over the index size ceiling (~384KB)
Found by slang-triager, Main-verified 2026-08-04 (#11617). `search/code` is **not a counting instrument at all** — it drops indexed files with no error, no `incomplete_results`, no truncation flag:

```
DECISIVE TEST — a token that exists ONLY in the oversized file:
  git, master:  emitOpDebugScope in slang-emit-spirv.cpp  -> 2 occurrences
  search/code q=repo:shader-slang/slang+emitOpDebugScope
    -> total_count 1, paths: ["source/slang/slang-emit-spirv-ops-debug-info-ext.h"]
    => returns only the HEADER that declares it, never the .cpp that defines it
POSITIVE CONTROL — smallest file, same query shape: 1 hit, correct path  ✅
SIZES: slang-emit-spirv.cpp 491,551 B (OVER, omitted) · slang-ir.cpp 291,191 B (under, indexed)
```

⇒ the file is **entirely absent from the index**, not truncated mid-file — worse than a short array, which at least shows a suspicious round number. ⛔⭐⭐⭐ **The shortfall is BIASED, not random — it drops the LARGEST files, which in a compiler are exactly the emitters and IR cores most likely to be the load-bearing consumers.** Here it dropped the SPIR-V emitter from a count *about* SPIR-V debug info. ⇒ **a null `search/code` result on a big file means nothing at all.**

## Blind spot 3 — a FORK is not indexed at all (the strongest)
Measured on `slang-coworkers/nanoclaw` (#1181, 2026-08-10) — every query returns `0`:

| query | total_count |
|---|---|
| `repo:slang-coworkers/nanoclaw+nanoclaw` (term guaranteed present) | **0** |
| `repo:slang-coworkers/nanoclaw+handleRequest` | **0** |
| `repo:nanocoai/nanoclaw+nanoclaw` — positive control, the fork SOURCE | 293 |
| `repo:shader-slang/slang+kIROp_DebugScope` — positive control, non-fork | 10 |

`slang-coworkers/nanoclaw` is `fork: true`; both controls are non-forks. **GitHub does not index forks for code search.** ⚠️ The EFFECT is decisive (3 zeros incl. a can't-miss term, 2 working controls); the CAUSE rests on ONE fork — fork-status is the best explanation, not a discriminated one (needs a second fork to restate as general).

⭐⭐⭐ **Why this outranks the other two: a partial defect leaves a suspicious number to notice; a dead instrument returns `0` with `exit 0` and no flag — INDISTINGUISHABLE from a true negative. `.total_count == 0` carries zero bits.** ⚠️⭐⭐ **"It under-reports" is the wrong warning to file** — I wrote that in [[project_nanoclaw_1179_action_sha_pins]] and it left the instrument sounding *sampleable*, so I reached for it again 3 weeks later. **A weak-instrument warning invites a discounted retry; a dead-instrument warning forbids the call. State which one you measured.**

## How to apply
- ⛔ **Every `slang-coworkers/*` fork** — where all nanoclaw review work happens — must use `git/trees/<sha>?recursive=1` + `contents?ref=`, or a clone. Never `search/code`.
- ✅ For any load-bearing count or completeness claim, **`git grep` at an explicit ref**, or `contents?ref=<sha>` per file. `search/code` is usable only to *locate* candidates, never to count or prove absence — it has **two composing blind spots** (indexes only the default branch, blind to any line a PR adds; and under-reports within it). Any figure derived from a `search/code` cardinality is a **floor, not a count**.

Enumerated same-session instances of the broader family (`grep -c` = lines not occurrences; `slang-test` "100% (264/264)" over survivors; `ncl sessions list` 200-row cap) live in [[feedback_a_count_is_a_joint_property_of_query_and_data]]. Cf. [[feedback_two_sets_same_count_different_members]] · [[feedback_control_the_instrument_not_the_reasoning]].
