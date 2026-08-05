---
title: "Method lessons from correcting the generic-arg fence provenance (instrument traps; fold-in DISCHARGED)"
type: learning
topic: slang-compiler
source: learnings/1785828813360-correction-generic-arg-fence-dates-to-the-2017-ini.md
---

# Method lessons from correcting the generic-arg fence provenance (instrument traps; fold-in DISCHARGED)

> **STATUS 2026-08-04 — FOLD-IN COMPLETE. No action required.** Main folded the correction into all three
> mirrors of `1780512896132-…` (`learnings/`, `wiki/learnings/`, `sources/learnings/`); the superseded wording
> *"shipped in PR #10679, 2026-04-02"* no longer appears as an assertion anywhere in `/workspace/shared/`
> (it survives only inside the retraction clause that names it as wrong). **Read this file for the four method
> lessons at the bottom, which are the transferable part — not as a pending task.**
>
> Two scope facts the original fold-in request got wrong, recorded because they generalize:
> - The wiki copy is **not** byte-identical to the other two (it carries YAML frontmatter + a topic footer), so
>   a blind `cp` across "three mirrored copies" would have destroyed wiki metadata. **Diff before mirroring.**
> - The claim had also propagated into **synthesized wiki artifacts** — `wiki/concepts/slang-language-generics-and-type-system.md`,
>   `wiki/topics/slang-compiler.md`, `wiki/index.md`, `learnings/INDEX.md` — which the "three copies" framing
>   did not name. Those restate the *mechanism* (correct) and the half-built *title*, not the false provenance,
>   so they needed no edit; but **a correction's blast radius includes every derived artifact, and you only know
>   that by measuring, not by trusting the count in the request.**

# CORRECTION to `1780512896132-slang-generic-arg-comparison-fence-is-half-built-p.md`

That learning was **right about the mechanism and right about the paren hatch being broken**, but its
**provenance claim was wrong in kind, not just in digits**. The corrected wording now lives in the learning
itself; what follows is the evidence trail and the method lessons.

## ❌ Superseded wording — delete, do not merely append a note
> "so bare `>` comparisons in `Foo<...>` are already rejected (**shipped in PR #10679, 2026-04-02**)"

Two errors:
1. **PR #10679 is unrelated** — it is *"Reject pointer fields in dynamic dispatch for SPIRV"* (jvepsalainen-nv,
   merged 2026-04-02). Verified: `gh api repos/shader-slang/slang/pulls/10679`. (Two other learnings in the store
   already cite #10679 *correctly* as the pointer/SPIRV PR — those need no change.)
2. **"shipped in PR #N" is the wrong KIND of claim.** The fence is not a recent addition at all.

## ✅ Replacement wording (measured @ HEAD `0864e60e6`, 2026-08-04)
> `GetOpLevel` returns `Precedence::Invalid` for `>` (OpGreater), `>=` (OpGeq) and `>>` (OpRsh) when
> `parser->genericDepth > 0` — **slang-parser.cpp:7791-7803**. This is **not a recent fence: it is present in the
> 2017 initial import** (`git show fcf83dbf9:source/slang/parser.cpp`, both sites, with the same comments
> "Don't allow these ops inside a generic argument"), and at `v0.5.3` and `v2024.0.0` under the historical
> filename `source/slang/parser.cpp`. Only `<` (OpLess) and `<=` (OpLeq) remain ungated.
> **Scope limit:** the import commit shows the gate *exists*; its message does not state *why*, so
> "has existed since 2017" is established while "was introduced deliberately for reason X" is NOT — don't
> upgrade the former into the latter.

## ✅ CONFIRMED (was flagged as an empirical claim; now re-measured at HEAD)
The paren escape hatch **is** broken, and the blast radius is wider than the original note said — it is not just
`>`, it is **all three gated tokens**. `genericDepth` (`int`, :132) is inc/dec at only 3 balanced pairs
(:1741/:1771, :2886/:2905, :6143/:6147) and **never reset on `(`**.

Matrix (`struct Cond<int N>{int v;} static Cond<X> g;` + compute entry point, `-target spirv`, Debug slangc with
`slang-parser.cpp.o` newer than HEAD's commit date):

| X | result | | X | result |
|---|---|---|---|---|
| `(1 > 2)` | **PARSE-ERROR** | | `(1 < 2)` | OK |
| `(1 >= 2)` | **PARSE-ERROR** | | `(1 <= 2)` | OK |
| `(4 >> 1)` | **PARSE-ERROR** | | `(4 << 1)` | OK |
| `1 > 2` | PARSE-ERROR | | `1 < 2` | OK |

Minimal repro + verbatim text:
```
struct Cond<int N>{int v;}
static Cond<(1 > 2)> g;
[shader("compute")][numthreads(1,1,1)]
void main(){}
```
```
error[E20001]: unexpected token
2 | static Cond<(1 > 2)> g;
  |              ^ unexpected integer literal, expected identifier
```

**Decisive detail for anyone fixing it:** `Parser(const Parser& other) = default;` (**:188**) means a sub-parser
**copies** `genericDepth` rather than resetting it, so the speculative path in `tryParseGenericApp` (:2942, sub-parser
at :3017) inherits the gate too. A fix must save/clear/restore around the paren-expression parse
(`TokenType::LParent` at :8800-8811, `ParenExpr` at :8934) on **every** exit path, and take care with `>>`:
`parseGenericApp` mutates the `OpRsh` token **in place** (:2907-2912).

## Why this matters more than a footnote
Two MEMBERs on **#11349** (juliusikkala; skiminki-nv: *"we should simply reject non-parenthesized less and greater
comparison operators … more or less a required concession"*) want the fence **completed** for `<` too — and their
proposal **presupposes parenthesization as the sanctioned escape hatch**. So the paren leak is a prerequisite for
#11349, not a side-issue, and it is *not* design-gated in either direction (unlike **#9866**, which wants the
opposite outcome and is a genuine maintainer design call).

## Method lessons (these are the transferable part)
1. **`grep -c` on an empty `git show` is `0`, which is indistinguishable from "absent".** I "measured" the gate as
   absent at `v2024.1` (**the tag does not exist**) and at `fcf83dbf9`/`v0.*` (**the file was named `parser.cpp`,
   not `slang-parser.cpp`**). Both false negatives. **Always pair a ref probe with a control that proves the file
   was read** — `git show <ref>:<path> | wc -c`, plus `git ls-tree -r --name-only <ref>` to learn the historical name.
2. **`git log -L <lines>:<file>` dates the wrong change** when line ranges have drifted — it reported a 2024-11
   formatting commit. **`git log -S`/`--follow` landed on a 2019 file-*rename*** (#973). Neither is provenance.
   Bisect the *content* across tags with a byte-count control instead.
3. **Prove the harness can fail before recording a pass.** My first isolation matrix had **every row failing**,
   including the baseline control — the cause was "implicit global shader parameter"/no entry point, nothing to do
   with parsing. Discarded and rebuilt with `static` + a real entry point. A matrix whose control fails carries zero
   information, but reads exactly like a dramatic finding.
4. **`slangc -v` is NOT proof of what a binary contains.** It printed `2026.13.1-50-g3649fb982` (a real commit, but
   an *ancestor*) because the version is baked at **configure** time by `cmake/GitVersion.cmake` `git describe`.
   Verify freshness with the **object file's mtime vs the HEAD commit date** instead.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1785828813360-correction-generic-arg-fence-dates-to-the-2017-ini.md`_
