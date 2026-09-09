---
title: "Approver Review-Miss Patterns: Clearing a Finding Is a Claim"
type: concept
group: misc
tags: [approver, challenger-miss, concurrency, public-api, abstain, contract-vs-callgraph, disclosure, worst-case-bound, audit-record]
source_count: 10
---

## TL;DR

A cluster of near-approvals that the DECISION_REVIEW critique gate reversed, each teaching a
distinct way a *clearance* (the claim "this is safe / unreachable / not a bug") fails while
feeling like diligence. The through-line: **a clearance is itself a claim — name the artifact
that establishes it, and open that artifact.**

Recurring patterns:

- **"Is it reachable?" is a question about the CONTRACT, not the call graph.** For a
  *library*, the thread population is its **callers**; grepping the implementation for
  `std::thread` answers the wrong question. Open the header/interface doc that states the
  threading contract — a documented "may be called in parallel" IS the trigger.
- **"No in-tree caller does X" ≠ "X is forbidden."** A public extension point (callback,
  virtual, interface, plugin hook) samples the wrong population — the implementations that
  matter are out-of-tree. A contract's *silence* on re-entry **permits** it; only a documented
  prohibition, an assert, or structural impossibility clears it.
- **A guard's correctness is judged against the STATE's reachability, never the narrative
  that introduced it.** When a PR opts a whole class into concurrency, audit the new lock's
  scope against *every* sibling entry point touching the same shared state.
- **A PR's stated failure mechanism is a claim about source.** Read the exit path (usually
  3-4 grep hops), do the arithmetic in the quoted evidence, and prefer the run's own uploaded
  artifact over its narrative. A bot review that restates the PR body has verified nothing.
- **Disclosure is not safety.** A mitigation must act on the *mechanism* (binary/linker/loader),
  not on a human reader. Disclosure, intent, pre-1.0 status, cost-to-fix, and "no in-repo
  consumer" all act only on readers. If you can name the defect with a file:line AND a failure
  mode, ABSTAIN is a downgrade, not caution.
- **A numeric/short-string ID is a unique key only within the namespace that mints it.**
  Enumerate its definition sites before trusting a code-keyed join.
- **A self-run empirical control is only as strong as the environment-match to the claim.**
  Building a binary and getting clean probes generates conviction out of proportion to what
  was measured.
- **Check worst-case bounds in both directions**; an under-claim from the alarm-raiser is the
  credible kind, and it discredits the true finding it rides with.

## Reachability is about the contract, not the call graph

On slang-rhi#821, three *true* facts ("`getConcretePipeline` has one caller"; "grep finds
`std::thread` only in the task pool"; "the PR introduces zero threads") produced a *wrong*
clearance. The question was never "does this library spawn threads" but "may two threads
enter this path" — and the answer was documented in the tree already checked out:
`command-list.h:376-386` advertises *"parallel compilation of specialized programs and
pipeline creation"* as a design contract, and `resolvePipelines` is called from every
backend's `finish()`. A lock held across a user callback, virtual call, or function pointer
is an OPEN re-entrancy edge by default; the PR's own new contract was the evidence against it.
The generalized rule: a clearance is a CLAIM — name the artifact that establishes it and open
it
[reachability is a question about the contract](../learnings/1786367763472-approver-challenger-miss-is-it-reachable-is-a-ques.md).

The sibling case slang-rhi#822 sharpened it: enumerating in-tree implementors of a *public*
interface (`IDebugCallback`) is a complete enumeration of an irrelevant set — the
implementations that matter are the ones not in the tree. And a null result was read as a
negative: finding no documented permission to re-enter was scored as *prohibition*, when
**silence in a contract permits**. Distinguish three non-interchangeable statements: "no
in-tree caller does X" (a fact about this repo), "the contract forbids X" (clears it), "the
contract is silent on X" (permits X). Newly wrapping existing callback invocations in a new
lock is a recurring refactor shape whose real blast radius — every call escaping user code
while the lock is held — is invisible in a green CI run
[no in-tree caller does X ≠ X is forbidden](../learnings/1786368454060-approver-challenger-miss-no-in-tree-caller-does-x-.md).

## A guard is judged against the state, not the narrative that introduced it

slang-rhi#824 added a process-wide mutex answering a deleted TODO's exact question ("can
`createRayTracingPipeline2` be called from multiple threads?") — but the same PR opted the
*whole* pipeline class into concurrency (the D3D12 capability hook returns `true` with the
discriminant unused), so sibling PSO-creation functions that never take the new mutex became
concurrent too. Reviewing the lock against the TODO that motivated it reproduces the author's
blind spot. The probe: enumerate what the opt-in actually widened (read the hook body, not
the PR summary); for every new lock grep every call site of the *state* it protects;
asymmetric scopes in one lock body (one thread-local, one device-scoped) are the tell; a
deleted TODO/WARNING is a review anchor. When the decisive premise was unresolvable
in-container, that is `ABSTAIN_POLICY:OPEN_GAP`, and naming the unresolved premise explicitly
is what keeps the abstain from silently rounding up to approve
[audit the guard's scope against every sibling entry point](../learnings/1786371703789-approver-challenger-miss-when-a-pr-opts-a-whole-cl.md).

That named premise is exactly what let someone close #824 in ~20 minutes: the vendor doc
described `NvAPI_D3D12_SetCreatePipelineStateOptions` at three widths — the function
`DESCRIPTION` ("affects all pipelines created after this call") is what makes the trap look
real, while the struct-field and per-enumerator notes ("for **raytracing** pipeline
creation") settle it raytracing-only. **Read a contract at the narrowest level that mentions
your case and quote the narrowest, not the first.** Two independent public header mirrors
diffed identical (control against a stale-mirror artifact), and a behavioral oracle sealed it:
NVIDIA's own NVRHI sets these flags once in the device constructor, never reset, no mutex — so
if the pattern were harmful the vendor's reference implementation would be broken by
construction. **A vendor's own reference implementation is an oracle for that vendor's API
contract**, usually one `grep -c` away
[NVAPI SetCreatePipelineStateOptions is raytracing-only](../learnings/1786373817377-approver-premise-resolved-slang-rhi-824-nvapi-setc.md).

## A PR's stated mechanism, and disclosure-is-not-safety

On slang#12451 the whole rationale ("a listed-but-now-passing test causes exit 1") was false
at the PR's own commit — the exit path is four grep hops (`m_failedTestCount++` fires only
under `TestResult::Fail`; the XPASS block is print-only), and the refutation
(`5898 − 5861 − 34 = 3` real failures) sat inside the PR's own quoted summary. Both the
production bot review and Devin accepted it by paraphrasing the body — agreement between two
reviewers who read the same description is one source, not two. Prefer the run's own uploaded
artifact (which survived the ~5-day log expiry) over any narrative about the run, and never
grep a stale worktree for a claim about a head
[a PR's stated failure mechanism is a claim about source](../learnings/1786374529551-approver-challenger-miss-a-pr-s-stated-failure-mec.md).

slang-rhi#825 removed six virtual methods from a public COM interface under an unchanged GUID;
the initial ABSTAIN reasoned "the author disclosed it, so it's a human's call." A reviewer
called that the false-safe: the author's *awareness* of a break is not *mitigation* of it — a
sentence in a PR body reaches no consumer's compiler, and the unchanged GUID *is* the hazard
(it makes the break silent). This is the third disguise of one class (cost-to-fix on #814,
expected-usage on #822, intent on #825): each converts a verified defect into a soft state by
appealing to something other than what the artifact does to a caller. The mechanical tell: if
you can name a file:line AND a failure mode, ABSTAIN is a downgrade
[disclosure is not safety](../learnings/1786383132414-approver-challenger-miss-disclosure-is-not-safety-.md).

That same #825 decision took four review rounds and eight must-fixes — but six of the eight
were **audit-record defects, not reasoning defects**: describing a bundled policy copy instead
of the mounted one, leaving a superseded derivation live, a machine-readable JSON block
disagreeing with the surrounding prose, asserting a vtable slot mapping instead of deriving
it, writing `==` between unequal numbers. Two mechanisms: multi-pass drift (prose edited in
one pass, payload in another, nothing re-checks agreement) and asserting structure instead of
deriving it — each error told a *more uniform* story than the artifact did. Treat the audit
record as a reviewed artifact: re-parse the payload against the prose after every edit, never
state a structure you can generate, and when a critique loop keeps returning must-fix while
the verdict holds, stop re-litigating and regenerate the record mechanically
[6 of 8 must-fixes were audit-record defects](../learnings/1786383169813-approver-critique-mustfix-6-of-8-critique-must-fix.md).

## Numeric IDs, worst-case bounds, and self-run controls

slang#12455 keyed a lint join on a diagnostic's numeric code — but Slang mints codes in two
independent families (13 codes collide across them, 2 within one header), and the snapshot had
already collapsed collisions last-wins, discarding the disambiguating `source` column. A
code-keyed join cannot be correct even in principle. **A numeric or short-string ID is a
unique key only within the namespace that mints it**; when the storage format shows
distinct-keys == row-count on data you'd expect to have duplicates, the collision is invisible
downstream. A disclosed symptom attached to the wrong cause ("name column misalignment")
routes the fix to the wrong place and is not mitigation
[a numeric ID is not a unique key](../learnings/1786382218712-approver-challenger-miss-a-numeric-id-is-not-a-uni.md).

On the same slang-rhi#821 callback hazard, an over-count and an under-count of held mutexes
partly cancelled: `m_specializedProgramsMutex` is never co-held (sequential stages, not
simultaneous — being on the same call path is not being co-held; only overlapping lifetimes
count), while `ProgramWork`'s `m_compileMutex` is held *per distinct program* in the batch, so
the real bound is `1 + K`, unbounded. The generalizable mechanism: **enumerate lock LIFETIMES,
not lock SITES** — a guard living in a container is one line of code and N held mutexes; locate
the observation point relative to every release. An under-claim cuts against the alarm-raiser
(so it never trips the habitual over-claim check), yet a refuted crisp figure ("three") is
exactly what gets a real finding dismissed wholesale. The direction heuristic (uniform-sign
corrections = alarm) *screens* a batch; here the batch was mixed-sign, so it carried zero
information and every leg needed opening
[check a worst-case bound in both directions](../learnings/1786385252194-approver-challenger-miss-check-a-worst-case-bound-.md).

Finally, slang#12448: the reviewer built `slang-test` from the pinned head and ran five clean
probes — matcher correctness, pre-dispatch placement, exact-match boundary — and nearly
approved. But the crash the PR avoids is a property of macOS ARM64 under coverage
instrumentation with `-use-test-server`, and the control ran on Linux x86_64 with none of
those variables present. An empirical result is only as strong as the environment-match to the
claim it settles; a strong instrument is a persuasive one, generating conviction out of
proportion — the same self-conviction failure as an over-claimed grep, wearing lab-coat
evidence. When a workaround is being *narrowed*, read the PR/issue that installed the broad
version to learn whether the suppressed thing was enumerated or merely *exemplified* ("crashes
in a variant such as X"). And when a scripted probe and a fresh measurement disagree, suspect
the measurement's scope before retiring the probe
[a self-run control can measure the wrong environment](../learnings/1786386188551-approver-challenger-miss-a-self-run-empirical-cont.md).

**Source learnings (10):**

- ["Is it reachable?" is about the CONTRACT, not the call graph](../learnings/1786367763472-approver-challenger-miss-is-it-reachable-is-a-ques.md) — for a library the thread population is its callers; a clearance is a claim, open its artifact.
- ["No in-tree caller does X" is not "X is forbidden" — public extension points sample the wrong population](../learnings/1786368454060-approver-challenger-miss-no-in-tree-caller-does-x-.md) — a contract's silence permits; distinguish repo-fact / forbidden / silent.
- [When a PR opts a whole class into concurrency, audit the guard's scope against every sibling entry point](../learnings/1786371703789-approver-challenger-miss-when-a-pr-opts-a-whole-cl.md) — judge a guard against the state's reachability, not the TODO narrative; name the unresolved premise to keep an abstain honest.
- [NVAPI SetCreatePipelineStateOptions is raytracing-only — the OPEN_GAP evaporates](../learnings/1786373817377-approver-premise-resolved-slang-rhi-824-nvapi-setc.md) — read a contract at the narrowest level; a vendor's own reference implementation is an oracle; mirror-equality is the control for third-party header reads.
- [A PR's stated failure mechanism is a claim about source — read the exit path, prefer the run's artifact](../learnings/1786374529551-approver-challenger-miss-a-pr-s-stated-failure-mec.md) — do the arithmetic in the quoted evidence; two reviewers echoing one body is one source.
- [Disclosure is not safety — an author documenting a breaking change is not mitigation](../learnings/1786383132414-approver-challenger-miss-disclosure-is-not-safety-.md) — a mitigation must act on the mechanism, not the reader; file:line + failure mode ⇒ abstain is a downgrade.
- [6 of 8 critique must-fixes were audit-record defects, not reasoning defects](../learnings/1786383169813-approver-critique-mustfix-6-of-8-critique-must-fix.md) — multi-pass drift and asserting-vs-deriving structure; regenerate the record mechanically.
- [A numeric ID is not a unique key — enumerate its definition sites before a code-keyed join](../learnings/1786382218712-approver-challenger-miss-a-numeric-id-is-not-a-uni.md) — unique only within its minting namespace; a disclosed symptom under a wrong cause is not mitigation.
- [Check a worst-case bound in both directions — an under-claim is the credible kind](../learnings/1786385252194-approver-challenger-miss-check-a-worst-case-bound-.md) — enumerate lock lifetimes not sites; a mixed-sign correction set carries zero directional information.
- [A self-run empirical control can measure the wrong environment and feel authoritative](../learnings/1786386188551-approver-challenger-miss-a-self-run-empirical-cont.md) — match the control's environment to the claim; when a workaround is narrowed, check enumerated-vs-exemplified.
