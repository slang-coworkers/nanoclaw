# A grep returning 0 is only evidence if the same pattern returns non-zero for a case you know exists

## The rule

Before citing "0 occurrences of X" as evidence that X didn't happen, run the **same pattern** against a case you *know* is present. If that also returns 0, your pattern is broken and the 0 means nothing.

```bash
grep -c "DEEPEST SUBCASE: d3d12" *.log   # 0  -> "no d3d12 failures!"
grep -c "DEEPEST SUBCASE: vulkan" *.log  # 0  <- but vulkan DID fail 28 times
```

The string didn't exist at all. doctest emits a multi-line header, `DEEPEST SUBCASE STACK REACHED (DIFFERENT FROM THE CURRENT ONE)`, with subcase names on *following indented lines* — never `DEEPEST SUBCASE: <name>`. The absence-claim was unfalsifiable: it would have returned 0 whether or not d3d12 failed.

A negative grep is a claim about the corpus. It's only as good as the proof that your pattern can match anything.

## Two traps that produced vacuous zeros in one session

1. **Invented format.** I wrote the pattern from memory of what doctest output "looks like" instead of reading it. Fix: `grep -ohE 'DEEPEST SUBCASE[A-Z ()]*' *.log | sort -u` to see the real label first.
2. **CRLF.** GitHub Actions **Windows** job logs are CRLF; Linux logs are LF. A `$`-anchored pattern silently matched nothing on windows.log while working on linux.log — a second vacuous result behind a plausible-looking command. Always `tr -d '\r'` before anchoring, or the per-platform asymmetry reads as a real finding.

## Positive-control checklist for absence claims

- Run the pattern against a known-present case; it must return non-zero.
- Cross-check with a structurally different method (I confirmed `28 vulkan / 0 d3d12` a second way: device token inside each `Failed to load slang module` block).
- Verify completeness: `grep -c 'DEEPEST SUBCASE STACK REACHED'` = 28 per log matched the reported failure count, proving the enumeration covered every failure rather than a subset.
- Strip CR, then enumerate *distinct values* rather than testing for one expected value — enumeration surfaces formats you didn't predict. See the companion learning on enumerating a diagnostic's distinct values to prove a one-site fix complete.

## Absence of a failure is not evidence of a pass

The vacuous grep was in service of a stronger overclaim that also had to be withdrawn from three published texts: *"the d3d12 subcases did execute and all passed,"* labeled **decisive**. Two independent problems:

- **No positive marker exists.** `grep -aoiE "creating device|device type|adapter|L40S"` over the real Windows job log returns **nothing** — there is no device-creation line at all. Every `d3d12` string is a build artifact (`d3d12\d3d12-buffer.cpp.obj`, `d3d12SDKLayers.dll`). You cannot claim something ran without a line showing it ran.
- **The supporting inference has a live confound.** The fallback was "Windows reports 18535 assertions vs Linux's 15593, consistent with a second device." But both platforms report **identical case counts** — `200 | 172 passed | 28 failed | 3 skipped` — with only assertion volume differing. That is equally consistent with Windows-only or D3D12-only assertions *inside otherwise-shared cases*. Narrowing checks (only `testing.cpp` carries platform guards; no test sources platform-gated in cmake) reduce but do not eliminate it.

So the honest form is weaker than "consistent with": *consistent with d3d12 executing, **and** consistent with a Windows-only assertion delta — D3D12 CI on the change is what would settle it.* Note the progression, because it is the tell: the same claim was weakened twice in one chain (`passed` → `no observed failure` → `consistent with, plus the alternative explanation`). **When a claim needs weakening twice, the real finding is that the property is not verifiable in your environment — say that outright instead of hedging a third time.**

## A log absence tells you WHAT, never WHY — resolve the cause at the definition

Even a *correctly derived* zero, with a passing positive control, only establishes that the string is absent. It cannot distinguish **"ran and exited early"** from **"never a step at all"** from **"conditionally excluded by an `if:`"**. Those have different consequences, so naming a cause from absence alone is inference wearing evidence's clothes.

Same chain, 2026-08-03: `unit-test-python` = 0 and `atomics.slang` = 0 in both job logs — real absences (positive controls pass: `unit-test-cpp`=3, `sgl_tests`=51/39, and other `*.slang` names appear). The claim attached to them was *"the Python stage was skipped once `sgl_tests` failed."* Plausible, and it happened to be right, but the logs cannot show it.

Resolving it takes the **workflow definition**, not the log. In `.github/actions/build-and-test-with-slang/action.yml`, `Unit Tests (Python)` is gated only on `if: contains(inputs.flags, 'unit-test')` — satisfied by the matrix (`flags: "unit-test,test-examples,crashpad"`) — and sits immediately after `Unit Tests (C++)` with **no `continue-on-error`**. So the mechanism is the default step-failure short-circuit. Cross-check by extracting the stages that *did* run:

```bash
tr -d '\r' < job.log | grep -aE "Run python tools/ci\.py" | sed 's/.*ci\.py/ci.py/'
# setup → configure → build → install-slangpy-torch → typing-check-python → unit-test-cpp, then nothing
```

**Two corollaries.** (1) An enumeration over logs bounds its claim to *the surface that actually ran* — here a "complete fix" argument rested on a 56-occurrence count taken from the C++ test surface while the Python surface never compiled, so a second site there was unfindable by construction. Say which surface your enumeration covers. (2) A count can be topically right and semantically empty: `pytest` = 22/24 in these logs is entirely `pip install` chatter, not a test run.

When two independent arguments support a conclusion, rank them — a semantic argument from the code's own rules (here: the diagnostic fires only on *explicitly requested* capabilities, so an in-source attribute can't trip it) survives a surface never running, while a log count does not.

## Related

Sibling failure mode from the same session: relaying a **subagent's prose summary** as evidence. A build subagent reported "assertions 15733/15733"; `grep -c 15733` on the actual log returned 0 (real: 15529/15529) and the wrong number reached a published PR body. Both errors share one root cause — a number or a zero accepted without an attempt to disconfirm it. Re-derive load-bearing figures from the raw artifact yourself.

**Provenance discipline and method discipline are separate checks; you need both.** "Is this primary source?" does not catch a vacuous grep — the vacuous grep *was* run against primary source. The second question is "could this command have returned a different answer if my hypothesis were false?" In this chain four tiers failed in four different ways, and only the pair of questions covers all four.

**Publish the extraction command alongside any log-derived finding.** It converts "trust me" into something a reviewer can falsify — which is how the vacuous grep here got caught at all.
