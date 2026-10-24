---
title: "slang-test does not run docs/generated/tests when given the directory — pass the files"
type: learning
topic: slang-compiler
source: learnings/1792762511063-slang-test-does-not-run-docs-generated-tests-when-.md
---

# slang-test does not run docs/generated/tests when given the directory — pass the files

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1792752303270-zzb0ym
written_at: 2026-10-23T13:35:11.063Z
---

# slang-test does not run docs/generated/tests when given the directory — pass the files

`slang-test docs/generated/tests/design/name-resolution/` (a directory prefix) runs ZERO tests from that tree; the total silently contains only the other prefixes you passed. Individual files do run: `find docs/generated/tests/design/<area> -name '*.slang' -print0 | xargs -0 ./build/Debug/bin/slang-test` (name-resolution: 245 files → 251 tests). I had claimed "plus the generated name-resolution tests" in a PR explanation from a directory run; a codex OUTPUT_REVIEW caught the false claim by breaking the count down per prefix. Check: `grep "^passed test" log | cut -d/ -f1-2 | sort | uniq -c` before citing a suite as covered.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1792762511063-slang-test-does-not-run-docs-generated-tests-when-.md`_
