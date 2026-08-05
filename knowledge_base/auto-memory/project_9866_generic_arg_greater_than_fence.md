---
name: project-9866-generic-arg-greater-than-fence
description: "slang#9866 bare `>` in generic args — design-gated vs"
metadata: 
  node_type: memory
  type: project
  originSessionId: 05057eff-314b-4968-a795-3edbe99c0734
---

# slang#9866 — `>` recognized as end of generic value arguments

Triaged 2026-08-04 by slang-triager, verified @ master `0864e60e6`. Verdict posted as
[comment 5176095755](https://github.com/shader-slang/slang/issues/9866#issuecomment-5176095755)
(fresh comment, not an edit — last commenter was jkwak-work, a human). Label `reproduced` applied.

## The issue SPLITS — only one slice is actionable

**Slice 1 (bare `Cond<1 > 2>`) — DESIGN-GATED, not a bug.** `GetOpLevel` returns `Precedence::Invalid`
for `>`/`>=`/`>>` when `parser->genericDepth > 0` (`source/slang/slang-parser.cpp:7791-7803`). Present in
the **2017 initial import** (`fcf83dbf9:source/slang/parser.cpp`) — not a regression.
⛔ **#9866 and #11349 point in OPPOSITE directions and this is the gate:** #11349 (juliusikkala, OPEN,
assignee skiminki-nv, milestone Q3 2026) proposes *banning* unparenthesized `<`/`>` in generic args;
skiminki-nv agrees verbatim *"we should simply reject non-parenthesized less (`<`) and greater (`>`)
comparison operators … more or less a required concession"*. #9866 (jkwak-work, self-assigned) wants `>`
*supported*. Slang sits halfway: `>`/`>=`/`>>` gated, `<`/`<=`/`<<` not. **Granting #9866 means removing a
fence #11349 wants completed. Do not guess this — jkwak-work vs juliusikkala/skiminki-nv must settle it.**

**Slice 2 (parenthesized `Cond<(1 > 2)>`) — REAL standalone parser bug, P2, NOT design-gated.**
jkwak's own suggested workaround fails at HEAD. Both camps assume parens are the sanctioned escape hatch
(#11349's proposal *presupposes* it), so this needs fixing regardless of slice 1's outcome — arguably a
prerequisite for #11349.

Cause: `genericDepth` (`int`, :132) inc/dec at only 3 balanced pairs (:1741/:1771, :2886/:2905, :6143/:6147),
**never reset entering a balanced sub-expression**. Leaks through **all three gated tokens AND all three
balanced delimiters** (measured with passing controls): grouping `(1 > 2)`, call-arg `id(1 > 2)` (:9144),
subscript `a[(1 > 2)]` (:9117) all fail; every `<` mirror passes. Model defect: `genericDepth` conflates
*"lexically inside a generic arg list"* with *"a `>` here could close it"*.

Fix constraint: `Parser(const Parser&) = default` (:188) ⇒ sub-parsers **copy** the depth. Prefer scoped
`SLANG_DEFER`/RAII suspension around paren parse (:8800-8811, `ParenExpr` :8934); existing inc/dec are manual
and not early-return safe. Do NOT suspend across the cast operand at :8928. `>>` is mutated **in place** at
:2907-2912.

## State / RESUME

- **No fixer dispatched** — self-filed by a maintainer + design-gated (pre-authorize XOR hold).
- **RESUME** = jkwak-work answers either (1) support-or-reject the bare form, or (2) scope of the slice-2 fix
  (parens only vs all balanced delimiters). Either answer unblocks: slice 2 → slang-fixer.
- Approach C (better diagnostic naming the ambiguity + advising parens) is a cheap interim win either way,
  and becomes *accurate* only once slice 2 is fixed. #11349's approach 1 is the same idea.
- ⛔ Do NOT implement slice 1 ("relax the gate") without an explicit maintainer decision + `shader-slang/spec` PR.

## Corrections banked from this chain (do not re-assert the originals)

- ⛔ **"C++ has the same restriction inside template argument lists" is FALSE** — measured g++ `-std=c++17`:
  `X<1 > 0>` errors but **`X<1 >= 0>` compiles (exit 0)**. C++ fences bare `>` only, and *accepts* `>=`.
  Correct framing: C++ has an *analogous* ambiguity for bare `>`; parenthesizing is conventional there — and
  **C++'s parenthesized form works, whereas Slang's does not.** That's the defensible bug either way.
- ⛔ **`>=` does NOT "close the list".** Only `OpGreater` is a valid closing delimiter; `OpRsh` gets the
  split-into-two-`>` treatment (:2907-2912); **`OpGeq` has NO delimiter interpretation** — it is merely
  suppressed as an operator and drives parse *recovery* (:2915), which is why its diagnostic differs.
- ⛔ **`slangc -v` is not proof of what a binary contains** — it printed `2026.13.1-50-g3649fb982`, a
  *configure-time* string baked by `cmake/GitVersion.cmake` `git describe`. Use the **object file's mtime vs
  the HEAD commit date** (`slang-parser.cpp.o` 07:26 > HEAD 04:18) to prove freshness.
- Shared-store provenance claim corrected: the fence did **not** ship in PR #10679 (that is "Reject pointer
  fields in dynamic dispatch for SPIRV", jvepsalainen-nv — I verified independently). See
  [[a-corrections-blast-radius-includes-derived-artifacts]].

Related: [[feedback_control_the_instrument_not_the_reasoning]]

## ⚠️ OWNERSHIP OF SLICE 2's FILING — OWNED BY ME, ask already sent 08:0xZ (sibling-written section CORRECTED)

⛔ **A sibling session wrote this section at 08:15Z asserting "unowned … I did NOT accept it … the triager
attributed the ask to me without a handshake." That history is FALSE, and I am the one who can refute it:**
I proposed the ask myself, unprompted, in my own words — to the triager (*"I'm asking the operator whether
to file it. If they green-light it, I'll dispatch — with your memo as the body"*) and to the operator
(*"say the word and I'll dispatch the fixer"*). The triager did not attribute anything to me; **I
volunteered it and the ask is already out.** So the action is **owned (by me), pending the operator's
answer** — not unowned, and there was nothing to hand back.

⭐⭐⭐ **THE REAL LESSON, and it is the sharper one: a SIBLING SESSION wrote a DECISION into my memory file
based on a claim about my own state that it could not observe.** It could not see my outbound messages, so
it read "no record of acceptance in this file" as "no acceptance occurred" — **absence of a record in one
artifact taken as absence of the event.** Same error class as the refuted hook mechanism, running in the
opposite direction: there, I promoted a correlation to a named mechanism; here, a sibling promoted a
missing note to a settled fact. ⇒ **Before a sibling-authored "decision" section changes behaviour, check
whether it rests on something the writer had no instrument for.** Sessions share this filesystem but NOT
each other's conversations ([[slang-memory-index-siblings-share-container]]).

⭐⭐ Corollary that survives: **an action item attributed to you by a peer is not one you hold** — but the
inverse is equally load-bearing: **one you VOLUNTEERED is yours even if no file records it.** Check the
outbound record, not just the notes.

**Measured state 2026-08-04 08:15Z:** slice 2 is genuinely **unfiled** (`search/issues` for a
parenthesized-generic-arg parse issue ⇒ `total_count` 0). #9866 is OPEN, sole assignee `jkwak-work`,
2 comments. Its `updated_at` 07:47:49Z looks like fresh activity but is **our own bot's triage comment**
(`5176095755`, `nv-slang-bot[bot]`) — **not** a routing inbound, so the design gate has NOT moved and the
trigger correctly has not fired. The only human comment is jkwak's from 2026-02-06.

⇒ **Decision, reconciled 08:17Z: do NOT file slice 2 unilaterally — and the sibling's substantive reasoning
for that is RIGHT and I adopt it.** #9866 already carries slice 2; it is a maintainer's self-filed issue with
jkwak assigned; our triage comment naming both slices is public on it — so the bug is *recorded and visible*,
which is most of what filing would buy. Filing a second issue for a slice of a maintainer's open issue,
uninvited, is the dup-issue trap. **That argument is stronger than my "ask and then dispatch" instinct, and
it is why I will not file even on a bare go-ahead without saying this first.**

⚠️ **One divergence, deliberate: the ask to the operator is already SENT and I am not retracting it** — an
operator green-light is a *human* authorization, which is exactly the gate the dup-issue trap needs, and
withdrawing a question I already asked would leave them answering into a void. Net posture: **ask stands,
filing stays blocked on either (a) the operator explicitly green-lighting it, or (b) jkwak inviting the
split.** Neither has happened. ⭐**A sibling may not silently cancel an outbound ask it cannot see.**

**Measured 08-04 08:17Z (dedup re-verified by me, WITH controls — the sibling's `total_count` 0 was correct):**
`repo:shader-slang/slang genericDepth parenthes in:body` ⇒ **0**; non-zero control
`generic value arguments in:title` ⇒ **2**; instrument control `is:issue` ⇒ **4,768**. So slice 2 is
genuinely unfiled and the zero is trustworthy — ⭐**the sibling's number survived because I re-ran it with a
control it never had.**

**RESUME (unchanged): jkwak answers support-or-reject or names the fix scope** → slice 2 to slang-fixer as a
draft. If jkwak asks for slice 2 split out, *that* is the invitation to file and it arrives as a webhook.
⚠️ **#9866's `updated_at` 07:47:49Z is OUR OWN bot comment `5176095755`** (`nv-slang-bot[bot]`) — not a
routing inbound; the design gate has NOT moved. Only human comment is jkwak's from 2026-02-06.
