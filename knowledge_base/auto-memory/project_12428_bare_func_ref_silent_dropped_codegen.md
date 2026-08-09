---
name: project_12428_bare_func_ref_silent_dropped_codegen
description: "ARMED CO-TRIGGER — slang#12428 (bare unapplied func ref silently dropped; missing () on a barrier removes the barrier, 0 diagnostics, 6/6 targets) is TRIAGED-but-NOT-DISPATCHED, awaiting @jkwak-work on warning-vs-error / A-vs-B (notified 08-08 14:32Z, cmt 5226554214). Root cause = the // TODO at slang-check-expr.cpp:3849. ICE spin-off #12433 filed and cross-linked by effect. RESUME on any human comment on #12428 or #12433 — the wait is on a human, so re-ping rather than assume progress."
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-12428-routing
---

# slang#12428 — bare unapplied function reference is silently accepted and dropped from codegen

Filed 2026-08-08 by `nv-slang-bot[bot]` from a Discord report by **wide0125**. Labels at rest:
`Diagnostics`, `Missing Diagnostic`, `bug`, `reproduced`; Type=Bug. **0 assignees.**
`GroupMemoryBarrierWithGroupSync;` without `()` removes the barrier — a silent data race from one
missing character, 0 bytes of diagnostic on every target.

## State: TRIAGED, HELD ON A MAINTAINER ANSWER — do NOT dispatch a fixer

`slang-triager` triaged it (memo `triage-12428.md`, 178 lines) and **deferred dispatch to me**;
I declined to dispatch, for two reasons in priority order:

1. ⭐**The open design fork changes the fix's shape and is a source-compat call** — warning vs error,
   and Approach A vs B. Not a detail a fixer may pick. Triager was right to leave both open.
2. **Queue depth measured: 59 open bot-authored PRs, oldest 2026-06-01.** A 60th draft resting on an
   unanswered design question does not accelerate this; it feeds the actual bottleneck.

⇒ **The #12367 template is the model: ask → get the answer → then dispatch.** On that chain the fork
sat until an explicit `@jkwak-work` ask, and *"let's have a diagnostic error message … Make a PR"* is
what unblocked it.

## RESUME triggers

- **Any human comment on #12428 or #12433** (esp. an answer to warning-vs-error) ⇒ dispatch
  `slang-fixer` on canonical thread `gh-issue-shader-slang/slang-12428`, through `slang-triager` (it
  owns the chain and holds the memo — **parallel dispatch to the same peer mints duplicate sessions**).
- ✅**RESUME PATH ARMED 08-08 16:22Z — series `i12428-fork-gate-52aa`**, `0 */6 * * *`, script
  `/workspace/agent/.i12428_fork_gate.sh`, session `sess-1786206142917-6xepkc`. Wakes only on a **non-bot**
  comment on #12428 after cmt `5226554214`, or any human comment on #12433, or either issue closing.
  ⭐**PROVEN ARMED BEFORE SCHEDULING, not just written:** pointed at #12367 as a positive control it
  returned `wakeAgent:true, reason=human_reply` naming commenter/ts/id (`csyonghe@…#5212908232`); cold and
  warm runs on the real target both return `wakeAgent:false` (no spurious re-fire). ⇒ satisfies
  [[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] — **the peer's "I'll re-ping on my
  next sweep" was the only trigger before this, and it is not one I control.**
- ⛔**GAP FOUND AND CLOSED 08-08 16:2xZ — the gate's non-bot predicate was BLIND to same-identity posts.**
  The peer flagged it: a sibling posted cmt `5226660337` on #12433 refining the fixer brief, **under our
  shared `nv-slang-bot[bot]` identity**, so my gate correctly would *not* have woken — and the material
  change reached me only because the peer happened to be mid-write. ⇒ **same-identity refinements on a
  closed chain had NO watcher on either side.** Added a `same_identity_comment` branch: bot-comment counts
  vs baselines `BOT_BASE_A=2 / BOT_BASE_B=2` (read and reconciled 16:2xZ), waking to *read and verify*
  rather than to trust. ⭐**Proven armed:** silent at baseline (cold **and** warm), and firing on a
  baseline lowered by 1; **plus a regression check that the human-reply branch still arms** against
  #12367 after the edit. ⇒ ⭐⭐**A watcher scoped to "the other party" is blind to your own side, and under
  a shared identity your own side can change the facts.** On wake, **raise the baseline — never mute the
  check.**
- ⚠️The wait is on a HUMAN. If the gate is silent for 4+ consecutive wakes (~24h) the task nudges
  `orchestrator-dashboard` (budget: 2), and **never** nudges the maintainer on GitHub.

## ✅ BOTH FOOTPRINT REPAIRS DONE 08-08 — verified BY EFFECT on my own edge

Triager posted fresh cmt **`5226554214`** (chose fresh over an edit deliberately: *an edit notifies
nobody, and the notification WAS the deliverable*). **I re-verified both effects myself, not the report:**
- #12378 `cross-referenced`: **1 → 2**, new one **`from #12428 at 2026-08-08T14:32:22Z`**.
- #12428 now carries **`mentioned jkwak-work`** + **`subscribed jkwak-work`** (both previously absent).
- #12428 `cross-referenced`: **0 → 1**, `from #12433` — so the ICE link is bidirectional **by effect**.
⇒ ⭐**This is the only check that can see this class**; the body text could not have told me.

## ✅ ICE SPIN-OFF FILED: **#12433**

*"A bare type name used as an expression-statement crashes the compiler (`MyType;` → internal error
'unexpected: TypeType')"* — OPEN, Type=Bug, labels `Diagnostics`/`Missing Diagnostic`/`bug`/`reproduced`.
5 spellings ICE identically (`MyType;`, `int;`, `float4;`, `MyAlias;`, `RWStructuredBuffer<int>;`);
**`(MyType);` gives a clean `E20002`** = the boundary.

⭐⭐⭐**THE STRONGEST ARGUMENT IN THE CHAIN, and it arrived only after the finding was re-examined —
VERIFIED VERBATIM ON MY OWN CLONE:** `slang-lower-to-ir.cpp:3041-3042` carries the comment *"We do not
expect to encounter the following types in ASTs that have **passed front-end semantic checking**"*
immediately above the `UNEXPECTED_CASE` macro, and **`UNEXPECTED_CASE(TypeType)`** is in that list.
⇒ **Lowering is behaving exactly as designed — asserting an invariant. The bug is that NOTHING
ESTABLISHES the invariant, and the thing that should is the TODO at `slang-check-expr.cpp:3849`, whose
own comment says "names a value and not a type."** Also verified on my edge: all 3 `ExpectATypeRepr`
call sites (`slang-check-type.cpp:44`, `slang-check-overload.cpp:504`/`:656`) guard the **inverse**
direction only ⇒ **nothing guards value position.**
⇒ This turns the ICE from *"a crash"* into *"a documented invariant with no enforcer"* — which is what
makes it a genuine second justification for Approach B rather than just another bug.
**CO-TRIGGER: if a maintainer picks B, #12433 closes with the same PR.**

## Root cause — verified on MY clone, not just relayed

Same commit `716ec597f`, **different mount** (`/dev/vda1[…/groups/main]`), 0 tracked mods:
- `slang-check-expr.cpp:3849` — literal **`// TODO: Implement this step.`** where `CheckExpr` should
  "ensure that the `expr` actually has a type that is allowable in an expression context (e.g., make
  sure that `expr` names a value and not a type)". **This is the whole bug.**
- `slang-check-expr.cpp:1601-1608` — `maybeResolveOverloadedExpr` is the asymmetry: `OverloadedExpr`
  → `_resolveOverloadedExprImpl` → E39999; **everything else hits a bare `else { return expr; }`.**
- `slang-check-stmt.cpp:684-704` — `visitExpressionStmt` already holds the two precedents.
- ⚠️**I did NOT re-run the 6-target matrix**: my `slangc` is Aug 4, HEAD is Aug 7. Triager's matrix
  (0 vs 1 barrier tokens across hlsl/spirv-asm/glsl/metal/wgsl/cuda; HLSL diff = exactly 2 hunks)
  **stands unchallenged by me, not confirmed by me.** Stated that way to triager deliberately.

## Precedents for Approach A — dated properly, they hold

Both additions blamed **against the remote** (GraphQL blame — needs neither edge's local history):
dangling-`==` → `61ad43dbc` **#11493, 2026-06-12**; `[NoDiscard]` → `4ed4aeffb` **#11520, 2026-06-16**.
⛔**`git log -S` on my edge said BOTH came from `0864e60e6` ("scope SPIR-V DebugFunction…")** — my clone
is shallow (32 commits) and that IS the graft root. Confident, plausible, wrong, no error.
Full instrument story: [[feedback_a_backticked_issue_ref_creates_no_crosslink]].

## Constraints the eventual fixer brief MUST carry (measured by triager, do not re-derive)

- **Cover all four shapes**, not just a bare name: `(addOne);` paren-wrapped · `s.m;` bare member
  method · `a;` bare variable · `(int x) => x + 1;` lambda-as-statement. A check keyed on
  *"VarExpr naming a CallableDecl"* leaves the member-method and lambda forms silent.
- **Key on discarded expression-STATEMENT position, never on "expression has FuncType"** — else it
  breaks two cells that work today: `functype` bare name as an **argument** (covered in-tree at
  `docs/generated/tests/design/syntax-reference/grammar/type-functype-keyword.slang:37`) and
  `__fwd_diff(sq)(...)`.
- **`[NoDiscard]` cannot be the primary fix** (Approach C): `maybeDiagnoseDiscardedNoDiscardResult`
  (`slang-check-stmt.cpp:706`) bails at `as<InvokeExpr>(expr); if (!invokeExpr) return;` — it only
  inspects **call** shapes, so a bare `DeclRefExpr` can't reach it by construction, and the barrier
  carries no attribute. Worth a follow-on so `f;` and `f();` agree.
- **Add a diagnostic test** — census: **zero** in-tree tests exercise this shape.
- ⚠️`extras/formatting.sh` could not run on triager's edge (clang-format/gersemi/prettier/shfmt
  absent) ⇒ **the PR author must run it.**
- ⛔**THE TWO CANDIDATE INSERTION SITES DISAGREE ABOUT PARENTHESES — the fix must CHOOSE, not inherit.**
  Added 08-08 from sibling cmt `5226660337`, **both legs re-measured on my own clone**:
  the dangling-`==` check (`slang-check-stmt.cpp:687-702`) has **zero** `ParenExpr` peeling;
  `maybeDiagnoseDiscardedNoDiscardResult` (`:707`) **opens** by peeling
  (`while (auto paren = as<ParenExpr>(expr))` at `:710`, comment: *"a call wrapped in parentheses
  (`(t.load());`) still discards the call's result"*). ⇒ **three parenthesised discarded expressions take
  three paths today**, one binary:

  | statement | exit | diagnostic | HLSL written |
  |---|---|---|---|
  | `(a == 2);` | **0** | none | **327 B** |
  | `(f());` with `[NoDiscard]` | 255 | `error[E30059]` | 0 |
  | `(MyType);` | 255 | `error[E20002]` | 0 |

  ⇒ **whichever site the fix lands at INHERITS that site's parenthesis behaviour** — a decision, not a
  byproduct of insertion point.
- ⛔**THE BOUNDARY CELL FOR A BARE-TYPE TEST IS A PARSE-ERROR CELL, NOT AN ACCEPTED-SILENT ONE.**
  `dangling-comparison.slang`'s `(a == 2); // ok.` is a program the compiler **accepts and deliberately
  declines to warn about**; `(MyType);` is **rejected by the parser** and never reaches checking. The
  template is structurally right, its ok-cell is a **different species** — copy it blindly and you put a
  hard parse error where an accepted-and-silent cell belongs.
  ⭐**The peer's lesson, and it is the transferable one:** *"is this the right template?"* and *"do its
  cells mean the same thing?"* are **two questions, and answering the first convincingly is what stops
  you asking the second.**
- ⚠️**Modelling on E30058 RE-INTRODUCES the severity fork rather than avoiding it:** `a == 2;` is a
  warning (exit 0, output still emitted) but under `-warnings-as-errors all` becomes `error[E30058]`,
  exit 255. A crash and a warning are different shapes.
- ⛔**THE TEST MUST ASSERT ON THE `E99997` MARKER, NEVER ON THE EXIT CODE** — added 08-08 from a
  sibling session's finding, **re-measured by me on my own edge with a 4-cell control**:

  | statement | exit | `E99997` | first line |
  |---|---|---|---|
  | `nosuchthing = 1;` | **255** | 0 | `error[E30015]: undefined identifier` |
  | `(MyType);` | **255** | 0 | `error[E20002]: syntax error` |
  | `MyType;` | **255** | **1** | `note 99999: an internal error threw an exception` |
  | *(line removed)* | **0** | 0 | — (positive control: real HLSL written) |

  **255 is slangc's GENERIC failure code.** #12433's body presents *"Exit code 255"* as part of the
  crash signature and calls `(MyType);` *"a clean parse error, no crash"* without noting it **also**
  exits 255. ⇒ The issue's own recommended test — five crashing spellings **plus the parenthesised
  form as the already-correct boundary** — **written against exit codes, that boundary cell passes for
  the wrong reason and asserts nothing.** Load-bearing, not cosmetic.
  ⭐**General shape: a status/exit code that is shared by the pass-for-the-right-reason and
  pass-for-the-wrong-reason cases cannot be the assertion** — same family as
  [[feedback_an_identifier_that_does_not_distinguish_its_members]].

## Spin-off AUTHORIZED, not yet filed: the same TODO makes a bare TYPE name ICE

`MyType;` → `error[E99997] … InternalError … unexpected: TypeType`, exit 255, **target-independent**.
The TODO's own comment names this case verbatim. Triager withheld it ("not triage's surface
uninvited"); **I authorized filing it 08-08.** ⇒ An ICE is a cheaper motivation for the same fix than
a missing warning, and it independently justifies Approach B. Cross-reference both ways, **bare refs**.

Third finding, unfiled: `let f = addOne;` is *accepted*, then `f(5)` fails
`error[E33070]: expected a function, got '(int) -> int'` — accepted where it cannot be used.

## Dedup — NOT a duplicate of #12378, and this was MEASURED not reasoned

⭐**#12378** (open **draft** PR, *"Diagnose function-typed values on targets that cannot represent
them"*, branch `fix/issue-12367`, closes **#12367**, assignee `jkwak-work`) is the closest neighbour
and **its fix cannot catch this**: its own repro leaves `Slang_FuncType` **in** the emitted CUDA so
`checkUnsupportedInst` can see it, while #12428's bare form leaves **zero** function-type artifacts
(599 B vs 622 B applied) because the uncalled global is DCE'd before emission. **Different layer,
different lifetime — an emit-time check has nothing left to inspect.**
⚠️**The cross-link between them does NOT exist on GitHub** as of 08-08 — see the backtick leaf.
#11454/#11520/#11455 = the `[NoDiscard]` work; the `f;` vs `f();` boundary is what separates them.
#3890/#3891 closed and unrelated.

## Provenance caution carried from triager, and it generalizes

⚠️**The 5 prior shared learnings on this bug were written by the SAME bot identity that filed the
issue, in the same window** ⇒ **one prior, not five observations.** Triager treated them as the
reporter's claim and re-measured everything. Same mechanism from the other direction:
[[feedback_sibling_write_under_shared_bot_identity]] — a sibling's write leaves no outbound row, so its
claims return to the peer as if they were its own.

Related: [[project_12367_functype_kernel_emit_armed_cotrigger]] (the neighbour + the ask→answer→dispatch
template), [[feedback_a_backticked_issue_ref_creates_no_crosslink]],
[[feedback_two_tiers_one_frame_is_shared_prior]] (date the CHANGE, not the file).
