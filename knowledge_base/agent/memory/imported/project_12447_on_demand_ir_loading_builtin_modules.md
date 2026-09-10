---
name: project_12447_on_demand_ir_loading_builtin_modules
description: "#12447 on-demand IR loading for builtin modules — DESIGN RFC by compile-perf owner w/ draft prototype #12446; routed triager-only, NO fixer, NO reviewer (draft); 5th chain in the same owner's footprint cluster"
metadata:
  node_type: memory
  type: project
  originSessionId: e8e0b387-afc1-4d91-ab15-dd8e100744b7
---

# #12447 "On-demand IR loading for builtin modules" (jvepsalainen-nv, filed 2026-08-10)

**Not a bug report — an architectural RFC.** The body explicitly says *"The architectural
questions above are what I would like settled first, which is why this issue exists separately
from the PR"*, and names @csyonghe / @tfoleyNV as the parties who have described
linker-integrated IR deserialization as the plan of record. 5 open questions: enforcing the
accessor invariant (should `m_decorationsAndChildren` become private?), how far to go (B vs C),
per-module policy, whether core-module IR is ever mutated after load (**assumed no, not proven**),
and overlap with a general on-disk module cache.

## Live state verified on my edge 2026-08-10 (`gh api`, this session)
- `#12447` — **open**, author `jvepsalainen-nv`, **assignee: none**, **0 labels, 0 comments**, created `2026-08-10T07:47:27Z`.
- `#12446` (the prototype) — **open, DRAFT**, same author, head `ff4e03cc013a`, 11 files, +1589/−115.

## Routing call (mine, this turn)
**triager only, on `gh-issue-shader-slang/slang-12447`.** No fixer: the owner has a working
prototype and is asking for a design verdict, not for an implementation. No reviewer: #12446 is
a **draft** and self-described as *"deliberately not a merge proposal"* (opt-in env var +
measurement instrumentation) — a draft→ready transition is the event that would earn a review
dispatch, not this. Assignee is *none*, so the assigned-maintainer stand-down of
[[feedback_deadpromise_check_assignee_before_rewake]] does **not** formally fire — but its
substance does: self-filed by the domain owner who is actively driving, so the durable value is
triage classification + verdict, never a competing bot PR.

## Cluster context — 4 sibling chains, ALL still open, ALL assigned to jvepsalainen-nv (verified this session)
`#12113` (minimal-compile peak RSS doubled, issue) · `#12112` (track memory footprint, issue) ·
`#9817` (createGlobalSession allocates much memory, issue) · `#12136` (load autodiff builtins on
demand, **PR**, open) · `#12125` (compile-perf memory tracking, **PR**, open). #12447 is the
*general* lever under all of them; #12136 is the per-cluster special case, and the body claims the
two **compose almost additively**. See [[project_12113_minimal_compile_peak_rss_doubled]],
[[project_12112_compile_perf_memory_tracking_parked]],
[[project_12136_load_autodiff_builtins_on_demand]].

## Author's figures — HIS measurements, not mine (do not re-ship as verified)
Measured by the author on `645ac5eef`, Release, linux x86-64: `slangc -v` 235.4 ms / 196.3 MiB;
core-module AST deser 44.9 ms / 40.3 MiB vs **IR deser 98.2 ms / 74.0 MiB** (≈⅔ of the fixed
cost); a realistic PBR compute touches **1.80%** of core-module IR instructions (minimal: 0.00%);
prototype takes session creation to 166.8 ms / 131.8 MiB alone and **89.0 / 76.1 combined with
#12136** (−62% time / −61% memory); `slang-test` 2894/3112, 0 failures, byte-identical codegen.
**⚠️ The body CORRECTS a prior figure: expansion factor is 3.10x, "not ~20x as quoted in #12113".**
⛔**I MIS-ATTRIBUTED THE PROVENANCE IN MY DISPATCH** — I told the triager the ~20x "lives in
#12113's GitHub thread", framing it as a third party's number to avoid re-quoting. The triager
corrected me and I verified it: #12113 cmt `4977530963` is authored by **`nv-slang-bot`** =
**our own identity**, 2026-07-15, and reads *"deserialized IR is ~20× its packed form, so
+4.6 MiB serialized → ~+90 MiB RSS"*. So it is **ours to retract, not merely ours to avoid
quoting**. It was an *inferred bridging factor* (blob delta → RSS delta) published as if it were
a measured expansion ratio. ⇒ ⭐⭐**"don't re-quote X" and "X is ours to correct" are different
obligations, and I issued the weaker one because I never checked the comment's author.** One
`gh api .../issues/comments/<id> --jq .user.login` would have settled it before I dispatched.

**Retraction placement gap (open):** the retraction was posted on **#12447** (cmt `5237740624`,
lines 25-29), but the wrong figure still sits uncorrected in **#12113** cmt `4977530963`, which is
that issue's *verdict* comment and the one my
[[project_12113_minimal_compile_peak_rss_doubled]] memo cites. A reader landing on #12113 reads
~20x with no correction. Correcting-where-the-claim-lives is the ask I sent back.

Author's `3.10x` range-checks with zero external state: 430,369 insts × 155 B = 63.6 MiB;
63.6 / 20.5 (his serialized size) = 3.10. Self-consistent. My `~20x` never had a stated
denominator, which is exactly why it drifted.

**Scope honesty the author volunteered (worth preserving in any rollup):** these are whole-process
figures; `compileInner` — the compile-perf suite's headline metric — deliberately excludes
core-module load and *"would show almost nothing here"*. Falcor2, 12 shaders: ~27% of startup
footprint but only **~6% of steady state**. The strong case is short-lived many-process workloads
(CI, `slangc` in a build system, tooling).

**Next-action:** triager posts the 5-bullet verdict on #12447 (classify + label + Issue Type;
it currently has zero labels) and records that the design questions belong to core maintainers.
Re-engage a fixer only if jvepsalainen-nv asks for implementation help, or when #12446 leaves
draft.
