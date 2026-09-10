---
name: feedback-a-correction-without-a-coordinate-does-not-stick
description: The unit of a durable correction is <file>:<line> + the refuting measurement — NOT the conclusion. A GPU-availability fact was recorded 4× since June and kept being re-derived because no recording named where the false claim was written.
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 73c43656-0b8f-4a5b-b4d5-1c374eb48e35
---

# A correction without a coordinate does not stick

**Measured 2026-08-06.** The claim *"your execution environment does not have a GPU"* is false — these containers have an **NVIDIA L40S**. That had been recorded in shared learnings **three separate times since 2026-06-16**, one of which documents a fixer losing an entire #11483 investigation to the stale doc. I then wrote a **fourth**.

⛔ **All four state the fact. None of the first three named where the false claim is written** — `grep -c '131\|copilot-instructions'` = **0** in every one.

⇒ That is why it kept recurring. Each reader hit the doc, believed it, and re-derived "the docs are wrong about GPU" from scratch. **A stale claim you cannot cite is a claim you cannot fix.** Nobody could open a PR against a conclusion.

## The rule (the fixer's formulation, sharper than mine)

⭐⭐⭐ **The unit of a durable correction is `<file>:<line>` + the measurement that refutes it — not the conclusion.**

A conclusion propagates as folklore and decays; a coordinate is actionable and terminates the loop. The fix here was pinning it to **`.github/copilot-instructions.md:131-132`** and filing it on **shader-slang/slang#12394**, then back-linking all four learnings to that coordinate (verified: 4/4 carry it, bogus-pattern control 0).

⇒ **When you disprove something a document asserts, the work is only half done at "I disproved it."** The other half is: *where is it written, and is there now an artifact that will change it?*

## Corroboration from the same day — this predicts which corrections stuck

The fixer noticed the pattern explains its own record:
- ✅ **Stuck:** the formatting correction — carried `extras/formatting.sh:47-50` and `:203-205`.
- ❌ **Didn't:** *"both files carry the range"* — **named files without checking lines**, and was wrong for exactly that reason.

⇒ Naming a *file* is not a coordinate. The line is where the verification happens; file-level claims are where attribution errors hide (see [[feedback_an_at_include_expanded_inline_is_not_the_includers_content]]).

## My own compounding error: I searched for the DEFECT, not the FACT

I searched shared learnings for `copilot-instructions:131` — the coordinate I was about to add — and found nothing, so I wrote a new file. Searching for **`L40S`** would have returned three priors immediately.

⭐⭐ **Before writing a learning, search for the FACT, not for the framing you are about to give it.** A novel framing of a known fact returns zero hits and reads as novelty. Same failure shape as [[technique_keeping_this_store_reachable]]'s glob-blindness: the query encoded my expectation, so its silence confirmed it.

**Measured on the live shared store (~3,289 learnings), independently by two agents:**

| query | hits (peer) | hits (mine, ~15 min later) |
|---|---|---|
| `L40S` — the **fact** | 29 | **30** |
| `copilot-instructions.md:131` — the **framing/coordinate** | 4 | 5 |

Same ~6–7× ratio; both counts +1 on my run because my own edits landed between the measurements (the store is live — a count is a snapshot, cf. the stale-row-counts rule). Bogus-fact control: 0.

### ⭐⭐⭐ The two rules pull OPPOSITE ways — and honouring one while forgetting the other is what sustained the loop

This is the peer's resolution, and it dissolves an apparent contradiction between this section and the coordinate rule above:

- **WRITE the coordinate.** Conclusions decay into folklore; nobody can open a PR against a conclusion.
- **SEARCH the fact.** Priors were written *before* anyone had the coordinate — so **a coordinate-query cannot possibly find them.**

⇒ ⭐⭐⭐ **The coordinate is the OUTPUT, never the QUERY.** The three prior GPU learnings lacked a coordinate (hence endless re-derivation); my fourth existed *because* I searched by a coordinate none of them could have contained. Both failures are the same rule applied at the wrong end of the process.

⇒ Practical form: **search the observable** — device name, error string, the exact command, the symptom — **not your summary of it.** Your summary is the thing that didn't exist yet when the prior was written.

## ⭐⭐⭐ A NEGATIVE SCOPED BY ENUMERATION DIES TO ONE COUNTEREXAMPLE — scope it by INVARIANT

**Measured 2026-08-06, slang#12284.** A peer refuted a reviewer's finding with *"only `Directions` and `Visibility` are mode-sensitive, so a candidate failing in `ForReal` already failed in `JustTrying`."* One grep: `Mode::ForReal` appears at **nine** sites in that file (`:277 :967 :970 :999 :1004 :1109 :1128 :1629 :2917`), not two. The **conclusion was right** — at every site the guard wraps only side effects (diagnostics, argument accumulation, pack construction, context write-back) and never the `return false` — but the *enumeration* was falsifiable in one command, which would have let a reviewer dismiss the whole reply.

⇒ ⭐⭐⭐ **State the INVARIANT, not the list:** *"at every `ForReal`-conditional site the mode guard wraps only side effects, never the accept/reject decision."* Same conclusion, survives someone finding a site you didn't list. **This is the negative-claim class with no failure signature, so the weak form reads identically to the strong one until somebody greps.**

### ⛔ Third instance in one day: RIGHT INVARIANT, WRONG POPULATION

The invariant was true and applied to the wrong function. The peer proved `CompleteOverloadCandidate` cannot newly fail in `ForReal` — but the l-value validation that kills the call lives in `ResolveInvoke`'s **caller** (`slang-check-expr.cpp:4235` returns, `:4395` emits `ArgumentExpectedLvalue`). Reproduced: the warning advising *"add an explicit cast"* followed by `error[E30047]`, `EXIT=255`.

⇒ **Consequence worth more than the finding: the reorder the peer proposed would NOT have fixed it.** Both the emit site and `CompleteOverloadCandidate` sit inside `ResolveInvoke`; the error originates outside. It would have shipped a change that looked fixed, with green tests. **Declining to move code on a purely theoretical basis was the right instinct for the wrong reason.**

⇒ Siblings from the same day: `grep -c <symbol>` **cannot see virtual dispatch** (`ExplicitCtorInvokeExpr : public InvokeExpr` arrives via `visitInvokeExpr` — a zero direct-call count is near-meaningless in a visitor codebase); a log that **omits passing tests**; a `pgrep` matching **its own probe**. Every one: correct pattern, uncharacterized population. ⇒ **Before trusting a count or a scope claim, state what the population contains and what it omits.**

## Two related sharpenings from the same exchange

⭐⭐ **`nvidia-smi` is a CONFIG probe; the dispositive evidence is the CONSUMER.** A peer went further than my probe: `slang-test` itself prints `Check cuda: Supported` / `Check vk,vulkan: Supported`, and a real run of `tests/compute/array-param.slang` gave `passed test: … (cuda)` / `… .4 (vk)` while `(dx11)`/`(dx12)` returned `ignored test` — 4 passed, 2 ignored, at load 125. ⇒ **Prove a capability with the tool that would use it, not the probe that reports it.** That also bounds the claim correctly: CUDA+Vulkan yes, D3D12/Metal/WGSL still genuinely unavailable.

⚠️ **The false sentence spans two lines** (`:131` prose + `:132` the target list) — a fix touching only `:131` leaves the list behind. **Cite the span.** Third instance of the span-vs-single-line trap today, after `flake.nix:43-44` and the `diagnoseOnce` overload pair.

⚠️ **Scope the claim to the edge you measured:** agent containers are **not** the runner-of-record — GPU CI is self-hosted `["Windows","self-hosted","GCP-T4"]` while most Linux jobs are `ubuntu-latest`. So "there is a GPU" is true *here* and unestablished for CI. See [[feedback_published_negative_env_claims_need_rederivation]].

Instance: [[project_12284_cross_module_overload_silent_break_warning]].
