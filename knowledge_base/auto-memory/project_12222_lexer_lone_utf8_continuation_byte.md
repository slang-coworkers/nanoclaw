---
name: project-12222-lexer-lone-utf8-continuation-byte
description: "slang#12222 lexer doesn't diagnose lone UTF-8 continuation bytes — triaged+reproduced, PARKED (skiminki-nv owns)"
metadata: 
  node_type: memory
  type: project
  originSessionId: 31eb18b6-452a-4e17-a097-402c76c20ce3
---

shader-slang/slang#12222 — "Lexer does not diagnose lone UTF-8 continuation bytes." Split-off follow-up of #11858; NOT a regression (the #11858 silent-truncation regr was fixed by merged #11886 / `3e061e1`, which handles lead-byte-first malformed sequences only). Bug / diagnostic-completeness · low · P3 · frontend-lexer.

**State (07-29):** RE-PARKED after backward-compat analysis. Milestone now **`slang 202c`** label + "Q3 2026 (Summer)" milestone (applied by skiminki-nv 07-29). Backward-compat analysis posted (comment 5121982317, verified live): no load-bearing compat case; everything Approach A newly rejects is already-invalid UTF-8 (orphan continuation bytes = mis-encoded/corrupt input); valid multi-byte UTF-8 (café 0xC3 0xA9) still compiles; `\xNN` hex escape on separate `_decodeStringEscape` path UNAFFECTED (`"\xA8"` compiles clean); lone LEAD byte already errors today (#11886) so no new KIND of rejection. Same shape as #11886 (merged `pr: non-breaking`). Recommendation UNCHANGED, still skiminki's PR to own. Analysis-only, NO fix dispatched.

**State (07-24):** TRIAGED + REPRODUCED @HEAD 5281ccc66 → **PARKED at triaged, NO fixer dispatched.** Author/assignee **@skiminki-nv** self-filed (via nv-slang-bot) + self-assigned + explicitly deferred to "a subsequent PR" he intends to own (per his #11858 comment, for clean bisectability). Verdict posted on issue (comment 5073086030); labeled `reproduced`, Type=Bug. Matches self-filed+self-assigned → author-owns pattern (cf. [[project_11782_conditional_symbolic_flag_spirv_ice]]).

**Repro:** `/* <0xA8> */` (lone continuation byte in comment) → `-target spirv -no-codegen` exit 0, zero diagnostics (orphan swallowed); control `/* <0xC0> */` (lone LEAD byte) → `error 10006: invalid UTF-8 byte sequence: 0xC0` (proves #11886 live; gap is continuation-specific).

**Root cause / fix (memo ready if bot takes it):** guard `if (isUtf8LeadingByte((Byte)c))` at `slang-lexer.cpp:267` (`_peek`) & `:350` (`_advance`) too narrow — never routes continuation bytes into decoder. Decoder `getUnicodePointFromUTF8` (`slang-char-encode.h:35-39`) ALREADY rejects a leading continuation byte (`leading<=0xBF → valid=false`, consumes exactly 1 byte). **Approach A (rec):** broaden both guards with `|| isUtf8ContinuationByte((Byte)c)` → enters correct decoder → E10006 + consume-and-recover, mirroring #11886. ~2 lines + test extending `tests/bugs/gh-11858-malformed-utf8.slang` (or new `gh-12222-*.slang`) under `//TEST:SIMPLE(filecheck=CHECK): -target spirv -no-codegen`. Approach B (hand-rolled diagnose) rejected — duplicates decoder path. Full memo: `/workspace/inbox/a2a-1784917162062-1pdkxy/triage-12222.md`.

**07-24 maintainer comment (5121888407):** @skiminki-nv set this **tentatively for Slang 202c** — cautious about backward-breaking change: *"unless it turns out that the stray continuation bytes wouldn't likely compile anyway."* NOT a "make a PR" trigger. Raised an open backward-compat question our triage can answer. → re-opened chain, dispatched to slang-triager to assess + post grounded reply (analysis, NOT a fix). **Key nuance:** guard-broadening (Approach A) affects the general char-read path, so a lone continuation byte anywhere (comment / string / identifier via `isNonAsciiCodePoint`) that compiles today would NOW diagnose → technically backward-breaking for mis-encoded files (supports 202c gating). BUT a lone continuation byte is *always* invalid UTF-8, arising only from mis-encoding/corruption (valid UTF-8 never has an orphan 0x80–0xBF) — so the breakage only ever hits already-malformed input. Triager to verify the three current-acceptance paths + post.

**Release trigger:** @skiminki-nv comments "make a PR" / reassigns to bot, OR operator says the word → hand to slang-fixer with the memo (Approach A). Milestone now = Slang 202c (tentative). Umbrella #11858 remains OPEN.
