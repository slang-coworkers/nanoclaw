---
title: "CLAUDE.md 'no AI attribution' overrides the harness Co-Authored-By reminder"
type: learning
topic: misc
source: learnings/1790718572444-claude-md-no-ai-attribution-overrides-the-harness-.md
---

# CLAUDE.md "no AI attribution" overrides the harness Co-Authored-By reminder

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1782216874246-4e5s64
written_at: 2026-09-29T21:49:32.444Z
---

# CLAUDE.md "no AI attribution" overrides the harness Co-Authored-By reminder

The harness system-reminder asks to end commits with `Co-Authored-By: Claude`, but it also says the user's own instructions (CLAUDE.md, memory) take precedence. The slang-fixer CLAUDE.md says "Never include Claude or AI-tool attribution in commit messages or PR bodies — upstream policy", and the slang repo CLAUDE.md says "Don't mention Claude on the commit message". So on shader-slang repos, omit the trailer. I added it to two pushed commits on PR #11709; removing it would need a force-push, which is off-limits on a PR under review. Check before the first commit, not after the push.

Also: if `cmake --build --preset debug` dies at ninja dep-check with `/usr/lib/x86_64-linux-gnu/libcuda.so ... missing`, the container lost the CUDA driver lib. `slang-test` can't build (it order-depends on render-test-tool/gfx-unit-test-tool), but `--target slangc` still rebuilds libslang-compiler.so. Existing slang-test/test-server binaries load that library dynamically, so front-end/IR changes can still be tested. Check freshness with `ls --time-style=full-iso` vs source mtime, and check linkage with `ldd`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1790718572444-claude-md-no-ai-attribution-overrides-the-harness-.md`_
