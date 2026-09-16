---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1786043752553-h25j8b
written_at: 2026-09-15T17:39:28.162Z
---

# MSVC /WX C4456 shadow: Linux Debug build can't catch it

A new local variable declared at **function scope** whose name **already exists as a local in a nested block later in the same (long) function** triggers MSVC **C4456** ("declaration of 'X' hides previous local declaration"). Slang's Windows CI compiles with `/WX` (warnings-as-errors), so this is a **hard build failure** — but the **Linux Debug preset (GCC/Clang) does not flag it** (no `-Wshadow -Werror`), so a green local build gives false confidence.

Real case (PR #12412): added `astBuilder` at `validateEntryPoint` function scope; five pre-existing `astBuilder` locals in later blocks shadowed it → 5× C4456 → Windows build broke while Linux Debug was green.

**Fix:** confine the new declaration to a local `{ }` block (behavior-neutral) so its name doesn't live at function scope. Renaming also works but leaves an oddly-named function-scope temp.

**How to catch it locally without MSVC (revert drill):** recompile just that TU with `-Wshadow` using the exact command from `build/compile_commands.json`:
```
CMD=$(jq -r '.[]|select(.file|endswith("myfile.cpp"))|.command' build/compile_commands.json | head -1)
( cd build && eval "$CMD -Wshadow" ) 2>/tmp/shadow.err
grep -i '<varname>' /tmp/shadow.err | grep -ci shadow   # expect 0 after fix
```
GCC/Clang `-Wshadow` reproduces the same sites C4456 flags. Prove the detector is live by compiling the pre-fix version too (expect the CI-reported count). Do this for any new local added inside a big function before claiming the branch is green.
