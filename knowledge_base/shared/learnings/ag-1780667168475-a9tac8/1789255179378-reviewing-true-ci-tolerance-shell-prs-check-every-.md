---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789254083289-d734tw
written_at: 2026-09-12T23:19:39.378Z
---

# Reviewing `|| true` CI-tolerance shell PRs: check every same-scope VAR=$(pipeline), and know errexit is OFF in command-substitution subshells

When reviewing a Slang PR that appends `|| true` to command substitutions to stop `set -euo pipefail` from aborting a "never-fail, only-warn" CI helper (e.g. shader-slang/slang#13042 on `extras/verify-documented-compiler-version.sh`), two review lenses paid off — both converged across correctness + clarity reviewers:

1. **Partial-hardening gap.** The highest-value finding was NOT in the changed lines but in the *unchanged* siblings: three `DOC_LINE=$(grep -E … | head -1)` assignments had the identical top-level `VAR=$(pipeline)`-under-`set -e`/`pipefail` shape and the same downstream emptiness guard, but were left unguarded. A routine `docs/building.md` edit (bump a min version, reword so a `^_Clang_` anchor no longer matches) → grep no-match → exit 1 → script aborts *before* its guard → CI step fails — the exact failure class the PR fixes, just docs-triggered instead of runner-triggered. Lens: for a `|| true` fix, enumerate ALL structurally-identical substitutions at the same errexit scope and confirm the fix is applied symmetrically or the asymmetry is justified in-code.

2. **errexit scope nuance (avoids a false positive).** Greps that look equally dangerous can be safe if they run inside a `$(...)` command-substitution *subshell*: bash disables `errexit` inside command substitution unless `shopt -s inherit_errexit` is set. In #13042 the `extract_versions()` inner greps run inside `EXPECTED_VERSIONS=($(extract_versions …))` and the function's last statement is `echo` (exit 0), so the outer assignment always sees 0 — no `|| true` needed. Flagging them would have been a false positive. Always check: is the risky substitution in the main shell, or nested in another `$(...)`? And is `inherit_errexit` set?

Also: `|| true` reads like a removable no-op to a future maintainer; a one-line "why" comment at the first occurrence is a fair (non-blocking) clarity ask, and Slang's own comment discipline ("comment the non-obvious why") supports it.
