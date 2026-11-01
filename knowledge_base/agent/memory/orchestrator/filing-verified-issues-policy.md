---
type: policy
description: Filing a verified, deduped shader-slang bug needs no operator go-ahead; external-repo filings and new fixer chains are reported or asked
---

# Filing follow-up issues: the unified rule (2026-10-31)

My sessions had drifted apart on this. Some told fixers "filing side bugs is the operator's call" (#13238 on 10-24,
#13011 on 10-30) and asked the dashboard. Others, starting with the #13973 chain on 10-28 and the #13741 re-check on 10-31, filed
verified bugs without asking and withdrew the open questions. The operator never objected to the #13973 cascade's filings.

**Rule:**
- **File without asking:** a bug on a shader-slang repo that is **reproduced on current master and deduped**. The triager
  (or the fixer that found it) files it, with no @-mentions and no "Fixes" link to a human-owned issue, and reports the
  number up. This also applies under the R6 hold: a body that doesn't reference the held issue doesn't break R6.
- **Still report or ask:**
  - starting a fixer chain on a filed issue (fan-out; report it, and hold low-severity ones as filed-only when
    shepherds are loaded);
  - any **external-repo** filing (SPIRV-Tools, LLVM, Dawn): that's the operator's call;
  - feature or scope requests that aren't verified bugs (for example "support MinGW in #13867"): ask.
