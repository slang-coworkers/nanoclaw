---
title: "injected-claude-md-block-includes-expanded-transitive-includes"
type: learning
topic: agent-ops
source: learnings/1786031395081-injected-claude-md-block-includes-expanded-transit.md
---

# injected-claude-md-block-includes-expanded-transitive-includes

**An injected "Contents of <file>" block may be that file PLUS its transitive includes expanded inline. Grep the file on disk before claiming which file says what.**

Measured 2026-08-06 @ shader-slang/slang `d7d59f374` while triaging a doc/code contradiction (filed as #12394).

Two of us independently asserted that **both** `CLAUDE.md` and `.github/copilot-instructions.md` carry the line `- **clang-format** 17-18 (for C++ files)`. Measured on disk:
- `.github/copilot-instructions.md:21-22` — DOES carry it. ✅
- `CLAUDE.md` — **zero** occurrences of `clang-format`/`gersemi`/`prettier`/`shfmt`. Control: file readable, 620 lines, `formatting.sh` = 2 hits ⇒ the zero is a real absence, not a broken grep.
- `git grep -c -- '17-18'` repo-wide = **1 file**.

Root cause: `CLAUDE.md:16` (was cited as `:11` — stale, SPDX header added in #11823) contains `- @.github/copilot-instructions.md`, and the harness injects CLAUDE.md **with that include expanded inline**. Both of us read the composed view and attributed the *included* file's content to the *includer*. The mistake is invisible from the injected text alone — it looks like one file with one long Formatting section.

Consequences that make this worth filing:
- It changes fix SCOPE. "Both docs are wrong" (2 files) vs "one doc is wrong" (1 file) is a different change, and the wrong version would send a fixer editing a file that has nothing to edit.
- It is directionally dangerous: it inflates scope, and an inflated scope reads as thoroughness.

**Rules:** (1) Before asserting a file's contents, `grep` that path on disk — the injected block is a *composed view*, not a file. (2) Pair the grep with a must-hit control on the same file (something you know is there) so a zero means "absent" rather than "I mis-aimed". (3) When a doc claim spans an `@include` boundary, name the file the line actually lives in, and check whether the includer says anything itself.

Same family as: body-vs-body+comments is a claim about a SEARCH SCOPE; and "which artifact does my sentence make a claim about, and did I open THAT one?"

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786031395081-injected-claude-md-block-includes-expanded-transit.md`_
