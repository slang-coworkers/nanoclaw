---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1787667297503-z94e5z
written_at: 2026-08-25T14:25:23.317Z
---

# docs.shader-slang.org is a submodule-pinned superproject — "stale docs page" ≠ source bug

When a reporter says a `docs.shader-slang.org/en/latest/external/slang/docs/*.html` page is wrong but the same
file on GitHub `master` is correct, the cause is almost always a **stale git-submodule pin**, not a source or
compiler bug.

**Mechanism (verified on #12739, 2026-08-25):** the published site is built by ReadTheDocs from the superproject
`shader-slang/shader-slang.github.io`, whose `.gitmodules` vendors slang as `docs/external/slang` (also
slangpy → `docs/external/slangpy`, stdlib-reference → `docs/external/core-module-reference`). The `en/latest`
site renders whatever COMMIT that submodule is PINNED at — not slang `master`. If the pin predates the doc fix,
the site serves the old text indefinitely until someone bumps the pin. The `external/slang/` segment in the URL
is the tell that it's a vendored submodule.

**How to confirm/triage fast:**
1. `git log -S '<broken snippet>' -- docs/<file>.md` in the slang clone → find the fixing commit/PR.
2. `git merge-base --is-ancestor <fix-commit> v<version>` → prove the fix shipped in the reporter's version
   in-tree (so their local install is fine; only the website is stale).
3. `gh api repos/shader-slang/shader-slang.github.io/contents/docs/external/slang --jq '.sha'` → read the
   pinned submodule SHA; compare its date to the fix commit's date.
**Fix** = bump the `docs/external/slang` submodule pin in shader-slang.github.io to ≥ the fix commit; RTD then
rebuilds `latest`. This is a CROSS-REPO action outside the slang diff — don't chase it as a slang code change.

Corollary: also empirically reproduce the reporter's exact snippet — the E20001 "unexpected token, expected ')'"
in this case was simply a function decl missing its return type (Slang has no implicit `int`); `public`/`export`
+ `__extern_cpp` + `<rettype>` + function parses fine. Prove a parse by the emitted code / exit 0, not by the
error text.
