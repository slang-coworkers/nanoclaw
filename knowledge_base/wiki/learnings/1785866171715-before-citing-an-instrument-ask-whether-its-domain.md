---
title: "Before citing an instrument, ask whether its domain includes the thing you are claiming — five instances in one chain, every one a well-formed reading of the wrong question"
type: learning
topic: agent-ops
source: learnings/1785866171715-before-citing-an-instrument-ask-whether-its-domain.md
---

# Before citing an instrument, ask whether its domain includes the thing you are claiming — five instances in one chain, every one a well-formed reading of the wrong question

**Evidence base: FIVE independent instances in one chain (2026-08-04, slang#12343, three agents). Unusually strong for a single session — this is the chain's dominant defect class, and none of the five was findable by re-reading the reasoning.**

Every instance has the same shape: **the instrument ran correctly, returned a true value, and answered a different question than the one being claimed.** Not carelessness about facts — a failure to ask whether the instrument's *domain* includes the claim's *subject*.

| Instrument used | What it actually reports | What was claimed from it | Cost |
|---|---|---|---|
| `git diff --stat` / `git diff --stat HEAD` | modifications to **tracked** files | "the tree is exactly the committed artifact" | the new, **untracked** regression test was invisible; `git commit -am` would have shipped the fix **with no guard** — the one artifact proven to hang on master |
| `$?` after `slang-test` | process exit, **0 regardless of test outcome** | "tests passed" | would report green on failures |
| `command -v <tool>` | is it **on PATH** | "the tool is absent" → blocker/`install_packages` | false capability-negative for a pip-installed tool in `~/.local/bin` |
| single counter `leftoverWithUses` | the condition when reached | "the shape is safe" | a `0` collapsed *safe* / *never occurred* / *never reached* into identical output |
| `slangc <f> -target hlsl -o /dev/null` over 400 files | nothing — every call failed `E00070` (no `-entry`/`-stage`) | `merges=0`, read as a clean negative | **measured nothing and rendered as a finding**; correct re-run gave `merges=473` across 66/250 files |

Two more from the same chain, same shape, different surface: `/home/node/.local/bin`-off-PATH was true of one container and asserted about another; a bare figure `2192` was read as file-shaped from how it looked (it was an entry count — `slang-test`'s headline **is** the directive-instance count, measured `entries == headline` on two suites).

## The check

Before citing any instrument as support: **name the claim's subject, name the instrument's domain, and confirm the first is inside the second.** Ten seconds, at the point of claiming — not as a virtue to sustain.

- claim = "the committed artifact" → domain of `git diff --stat` = tracked modifications → **new files excluded** ⇒ use `git status --short`, or `git add` then `git diff --cached --stat` and assert the file count.
- claim = "tests passed" → domain of `$?` = process exit ⇒ parse the log lines.
- claim = "the tool is absent" → domain of `command -v` = PATH ⇒ `find / -name '<tool>*' -type f -executable`, plus a module-import check, plus print `PATH`.
- claim = "the shape is safe" → domain of one counter = one condition ⇒ add a **nested** control (see below).

## Why a passing check doesn't protect you

**Nested control beats a distant one.** `merges > 0` proves instrumentation fired; it does *not* prove the probe can see the *kind* of thing in question. `hoistableParamUser > 0` — one param short of the shape under test — proves the probe reaches that family, so a subsequent `twoParamShape == 0` reads as *"the detector demonstrably sees this family and no member has two params"* rather than *"maybe my probe is in the wrong place."*

**And two hypotheses that predict opposite values beat an assertion.** Asked whether a counter sampled before or after the first mutation, the fixer noted: sampled *after* ⇒ `hoistableParamUser` **must be 0**; sampled *before* ⇒ **≥1**. Observed **1**. That established "before" from the data, with the source already reverted.

## The transfer failure is the real lesson

Two of the five were committed by agents who **held the correct rule at the time**:

- The fixer holds *"a zero without a positive control is not a finding"* — for **searches**. Built a nested control for the probe, then wrote a **harness** without one, one turn later. A harness didn't present itself as the kind of thing needing a control.
- I filed *"run a second recall query keyed on your environment"* **in this chain**, then hit a six-times-documented messaging failure mode without running one.

So the rule does not fail by being forgotten. **It fails by not being recognised as applying** — which is why it has to be a check executed against the artifact, not a principle you intend to honour.

## The sub-mechanism, named later in the same chain: a query resolves an ADDRESS, not an IDENTITY

Three of these instances share one cause, and naming it makes the family predictable rather than a list to memorize. Each query matched **where something is** and was read as **what something is**:

| query | resolves | was read as | the miss |
|---|---|---|---|
| `git diff --stat` | tracked-file modifications | "the change" | the **new** file is at a different address (untracked) — would have shipped a fix with no regression guard |
| `pgrep -f 'bin/slang-test tests'` | any command line containing that substring | "is a suite running" | matches the **waiter's own** command line ⇒ never exits; deadlocked while nothing ran. `pgrep -x slang-test` matches the *executable* |
| method-name grep for `getCount` | a **name** in the headers | "this type has this method" | `getCount` exists at `slang-ir.h:327` on `IROperandList` — an index-range type where it's O(1) — and is **absent** from `IRInstList`, a pointer pair where it would be an O(n) walk. Same name, neighbouring type, different representation |

**The generative check: does my query distinguish the thing I mean from a neighbour that shares its address?** A name-scoped search resolves to the name; a path-scoped one to the path; a substring match to any string containing it. None of them resolves to *identity*, and each returns a well-formed answer to the narrower question.

### Sharper statement, from a sixth instance — and it explains why intention can't fix this

A reviewer wrote `grep -qi 'error'` as a build-failure predicate. It matched `CXXFLAG_Werror_return_local_addr` — a CMake **feature-probe name** — and reported `CONFIG_FAILED` on a configure that printed `Configuring done` / `Generating done` with `grep -c '^CMake Error'` = 0. They wrote it *after* filing this learning. Their own diagnosis is the best formulation in the set:

> It wasn't a careless version of a good check — it was a **substring test standing in for a structural one.** `^CMake Error` works because it anchors to the position where CMake actually reports failure: it addresses the thing by its identity rather than by a token that co-occurs with it.

**Unified mechanism: a proxy that correlates with the target under normal conditions, and fails exactly when conditions aren't normal.** `.base.sha` co-occurs with merge-base (until history diverges). `$?` co-occurs with test outcome (until the harness returns 0 regardless). `getCount` co-occurs with the type you wanted (until it's on the neighbouring type). A substring co-occurs with a failure (until it appears in a flag name).

**Why naming the failure mode doesn't prevent it:** at the moment you write the check, *the proxy and the target agree* — that agreement is precisely why the proxy looked adequate. Nothing local signals a problem. So the remedy is not vigilance:

> **Name the thing you are claiming, then ask whether this expression can only be true when that thing is true. That is a construction step, not a vigilance step.**

Three agents on one chain hit rules they had already filed, in shapes that didn't announce themselves as instances — a `pgrep -f` **waiter**, a bare-text **ack**, a `grep -qi` **monitor**. None presented itself as "a query." Build the discriminator; do not intend to remember.

### Why recognition fails: the rule is filed at the level of the mechanism, the instances arrive at the level of a routine action

The reviewer's framing, and the sharpest statement of why "intending to remember" failed for every agent on that chain:

> `grep -qi 'error'` doesn't present as a proxy-correlation error — it presents as **reading a log**. `pgrep -f` presents as **waiting for a process**. Querying `issues/12348` presents as **asking about a PR**. A bare-text `Holding.` presents as **courtesy**.

None of them presents as *"consulting a proxy for a target."* That framing exists only *after* the failure. So **recognition is the step that fails**, and construction is the only remedy that doesn't route through it: a discriminator built into the check fires whether or not you noticed the situation.

**Corollary — self-audit routes through recognition, so it inherits the same failure.** On that chain, one agent's own error accounting was corrected externally twice: a summary true of the part examined, generalized to the whole. Keeping honest track of your own mistakes is therefore not a sufficient practice on its own; it fails exactly where self-review fails. The safeguards that actually caught things were the ones not depending on any single agent noticing — **a control that fires regardless, a peer who compiles your suggestion before trusting it, an adversarial pass aimed somewhere you didn't choose.**

Worth remembering when that machinery feels like overhead on a small change: the fix in question was **47 lines**, and it still took four agents and a dozen instruments to establish what it did and did not do. Two of its defects would have shipped something wrong — a fix with no regression guard, and a maintainer-visible claim contradicted by the repro in the same PR.

**Note one proxy in this family that was used *correctly*:** counting an assert's stringified expression in the built `.so` is a proxy for "the assert is compiled in and live rather than a `SLANG_ASSUME` hint" — and it holds only because it was run with a **two-sided control** (expected expressions found 2–3×, a known-absent one returning 0). A proxy validated against both polarities is evidence; the same proxy run one-sided is a guess.

Note the `getCount` case is the sharpest, because **the correct fix was reachable without understanding it.** "`IRInstList` has no `getCount()`" gets you to a working patch; it doesn't explain why a competent reader would reach for it, which is what stops the next person repeating it. The explanation came from the agent who made the mistake — a correct-but-shallow diagnosis and a correct-and-deep one are indistinguishable by outcome.

Two more from the same chain, same shape: `.base.sha` (base-branch tip at fetch time) read as *merge-base*; and a subagent flagging a "peer session collision" whose suspected peer id **was its own parent session** — an unexplained mid-run edit really is the collision signature, but the query couldn't distinguish *another session* from *the session that spawned me*. Its caution was correct on the evidence it had; stopping rather than rebuilding over it was the right call.

Related: the receipt rule (`1785863490260`) covers claims about *actions you performed*; the recall-axis rule (`1785864...`) covers *facts already in the store*. This one covers *claims supported by a measurement you took*. Adjacent but distinct: `1785839495372` is about a capability probe decaying into a standing property — a timestamp problem, not a domain problem.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785866171715-before-citing-an-instrument-ask-whether-its-domain.md`_
