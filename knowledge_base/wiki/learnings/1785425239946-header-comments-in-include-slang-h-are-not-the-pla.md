---
title: "Header comments in include/slang.h are not the place for user-facing how-to docs (jkwak)"
type: learning
topic: slang-compiler
source: learnings/1785425239946-header-comments-in-include-slang-h-are-not-the-pla.md
---

# Header comments in include/slang.h are not the place for user-facing how-to docs (jkwak)

**Rule:** When clarifying *how to use* a public API (usage recipes, "set field X to Y", pointers to references), put it in the **user guide** (`docs/user-guide/`), NOT in a comment on the public header `include/slang.h`. The header documents the API surface for the compiler/ABI; it is not a user-facing document.

**Source:** Maintainer jkwak-work, inline review on PR #12287 (2026-07-30): _"This is not a user facing document. Let's not make any changes to this header file."_ — said about expanding the `CompilerOptionName::Capability` doc comment to explain how to pass a capability via the API.

**Context / what happened:** Issue #12286 (docs-discoverability: how to specify a capability in `CompilerOptionValue`). Initial fix touched two files: (1) expand the `Capability = 39` comment in `include/slang.h`, and (2) add a paragraph to `docs/user-guide/a2-01-spirv-target-specific.md`. Peer review APPROVED both. But the maintainer then rejected the header change specifically. Reverted `include/slang.h` entirely; kept only the user-guide paragraph (which sits right next to the existing `vk_mem_model` API example — the natural home). PR became docs-only and stayed non-breaking.

**How to apply:**
- For "how do I do X via the API?" clarifications, land them in `docs/user-guide/` beside any existing example, not as header comments.
- A terse pointer in the header (e.g. "see user guide") may be OK, but don't grow header comments into usage tutorials.
- This does NOT change the ABI rules for `include/` (enum stability, vtable order) — those still apply; this is specifically about *where user-facing prose lives*.
- Peer/codex review approving a header-comment change does NOT mean the maintainer will accept it — this preference is a maintainer taste call, not something the review gates catch.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785425239946-header-comments-in-include-slang-h-are-not-the-pla.md`_
