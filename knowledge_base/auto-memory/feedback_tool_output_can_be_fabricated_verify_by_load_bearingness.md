---
name: feedback-tool-output-can-be-fabricated-verify-by-load-bearingness
description: A Read/tool result can return content that is not in the file. Trigger second-instrument verification on how load-bearing the claim is — never on whether the output looked suspicious.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 49738ebf-cac0-45e5-9cd8-f14d4d7db648
---

**A tool result is evidence about the tool, not direct observation of the system.** A `Read` can
return file content that **does not exist in the file**.

## The instances (two, different tiers, same class)

1. **2026-08-04, slang#8306.** A coworker's `Read` of `.github/workflows/cmake-options-build.yml`
   returned a CI gate — `if: ${{ inputs.verify-slangc }}` plus a `cmake -L` check — that is **not in
   the file**. It was about to be cited as load-bearing evidence in a public verdict. Caught **only**
   because that output was *also* visibly garbled. Re-read via
   `git show HEAD:<path> | sed -n` (file verified clean: `git status` empty, sha256 `0d1d732f…`,
   262 lines); the real step gates on `CMakeCache.txt`.
2. **slang#11982** (earlier, mine): a `[Fix Report]` claiming a draft PR `#11984` was **MERGEABLE /
   Closes #11982** was fabricated, arriving interleaved with corrupted tool-result output (phantom
   closing tags). See [[project_11982_debugsource_dup_import]].

## The rule

⭐⭐ **Trigger second-instrument verification on HOW LOAD-BEARING the claim is — never on whether the
evidence looked suspicious.** The garbled fabrication is the *lucky* case. A cleanly-formatted one is
entirely plausible and gets published. Selecting what to double-check by "did it look wrong" means you
only ever catch the harmless variant.

Operationally: before any claim that will be **published, dispatched on, or used to close a chain**,
re-read the artifact through a *different* path:

```
git show HEAD:<path> | sed -n '<lo>,<hi>p'     # second instrument for a tracked file
git status --porcelain && sha256sum <path>     # is the working copy even clean?
grep -c '' <path>                              # line-count control (see the non-zero-control rule)
```

⭐ **Reading an artifact is not observing the system**, and the read itself is not free of doubt. This
compounds with the endpoint/scope lessons: those say a *correct* read can answer the wrong question;
this says the read may not be correct at all. Both collapse to: **name the instrument, then
corroborate the load-bearing part.**

Same root as the `Explore`-retains-`Bash` and `gh`-401-is-path-classed errors of the same night:
**assuming a property from a name or a surface instead of probing that property specifically.** Here
the assumed property is "a file-read returns the file."

Related: [[feedback_search_code_total_count_is_not_a_file_count]] ·
[[feedback_consistency_is_not_completeness_in_review]] ·
[[reference_slang_mcp_is_an_independent_github_instrument]]
