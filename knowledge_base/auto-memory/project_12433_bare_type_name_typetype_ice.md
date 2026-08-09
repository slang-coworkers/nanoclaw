---
name: project_12433_bare_type_name_typetype_ice
description: "slang#12433 (bare type name `MyType;` as a statement → E99997 unexpected: TypeType, target-independent) — the ICE spin-off I authorized on #12428, filed 08-08 14:30Z, 4 labels. CORROBORATED on my own edge (same SHA, different mount) + one CORRECTION now live in the issue body: exit 255 is slangc's GENERIC failure code, so the E99997 marker is the discriminator, not the exit code. HELD, not dispatched — the A-vs-B fix-LOCATION fork is shared with #12428 and unanswered (queue depth 63). RESUME on any human comment on either issue. ⛔ONE CLAIM RETRACTED: 'E30058 untested' INVERTS — code-grep cannot measure diagnostic coverage here (659 of 826 DIAGNOSTIC_TEST FILES carry no E-code); dangling-comparison.slang tests it AND is the template both issues need. ⚠️This chain also produced 5 vocabulary false zeros and a true parenthetical struck twice before restoration — see the two linked feedback leaves before trusting any zero or attribution in it."
metadata:
  node_type: memory
  type: project
  originSessionId: sess-1786199424980-ttxm68
---

# slang#12433 — bare type name in statement position is an ICE

Filed 2026-08-08 **14:30:23Z** by `nv-slang-bot[bot]` (the `slang-triager` edge), as the spin-off
**I authorized** on the #12428 chain. Labels at rest: `Diagnostics`, `Missing Diagnostic`, `bug`,
`reproduced`. **0 assignees, 0 comments.** Both open items from the #12428 memo are now **closed**:
the spin-off is filed, and comment `5226554214` (14:32Z) carries the bare `#12378` ref *and* the
`@jkwak-work` design-fork ask.

## State: HELD, deliberately — do NOT dispatch a fixer

⭐**The crash removes the warning-vs-error fork but NOT the fix-LOCATION fork, and the location fork
is SHARED with #12428.** An ICE must become a diagnostic — no source-compat debate. But:

- **Approach B** (implement the TODO at `slang-check-expr.cpp:3849`) fixes #12433 **and** #12428 in
  one change. The issue body itself argues this and is right.
- **Approach A** (narrow, in `visitExpressionStmt`) fixes only the statement form and leaves other
  value positions reaching the same `SLANG_UNEXPECTED`.

⇒ A fixer dispatched now would pick a location the maintainer may overturn 15 minutes later. Queue
depth **rechecked 08-08: 63** open bot-authored PRs (**was 59 that morning — +4 in one day**). A 64th
draft resting on an unanswered location question feeds the actual bottleneck. Same call, same reasons,
as [[project_12428_bare_func_ref_silent_dropped_codegen]].

## Corroborated on MY edge — second measurement, not a relay

My clone is at **exactly** the cited SHA `716ec597fc9c85111cd2fa06ba4e89bc4469b6b2`, clean tree,
mount `/dev/vda1[…/groups/main]` — a **different mount** from the triager's edge. All three cited
coordinates verified by me, not assumed:

- `// TODO: Implement this step.` → `slang-check-expr.cpp:3849` ✓
- `UNEXPECTED_CASE(GenericDeclRefType)` → `slang-lower-to-ir.cpp:3049` ✓
- `UNEXPECTED_CASE(TypeType)` → `slang-lower-to-ir.cpp:3050` ✓

Probe + all four other spellings (`int;`, `float4;`, `MyAlias;`, `RWStructuredBuffer<int>;`) →
exit 255 + identical `E99997 … N5Slang13InternalErrorE unexpected: TypeType`. Control (line removed)
→ exit 0, **0 diagnostic bytes, and a real HLSL file written** (positive verification, not mere
absence — so the crash cells' missing output is meaningful).

⚠️**Binary staleness bounded rather than caveated.** My `slangc` is `2026-08-04 07:50:48`; HEAD is
`2026-08-07T23:26`. `slangc -v` prints **`1785829848`** — a **build timestamp, not a git hash**, so
`-v` CANNOT pin a binary to a commit. Three commits touched the two precondition files after the
build, but at both sites the code is **unchanged** (`UNEXPECTED_CASE(TypeType)` at `:3050` in base
*and* HEAD; the `CheckExpr` body diffs **empty**; the TODO only shifted 3835→3849). ⇒ For these two
sites binary and HEAD agree, so the repro is not a staleness artifact.

## ⭐ THE CORRECTION — exit 255 does NOT discriminate a crash

Measured by me directly, three cells, one binary:

| statement | exit | `E99997` count | first line |
|---|---|---|---|
| `nosuchthing = 1;` | **255** | 0 | `error[E30015]: undefined identifier` |
| `(MyType);` | **255** | 0 | `error[E20002]: syntax error` |
| `MyType;` | **255** | **1** | `note 99999: an internal error …` |

**Exit 255 is slangc's generic failure code.** The issue body presents *"Exit code 255"* as part of
the crash signature and describes `(MyType);` as *"a clean parse error, no crash"* **without noting
it also exits 255**. ⇒ **The discriminator is the `E99997` marker, never the exit code.** This is
load-bearing, not cosmetic: the issue's own test-coverage recommendation asks for a test covering the
five crashing spellings *plus the parenthesised form as the already-correct boundary* — **written
against exit codes, that boundary cell passes for the wrong reason** and the test asserts nothing.

## ⛔ RETRACTED — the "E30058 is untested" claim INVERTS. Corrected 08-08 by `slang-triager`, re-measured by me

⚠️**My first census used a bad control and returned `control_hits=0`** — I nearly read that as a
broken instrument. It was a bad *control choice*: the same grep machinery finds **826**
`DIAGNOSTIC_TEST` files, so the instrument was fine. Re-run properly:

- ⛔~~`E30058` has **zero** in-tree tests ⇒ the precedent diagnostic the fix must match is itself
  untested.~~ **FALSE, and it was the reassuring kind of false.** The grep was correct as executed
  (`grep -rl E30058 tests/` → **0**) and the conclusion drawn from it was wrong:
  **`tests/diagnostics/dangling-comparison.slang` DOES test it**, asserting on message prose + carets.
  ⇒ **In this repo a diagnostic's coverage cannot be measured by grepping its CODE.** Grep the message
  text from `slang-diagnostics.lua`, never the code. Full rule + the check:
  [[feedback_diagnostic_coverage_cannot_be_grepped_by_code]].
- ⛔**MY OWN CENSUS HELD THE DISCONFIRMING HIT AND I DISMISSED IT.** I did not merely fail to find the
  file — I ran `grep -rl '30058\|dangling' tests/`, got **`tests_30058=1`**, saw the hit was
  `fp-literal-inf-forms.slang`, and concluded *"no test"* from a **nonzero** result. The `dangling`
  half of that alternation was one `find` away from the answer: **`find tests/ -iname '*dangling*'`
  returns `dangling-comparison.slang`** — but its **filename** carries `dangling` while its
  **content** does not (0 hits), so a content-grep for `dangling` cannot see the file its own name
  advertises. ⇒ ⭐⭐⭐**A census with one unexplained hit is not a negative result. Explain every hit
  or the zero is fabricated** — and when a pattern targets a *concept*, search **names as well as
  contents**.
- ⛔**`659 of 826` — I WAS WRONG TWICE, AND MY FIRST FRAMING WAS THE RIGHT ONE.** I wrote *"two agents
  agreed"* (true), struck it as a self-miscredit, then struck it again as a false corroboration, before
  the evidence restored it. **Settled at source:** `sess-1786184250458-0ya6l9` — agent group
  `ag-1780667166418-apezq5` (the **peer's** group), thread `…-12428` — outbound row 25 at **15:07Z**:
  *"Your 167/659/826 reproduces exactly on my clone."* That is **3 min before** my 15:10 *"your 659 of
  826"*, so I was addressing a tier that HAD derived it. My *"0 hits in their posted comments"* was a
  sound grep over the **wrong population** — I searched GitHub comments and one shared learning, never
  the peer group's **sessions**. ⇒ ⭐⭐⭐**The unit of "what my side said" is the `agent_group_id`, never
  one session; and a row-count mismatch means DIFFERENT SESSION, not NO SUCH SESSION** (95/14 vs my 8/3
  correctly said "not yours" — I read it as "phantom", with the session id already sitting in my own
  earlier output). Full four-position table, the slash-joined false zero that drove the reversal, and
  the both-directions low-audit note: [[feedback_the_unit_of_what_my_side_said_is_the_agent_group]].
  ⇒ ⭐⭐**A correction that would strike a TRUE statement is the expensive direction** — ask what would
  have to be true for the claim to be right, and go look for *that*.
- ✅**The arithmetic survives and both figures need their regex printed** (re-derived by both edges,
  agreed): `E[0-9]{5}` → **167 with / 659 without (79.8%)**; bare `[0-9]{5}`, so a `//CHECK: 30058`
  counts → **277 with / 549 without (66.5%)**. Two right answers to different questions, 110 files
  apart. ⇒ **A coverage denominator is meaningless without the matching pattern beside it.**
- ⭐**The retraction PAYS OUT: that file is the template both issues need** — `a == 2;` as the
  diagnosing cell and **`(a == 2); // ok.` at `:13`** as the boundary — structurally identical to the
  crashing-cell-plus-ok-cell shape, already asserting the right way. A false "untested" verdict does
  not merely add work, **it hides an existing template** the fixer would otherwise rewrite from
  scratch. Now cited in #12433's body and cmt `5226631585`.
- `TypeType` in `tests/`: 0 files. *(This one stands — but note it is the same instrument class, so
  read it as "no test names the type" and not necessarily as "no coverage".)*

## Mechanism — predicts the observed coordinates

`CheckExpr`'s unimplemented step lets a bare type name survive checking as a `TypeType`-typed
expression; lowering asserts an invariant the macro's own comment declares (*"types we do not expect
to encounter in ASTs that have passed front-end semantic checking"*). This explains **why all five
type-naming spellings behave identically** (alias / builtin scalar / builtin vector / user struct /
generic all reach lowering as `TypeType`) **and why `(MyType);` differs** — it dies in the **parser**,
before checking runs, so it never reaches `:3050`. `grep` finds no other source of the `unexpected: `
literal, so `:3050` is the only site that can emit it.

## Cross-links — verified BIDIRECTIONAL on the timeline

✅`cross-referenced` from **12428 → 12433** *and* **12433 → 12428** both present on the API timeline.
The bare-ref fix worked; the backtick failure recorded in
[[feedback_a_backticked_issue_ref_creates_no_crosslink]] did **not** repeat. Checked with the timeline
API, not by eyeballing rendered markdown.

## Sessions — ⛔ "NO TRIAGER SESSION ON 12433" WAS STALE. Re-measured 08-08 ~16:0xZ

~~`ncl sessions list | grep 12433` → one session, mine; **no triager session on the 12433 thread**.~~
**FALSE as of the re-measure** — flagged by the peer, verified by me:

| session | group | thread | state |
|---|---|---|---|
| `sess-1786200351605-ecf22e` | `ag-1780667166418-apezq5` (**triager**) | `…-12433` | active/running, 10 rows |
| `sess-1786199424980-ttxm68` | `ag-1776713211742-1w6l4e` (**me**) | (no thread) | active |
| `sess-1786184250458-0ya6l9` | `ag-1780667166418-apezq5` (**triager**) | `…-12428` | active/running |

⇒ **The advice survives, the premise didn't:** still carry `thread_id=gh-issue-shader-slang/slang-12433`
verbatim — now because a session exists to route *to*, not because none does.
⚠️⭐⭐**A session inventory is live state and expires in minutes.** I recorded a *negative* about another
group's sessions, which is the class with no failure signature: a reader complies by not routing there
and nothing logs the miss (cf. [[feedback_published_negative_env_claims_need_rederivation]]).
⇒ **Re-run `ncl sessions list` at the moment of dispatch; never route from a stored session census.**

⚠️**ADJACENT CHAINS LIVE IN THE TRIAGER'S GROUP RIGHT NOW** (same day, adjacent numbers — expect the
shared-identity attribution problem this chain spent four positions on):
`…-12430` (`o2s62i`, plus `1du59f` in a *third* group `ag-1780667168475-a9tac8`), `…-12431` (`yo24g4`),
`…-12432` (`mjdtu9`). ⇒ **When an artifact appears under this bot identity, resolve WHICH session by the
INBOUND MESSAGE-ID SEQUENCE, not by group** — see the sibling-hypothesis failure in
[[feedback_diagnostic_coverage_cannot_be_grepped_by_code]].

## RESUME triggers

- **Any human comment on #12428 or #12433** — especially the A-vs-B location answer ⇒ then dispatch
  `slang-fixer` **through `slang-triager`** on the canonical thread.
- If the maintainer picks **B**, one fix closes both; brief the fixer with **both** issues' shape
  constraints (the four silent shapes + "key on discarded-statement position, never on FuncType").
- **No maintainer activity on #12428 as of 14:47Z** — the `@jkwak-work` ask was ~15 min old.

Related: [[project_12428_bare_func_ref_silent_dropped_codegen]] (the parent chain, the ask→answer→
dispatch template, and the fixer-brief constraints), [[feedback_triage_github_posting]] (verified ⇒
post; hold only a maintainer design-call where an artifact exists),
[[project_12430_existential_static_requirement_ice.md]] (the other 08-08 ICE, unrelated root).
