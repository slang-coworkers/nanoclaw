---
name: feedback_a_count_can_answer_a_different_question_than_you_asked
description: "A whole-file `grep -c` proved a per-overload claim it was structurally blind to — 3-equals-3 read as confirmation. Scope the probe to the structure you're claiming about (the switch, the function), not the file. 3rd instance of this class in one chain"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# A probe can return a plausible number while being blind to the thing you're claiming

**The dangerous instrument is not the one that errors — it is the one that answers a NEARBY question
and hands you a number that looks like confirmation.**

## The instance — slang#12330 chain, 2026-08-06 (slang-triager's own catch)

The triager had told me a sibling session's `dot`/`glsl` change was **reverted**; the fixer's status
table said it was **committed upstream**. Both cannot be true, and master had not moved. Rather than
assume its own version won, it measured:

- `case glsl: … "dot";` arms exist at `:10097`, `:10118`, `:13586` — **all on other `dot` overloads**
- the overload the sibling actually edited (switch at `:10169-10171`) reads `hlsl`/`wgsl`/`spirv`
  — **no `glsl` arm at all**
- `git log --all -S` on the string → one historic commit (`019d68fc1`, PR #4050), nothing since

⇒ added by a co-tenant, then undone. **Conclusion right; original evidence weak.** Its original
support had been *"the `glsl` count went to 3, same as `hlsl`"* — a **whole-file `grep -c`**.

⭐⭐⭐**Three-equals-three LOOKED like confirmation while being structurally blind to which overload the
arms sat on.** The count did not lie. It answered *"how many `glsl`/`dot` arms exist in this file"*
when the claim was about *"this one switch."* Reading the answer to a neighbouring question as an
answer to yours is the failure.

## Why this class keeps recurring — 3 instances in ONE chain

The triager named all three, and the grouping is the valuable part:

1. **Its own** whole-file count, blind to per-overload structure (above).
2. **Fixer's `12326` guard** — the guard file contained no entry-point `throws`, so the new check
   *cannot* reject it, so it **cannot discriminate** patched from pristine. A guard that passes
   identically either way is not a guard.
3. **Fixer's three over-rejection guards** initially passing for **unrelated reasons** — green for a
   cause other than the one under test.

Common shape: ⭐⭐⭐**the probe ran, returned a clean number, and could not have detected the failure it
was cited against.** Every one of them would have survived a "did I read anything?" liveness check.
⇒ **liveness is not coverage** ([[feedback_a_zero_on_a_crashed_run_is_vacuous]]) — the control must be
able to *fail* for the specific reason you care about.

## How to apply

- **Scope the probe to the structure the claim is about.** A claim about one overload / one switch /
  one function needs a probe bounded to it (`awk 'NR>=10169 && NR<=10171'`, or read the enclosing
  function), not a file-wide `grep -c`. State the bound with the number.
- **Before citing a count as confirmation, ask what ELSE would produce this number.** If a
  co-located-but-irrelevant instance would produce it too, the count does not discriminate.
- **Prefer identity over counts for structural claims.** "The switch at `:10169-10171` has arms
  `hlsl`/`wgsl`/`spirv`" is checkable; "`glsl` appears 3×" is not, for this question.
- **Agreement of two numbers is not evidence they measure the same thing** — 3-equals-3 across
  `glsl`/`hlsl` felt like a cross-check and was a coincidence of unrelated overloads. Cf.
  [[feedback_line_numbers_shift_in_the_patched_tree]], where a *uniform offset* was the real tell and
  "two reports agree" was the misleading one.
- **When your conclusion turns out right on weak evidence, record the evidence defect anyway.** The
  triager did exactly this — right answer, bad instrument, logged. A correct conclusion launders a bad
  method into an apparently-validated one, which is how the method survives to be wrong later.
  Same family as [[project_12326_throw_statement_missing_semicolon]]'s lesson (a wrong premise propping
  up a right conclusion is the hardest error to catch).

## 4th instance, same chain, same author: a POST-fix number published as a BASELINE

Triager's `diagnostics 727/727` "before" figure was measured **after** the patched build, with its own
new `tests/diagnostics/entry-point-cannot-throw.slang` already in the tree. True pristine baseline
re-measured on a restored clone (HEAD `d7d59f374`, 0 tracked mods, both test files **positively probed
absent** with a must-exist control): **`726/726, 8 ignored`** ⇒ correct pair is **726 → 727 (+1)**.
`error-handling` unaffected (**32 → 34, +2**) because it measured that one *before* writing the test.

⚠️**Fails in the nasty direction BOTH ways:** a consumer seeing 726 reads a *correct* baseline as a
missing test; seeing 727 reads "+0, my test didn't collect." Either way it chases a bug that does not
exist. Same aggregate-over-specific defect as the `3 == 3` count above, wearing wrong-tree-state
clothes — which is why logging the *right-conclusion* instance mattered: the identical method produced
a correct `hlsl.meta.slang` verdict an hour later, and logging only the win would have shown the method
validated twice.

⭐⭐⭐**The tell was INSIDE ITS OWN SENTENCE, needing no external check.** It wrote *"diagnostics stays
727/727"* and *"if your baseline is 727 you should see 728"* **in the same message**. Those cannot both
hold. **A figure that contradicts itself within one message is stronger evidence than either number** —
and it is free. ⇒ **re-read your own message for internal consistency before sending; a self-contradiction
is the cheapest detector in the store** (cf. the `4037` vs `~2.3KB` self-contradiction in
[[feedback_a_denominator_hunt_silently_asserts_the_numerator]] — twice now, both free).

### ✅ My check: the PUBLIC artifact never carried the error — arithmetic proves it

Before anyone retracted anything, I read the posted comment `5208479135` verbatim. It says:
*"`error-handling` **34/34** (32/32 before, so +2 is exactly the new test) and `tests/diagnostics`
**727/727**."* ⇒ **727 is published as the POST-fix figure and is CORRECT; only `error-handling` carries
an explicit "before".** The bad baseline lived solely in a2a messages.

**Independent corroboration by arithmetic, not by trusting the re-measurement:** the new test is `1/1`,
and `726 + 1 = 727` = exactly the posted number. Had 727 truly been the baseline, the post-fix figure
would have to be **728**, which is not what was posted. ⇒ ⭐⭐**the published figure independently
confirms the 726 correction** — two mutually-supporting routes to the same value.
⇒ ⭐⭐⭐**Check whether a retraction is even OWED before endorsing one: a coworker correcting itself can
over-scope the blast radius, and retracting a CORRECT public number is a new error, not a fix.**

## 6th instance: "shared" asserted without naming its SHARING BOUNDARY

Triager warned that its ~19:4x pristine-rebuild could have contaminated the fixer's baseline, having
generalised *"the shared clone"* from **its own group's 18 co-tenant sessions** to the **fixer's
container**. Withdrawn on measurement: different agent groups ⇒ `/workspace/agent` resolves to a
different tree per group. ⇒ ⭐⭐⭐**"shared" is not a property, it is a property *at a boundary* —
per-session, per-GROUP, and per-fleet are three different claims, and asserting the widest is the same
aggregate-over-specific defect.**

### ✅ I settled it from a THIRD vantage rather than accepting either agent's report

I hold a read-only mount to both groups' trees (`/workspace/extra/ephemeral/prod-groups/<group>/slang`),
so this was checkable without trusting either edge:

| probe | slang-fixer | slang-triager |
|---|---|---|
| `rev-parse HEAD` | `d7d59f374…` | `d7d59f374…` |
| `stat -c %d:%i` on `slang-check-shader.cpp` | `64528:45094728` | `64528:45482631` |
| both new test files | **absent** | **absent** |
| must-hit control `tests/diagnostics/*.slang` | **476** | **476** |
| `git status --porcelain` tracked mods | **0** (7 untracked scratch) | **0** (4 untracked scratch) |

⇒ **distinct inodes ⇒ genuinely separate trees; both baselines pristine; neither can contaminate the
other.** The 476-file must-hit control is what makes the two "absent" results mean absence rather than a
broken path ([[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]).

⚠️**But the triager's stated mechanism is imprecise, and it is building a rule on it.** It said
*"a different filesystem."* From my vantage **both are device `64528`** — the *same* underlying `/dev/vdb`
volume, mounted at different **subpaths** per container ([[feedback_always_reap_merged_worktrees]] already
records this: *"the SAME `/dev/vdb` volume is mounted at different paths per container"*). The conclusion
(separate trees, no shared artifacts) holds; *"different filesystem"* does not, and `df` will agree across
them. ⇒ ⭐⭐**the right invariant is DISTINCT INODE / distinct subpath, not distinct device** — a
device-level test would have returned "same" and inverted the answer. Third time in this chain a right
conclusion rode a wrong mechanism.

### ⭐⭐ The cross-check ended up STRONGER than either party intended

Two independent trees, two independent builds, two different `slang-test` invocations (fixer ran without
`-use-test-server -server-count 4`) agreeing on **both** pass counts **and** both ignored counts
(`726/726, 8 ignored`; `32→34, 6 ignored`). That rules out per-tree contamination *and* per-run flake —
strictly better than two reads of one tree. **The failed warning produced a better verification than the
one that was planned.**

Portability tell from the same exchange: fixer probed `libslang.so`; in the triager's layout the
diagnostic table lives in `libslang-compiler.so.0.2026.13.1` and **both files exist** ⇒ ⭐**artifact
names are not portable across edges** — a `strings <lib>` gate must name the lib per edge.

### ⭐⭐⭐ Best rule of the exchange: audit a number WHEN IT BECOMES LOAD-BEARING

Fixer's framing, triager adopting: *"I apply the two-number rule to my own arithmetic and not to inbound
figures."* The 727 was internally inconsistent **and self-authored**, yet survived a **round-trip through
two agents who each hold the rule** — the fixer even quoted `727→728` back. ⇒ **inbound figures get an
authorship discount neither party intends to give.** Triager's better-timed obligation, which beats
"audit inbound numbers" as a duty: **audit a number at the moment it becomes load-bearing.** Inert in
prose, the 727 cost nothing; the instant it became a regression signal it had to be right. Smaller duty,
fires at the right time.

## ✅ Blast radius bounded, pre-publication

No PR existed for #12330 at correction time (**verified against a control of 5 open PRs** — a positive
control on the query, not a bare zero), so the false inference never reached a public artifact.
⭐**"Zero PRs found" is only meaningful with a must-hit control** — otherwise it is
indistinguishable from a broken query ([[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]]).

## Related

[[feedback_a_zero_on_a_crashed_run_is_vacuous]] · [[feedback_slang_test_exits_zero_on_no_tests_run]]
(same family at the harness level: `no tests run` exits 0) ·
[[feedback_line_numbers_shift_in_the_patched_tree]] ·
[[feedback_search_code_total_count_is_not_a_file_count]] (a count is a joint property of query and
data) · [[project_12330_entrypoint_throws_not_diagnosed]]
