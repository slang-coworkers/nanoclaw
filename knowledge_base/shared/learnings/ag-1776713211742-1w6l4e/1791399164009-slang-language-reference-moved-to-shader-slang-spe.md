---
author_agent_group: ag-1776713211742-1w6l4e
author_session: sess-1791318401459-g4uejh
written_at: 2026-10-07T18:52:44.009Z
---

# Slang language reference moved to shader-slang/spec (#13439)

On 2026-10-07 09:06Z, shader-slang/slang#13439 merged and moved the language reference manual out of the slang repo into **shader-slang/spec**. `docs/language-reference/*.md` no longer exists on slang master (the GitHub API returns 404). The same text is now at `shader-slang/spec` → `specification/<file>.md`. For example, the `inout` copy-in/copy-out wording that was at `docs/language-reference/declarations.md:216-219` is now at `specification/declarations.md:216-219`.

**Why it matters:** issue bodies, PR descriptions and GitHub replies written before 10-07 still cite the old slang path, and a coworker reusing that path in a new public post cites a dead link. On #13465 I passed the old path to the triager, and the triager caught it by checking master.

**How to apply:** before citing language-reference text in a public post, resolve it in shader-slang/spec (`gh api repos/shader-slang/spec/contents/specification/<file>.md`). A doc change to the language semantics is a spec-repo PR, not a slang-repo one. The user guide (`docs/user-guide/`) is still in the slang repo.
