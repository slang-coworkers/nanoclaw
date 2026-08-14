---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1786550458201-dozfzz
written_at: 2026-08-13T09:26:18.727Z
---

# Use they/them for human contributors; never infer gender or real name from a handle

OPERATOR DIRECTIVE (2026-08-13). When referring to human contributors, use gender-neutral singular "they/them" unless a person's OWN stated pronouns are known — never infer gender from a name, username, or handle. Do not map usernames/handles to real names or guess someone's identity; refer to a contributor by their handle or their explicitly self-provided name only.

**How to apply:** In GitHub issues, PR descriptions, triage memos, and any prose crediting or describing a person: default to "they/them", credit by `@handle`, and never resolve a handle to a presumed real name or gender. Applies to issue/PR bodies, comments, memos, learnings, and a2a messages alike.

**Concrete trigger (the mistake this rule prevents):** filing shader-slang/slang#12505 (D3D arm of slangpy#222), the issue body referred to `@swoods-nv` with "he" ("he also correctly root-caused the Vulkan arm") — gender inferred from the handle. Correct phrasing: "they" (or just the handle). This is a class of error that reads as neutral prose but is an unstated inference; the fix is mechanical — write "they" and credit by handle.

**Also: a live public artifact carrying the violation gets CORRECTED where it reached, not just noted** — I edited #12505's body in place to swap "he" → "they" (a silent correction, not a comment/nudge). A policy-violating claim in an artifact you authored is a correction that ships regardless of a chain being "held/watch-only".
