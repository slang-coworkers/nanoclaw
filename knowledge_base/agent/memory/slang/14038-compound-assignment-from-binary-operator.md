---
type: chain
title: slang#14038 — `a -= b` not synthesized from a user `operator-`
description: Human-filed (albertrodriguezclo) 2026-10-29 17:10:23Z, same reporter as the cloth-sim batch #14026–#14031. Triaged feature/low/P3, recommendation A (diagnostic note). Parked 5-bullet posted 2026-11-02 17:12Z. 11-03 skiminki-nv leaned to diagnostics (A), floated an opt-in `[AddCompoundOp]` attribute, labeled 'slang 202c', then asked tangent-vector; held for tangent-vector, no fixer handoff.
tags: [operators, overload-resolution, diagnostics, feature-request, r6]
---

# slang#14038 — compound assignment from a user binary operator

**Ask.** For a user struct with a free `operator-`, `x -= y` fails: "no overload for '-=' applicable"
(E39999), with candidate notes for the builtin `__BuiltinArithmeticType` overloads. The workaround is a
hand-written `void operator-=(inout S3 x, S3 y) { x = x - y; }` for every operator and type. The reporter asks
for either synthesis of `x op= y` as `x = x op y` when no `op=` exists (as C# does), or a diagnostic that
suggests the workaround.

**Dispatch (10-29).** Sent to slang-triager on thread `gh-issue-shader-slang/slang-14038`.
- R6 applies: human-filed, no labels, and the fences hold a diagnostic, not a crash.
- Earliest bot comment: 2026-11-02T17:10:23Z.
- The triager may triage now; posting waits for a one-shot `--process-after` task.

**10-29 17:13Z.** The triager reproduced E39999 on a local master build (its finding) and acknowledged the R6 hold.
17:15Z: the triager says #11627 (flag-enum `|=`) is a prior gap with the same root mechanism (its finding, not verified).

**Triage (slang-triager, 10-29 17:46Z, master 9b3ac252d). These are the triager's findings; I did not reproduce them.**
- Classification: feature-request / low / frontend (overload diagnostics, core module, spec) / P3. Not a duplicate.
- Mechanism: the parser makes `x -= y` a call to a function named `-=` (`slang-parser.cpp:8228-8251`). The checker
  does a scope lookup, then `ResolveInvoke` (`slang-check-overload.cpp:3633`). Nothing rewrites it to `x = x - y`. Core
  `kCompoundBinaryOps` (`core.meta.slang:3378-3437`) covers only the sealed `__Builtin*Type`s. The spec has no derivation rule.
- Workaround: a free `operator-=(inout S3, S3)` compiles. A member, static, or extension `operator-=` gives E30073 (since #12781).
- Options: A is a note after E39999, gated on the binary op resolving, coercing to the LHS type, and the LHS being a writable
  l-value. B is C#-style synthesis, which needs a language/spec change and single evaluation of the l-value. C is to land #12765
  (conforming types only). D is docs.
- Recommendation: A (+D). B is a decision for the language maintainers.
- Related: #11627 (closed, flag-enum `|=`); #12591 / PR #12765, which I verified is OPEN with CHANGES_REQUESTED, last updated
  09-09, tracked by the supervisor under the #12591 chain and waiting on a tangent-vector re-review; #12773 and #5254.
- The memo is a local copy, not linked (raw a2a attachment): `/workspace/inbox/a2a-1793295985773-woly8b/triage-14038.md`.

**GitHub (verified 10-29 17:4xZ).** Type=Feature (set by the bot at 17:17Z), no labels, 0 comments.

**Timer.** One-shot `t-bb303f`, process_after 2026-11-02T17:10:23Z, with a `date -u` guard. It re-checks labels, the
timeline, and any reporter PR before it posts. A duplicate, t-569ee2, was cancelled. All three facts come from the
triager: a task in a peer group cannot be seen from Main.

**Open decision (operator).** Hand A to slang-fixer now, with no PR that references #14038 before the R6 lift? Or wait for
maintainer direction after the 11-02 post?

**11-02 (verified).** nv-slang-bot posted the parked 5-bullet at 17:12:36Z:
https://github.com/shader-slang/slang/issues/14038#issuecomment-6583399540. No labels; the issue is OPEN.
The triager re-ran the repro on master 6815ed82d and still gets E39999 (its finding). The operator did not answer the
early-handoff question, so the issue was not handed to a fixer.

**11-03 (verified on GitHub: labels `slang 202c` and `Office-Tess`, with comments at 14:26Z and right after it).**
skiminki-nv wrote two comments; neither mentions the bot.
- Comment 6606383191: *"right now the best cause of action would be to improve diagnostics"*. The comment doubts option B
  ("easy to get into trouble with Slang's overload system, especially with generics") and floats an explicit opt-in
  `[AddCompoundOp]` attribute on the binary operator. It ends "tagging this for 202c".
- Comment 6606416494: *"@tangent-vector Do you have an opinion on this?"*

That makes the direction not final, so I am holding. There is no fixer handoff and no bot post, as on #13793, where a
maintainer-to-maintainer question went to tangent-vector. The diagnostic patch site (`slang-check-overload.cpp`)
overlaps skiminki-nv's own 202c overload-resolution overhaul, #13956
([record](../imported/project_13956_name_lookup_overload_resolution_overhaul_202c.md)). On #11829 the same maintainer
closed a bot PR as "wrong direction".

The 14:28Z relay to the triager was misrouted (see [the in_reply_to hazard](../imported/feedback_in_reply_to_beats_target_session_id_pin.md)). I re-sent it pinned at 16:29Z, and it landed as owner seq 48.

**11-03 16:30Z.** The triager applied the hold and changed the prompt of `i14038-recheck-df24` (still 11-09 17:15Z, one-shot)
so both comments, the labels and the assignments count as already seen. It acts only on a new skiminki-nv or
tangent-vector comment, a mention of the bot, a `Fixes #14038` PR, or a no-bot-type label. The issue is
**maintainer-assigned**: jhelferty-nv assigned skiminki-nv on 11-02, and skiminki-nv assigned tangent-vector on 11-03
(triager's finding; I checked the assignees). A fixer handoff needs a maintainer to ask the bot, or the operator's approval.

**11-03 17:50Z: the reporter takes on option A.** albertrodriguezclo (comment 6611378591) agrees that implicit synthesis
is risky, says they will write the diagnostic PR (option A) themselves and link it, and will do the attribute after
tangent-vector gives a view. They asked: one attribute per operator or one per family? I relayed this to the triager
pinned (in_reply_to=68). The bot does no competing work. When the reporter's PR appears, the triager reads it and
reports it, and does not post. 17:55Z: the triager confirmed report-only mode. `i14038-recheck-df24` (11-09 17:15Z) now also
runs `gh pr list --author albertrodriguezclo` and notes any overlap with #13956.

**11-03 18:09Z: the reporter opened PR #14246** (`fix/compound-assign-binary-op-note`, not a draft, references #14038). It adds note
E40026 on a failed `x op= y` when `x = x op y` type-checks, covers all ten compound operators, and generic tests
(comment 6611784073). Files: `slang-check-impl.h`, `slang-check-overload.cpp`, `slang-diagnostics.lua`, a new
diagnostics test. I relayed it to the triager pinned (in_reply_to=80, my msg 91) for a report-only read against the
memo's gates. During this turn `ncl sessions messages` timed out repeatedly, so I read the webhook row id from
`/workspace/inbound.db` (`messages_in`, kind='webhook').

**11-03 18:19Z.** The triager's report confirms delivery. Its read of #14246 at head b00c86d35 (+271/−1; diff read only, not
built; these are its findings): the PR passes all three memo gates. It requires an exact LHS-type match rather than a
conversion, and it builds a fresh probe with a temporary sink. The note also fires on the E30019 single-candidate path.
Possible reviewer points, not posted: re-use of checked nodes in the probe, errors swallowed by the sink, a lua comment
that says "converts" while the code needs an exact match, and literal `x`/`y` in the note text. It touches `ResolveInvoke`, which
#13956 (still a proposal) would rework, so there is no conflict today. The prompt of `i14038-recheck-df24`
(11-09 17:15Z) now follows the PR: merge or close, maintainer reviews, commits that change the gates.

**Next.** Follow PR #14246 (human-owned; the bot does not review it) and wait for tangent-vector's view on the attribute. A reply comes in through the webhook. The triager's
one-shot `i14038-recheck-df24` runs 2026-11-09T17:15Z, and I told it to treat the 11-03 comments as already seen. Owner: slang-triager on thread `gh-issue-shader-slang/slang-14038`.
