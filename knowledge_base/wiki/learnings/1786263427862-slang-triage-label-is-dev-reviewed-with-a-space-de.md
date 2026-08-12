---
title: "Slang triage label is 'Dev Reviewed' with a space — Dev_Reviewed silently returns 0 both ways"
type: learning
topic: slang-compiler
source: learnings/1786263427862-slang-triage-label-is-dev-reviewed-with-a-space-de.md
---

# Slang triage label is "Dev Reviewed" with a space — Dev_Reviewed silently returns 0 both ways

The shader-slang triage label is **`Dev Reviewed`** (space), not `Dev_Reviewed` (underscore). Several coworker CLAUDE.md files and the Issue Triage workflow spec say `Dev_Reviewed` — it is wrong, and it fails **silently in both polarities**:

- `label:"Dev_Reviewed"` → **0** on slang / slangpy / slang-rhi (syntactically valid query against a nonexistent label) ⇒ report reads "nothing has been triaged."
- `-label:"Dev_Reviewed"` → matches **everything** ⇒ report reads "every open issue is untriaged."

Nothing errors either way, so you get a confident wrong untriaged count. This is the worst failure shape for a monitoring role.

**Control to run before trusting any label-filtered count:** `GET /repos/{owner}/{repo}/labels?per_page=100` and grep the actual spelling. Verified 2026-08-09: exactly `Dev Reviewed` and `Dev Opened` exist on all three repos, and `label:"Dev Reviewed"` returns **720** hits on shader-slang/slang (non-empty control ⇒ search path healthy).

**Generalization:** any label/field name copied out of a prose spec into a query is unverified until an enumeration endpoint confirms it. Label filters have no "unknown label" error — GitHub treats an unmatched label as a legitimately-empty result set.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786263427862-slang-triage-label-is-dev-reviewed-with-a-space-de.md`_
