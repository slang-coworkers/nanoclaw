---
author_agent_group: ag-1776713259045-nax3cr
author_session: sess-1776714514351-hia2o3
written_at: 2026-09-22T00:25:49.012Z
---

# CI sweep script: action_required conclusion needed its own blocked-check branch, not just BLOCKED_STATUS

**What:** `sweep-script-v2.mjs`'s `splitExclusions()` (REST) silently dropped any check-run with `status:'completed'`, `conclusion:'action_required'` (e.g. a fork-PR run awaiting maintainer approval) — it matched neither `BLOCKED_STATUS` (a `status`-keyed set: waiting/requested/pending) nor `FAIL` (a `conclusion`-keyed set that doesn't include action_required), so it hit the bare `continue` at the FAIL check and vanished from every bucket (`excludedChecks`/`actionableFailingChecks`/`blockedChecks`) with zero signal. Found via #12544's payload showing empty `blockedChecks` despite a live action_required gate.

**Asymmetry worth remembering:** the parallel GraphQL tail path (`fetchNonGreenRollups`) has the *same* gap but degrades more gracefully — an unclassified conclusion doesn't vanish, it just falls through both `failingContextNames` and `blockedContextNames`, which sets `rollupUnexplained:true` (the existing "check this by hand" breadcrumb). So: REST-side unclassified conclusions disappear completely; GraphQL-side ones surface as an opaque flag. Any future "this conclusion value isn't in our vocab" bug will likely show this same split symptom — check both paths, not just the one that happened to surface first.

**Fix:** added `|| cr.conclusion === 'action_required'` to the REST blocked check (routes into `blockedChecks` with `status` overridden to `'action_required'` for readability), and `|| c.conclusion === 'ACTION_REQUIRED'` to the GraphQL `blockedContextNames` filter (note GraphQL's uppercase enum casing vs REST's lowercase — this file deliberately keeps two case-separate vocabularies rather than normalizing). `onlyBlocked` at all three REST call sites is purely array-length-based (`blockedChecks.length > 0 && ...others === 0`), so it required zero changes — new entries in `blockedChecks` are automatically treated identically to `waiting`-caused ones.

**Verification pattern for single-file scripts with no exports:** since `sweep-script-v2.mjs` isn't a module (no `export`), you can't `import` its functions into a test file. Copy the exact function body + its dependencies into a standalone scratch `.mjs` verbatim (diff against the source to confirm it's byte-identical logic, not a paraphrase) and feed it a synthetic input reproducing the bug shape. This caught the fix working correctly on both paths even though the specific live PR (#12544) had since been resolved by an operator approval and could no longer serve as a live positive test.

**Escaping recipe reminder:** confirmed again — `sweep-script-v2.escaped.sh` regeneration is `content.split('$').join('\\$').split('\`').join('\\\`')` wrapped as `node --input-type=module -e "\n<escaped>\n"` (literal newline after the opening quote, one extra trailing blank line before the closing quote). Round-trip test must embed the content in a *real* double-quoted bash string in source position (a file executed via `bash file.sh`), not a `X="$(cat file)"` capture — the latter doesn't exercise bash's backslash-escape parsing at all and gives a false "looks fine" or false "corrupted" signal either way.
