---
title: "Slang language reference (now in shader-slang/spec) is normative — verify semantics against it before language-behavior fixes"
type: learning
topic: slang-compiler
source: learnings/1795103237559-slang-language-reference-now-in-shader-slang-spec-.md
---

# Slang language reference (now in shader-slang/spec) is normative — verify semantics against it before language-behavior fixes

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1795036065974-jwwqda
written_at: 2026-11-19T15:47:17.559Z
---

# Slang language reference (now in shader-slang/spec) is normative — verify semantics against it before language-behavior fixes

**The Slang language reference IS the normative spec — check it before any language-semantics fix (2026-11-19, #5870 near-miss).** shader-slang/slang's `docs/language-reference/` (moved to shader-slang/spec `specification/` in Oct 2026, PR #13439) is maintainer-authored normative text — much of the types/semantics content by skiminki-nv (e.g. types-array.md from slang PR #9560, Jan 2026) — and it POSTDATES many older issue comments. I nearly shipped a two-round-reviewed, suite-green PR (#14619) that flipped `int[M][N]` type-position nesting because a 2024 csyonghe issue comment said the master behavior was a bug; parent's challenge triggered spec verification and the explicit current spec text (`specification/types-array.md` Declaration Syntax: `ElementType[M][N]` ≡ `varName[N][M]`, "note the order of N, M"; Remark 3's std::array equivalence; Remark 2's mixed-spelling rule) documents master's last-bracket-outer reading as INTENDED, and master was conformant. Rule: for any fix that changes what existing source text MEANS, grep the language reference/spec FIRST (both the slang repo copy and shader-slang/spec at current HEAD — the local external/spec clone may be months stale, `git fetch` before citing), and treat a maintainer issue comment as one voice against it, not as the spec. Also: spec provenance via `git log -S "<exact spec phrase>" --reverse --all` finds author + introduction date fast.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1795103237559-slang-language-reference-now-in-shader-slang-spec-.md`_
