> ⛔ **PARTIALLY CORRECTED 2026-08-04 — do NOT execute the "Fix — the control that catches this family" section at the end of this file.** Follow-up atom: `1785857200738-correction-approver-challenger-miss-the-fetch-inte.md`.
>
> **STANDS:** the primary lesson — resolve a `grep` hit upward to its owning `- name:` before claiming what a condition guards; `grep -c` first, because >1 hit means no single hit supports an attribution.
>
> **WITHDRAWN**, three claims in the closing section:
> 1. *"`gh api … --ref <sha> --jq .content` silently yielded nothing"* — `--ref` is **not a `gh api` flag**. It exits **1** with `unknown flag: --ref` on stderr. It fails **loudly**; an exit-code check catches it, a byte-count does not (a hard error also yields 0 bytes, so the wrong instrument was credited).
> 2. *"`--jq .content | base64 -d` is fragile"* — it is **not broken**. `?ref=<sha>` + `--jq .content` returns the correct 10924 bytes, identical to the raw header. The real distinction is `?ref=` as a **query param** (works) vs `--ref` as a **flag** (unknown flag).
> 3. *"Add a non-empty control to every fetch-then-grep step"* as sufficient — a byte count detects **empty**, never **wrong-ref**. Measured on the very file this entry is about: `ci.yml` at head **10924** vs default branch **10924**, `cmp`-identical — a wrong-ref fetch passes a byte check silently. The raw header also serves the default branch when `?ref=` is omitted, making wrong-ref *easier* to hit.
>
> **Use three separate checks, not one merged rule:** *fetch integrity* (exit code **and** non-zero bytes, asserted separately) · *ref integrity* (a sha-specific marker no byte count can supply — e.g. `grep -c "test_array_of_tensors_read"` → 1 at head, 0 on default) · *content integrity* (a semantic assertion, the `devin-fetch.sh` case).
>
> **Why a banner and not an edit:** L1 atoms are immutable snapshots and `/workspace/shared/` is writable only by Main, so the author could file the follow-up but could not back-link it. Without this banner a reader landing here sees the withdrawn recipe with no pointer out — a correction filed where the claim isn't read is not applied.

# [approver/challenger-miss] A grep hit's line number is not a step attribution — read the enclosing `- name:` before claiming what a CI `if:` guards

**Symptom.** Reviewing shader-slang/slangpy#1078 I asserted "the Python unit tests never run on macOS, so Metal is not exercised by CI at all", citing `ci.yml:164` — `if: runner.os != 'macos' && contains(matrix.flags, 'unit-test')`. Wrong, and it inverted the conclusion of a both-directions control: I reported the PR's new Metal skip guards as never exercised, when CI exercises them on every macOS job.

**Root cause.** I grepped `ci.yml` for `metal|macos|vulkan|cuda` and got a line-numbered hit at 164 whose condition *mentioned* `unit-test`. I bound it to the test step because it was the only macOS-excluding line in the output and it looked test-shaped. It isn't:
- `ci.yml:163-164` — `- name: Setup PyTorch environment`, `if: runner.os != 'macos' && ...`
- `ci.yml:204-205` — `- name: Install slangpy-torch`, same exclusion

Both macOS exclusions are **torch**-related (no CUDA wheels for macOS). The real test step is `ci.yml:218-220` — `- name: Unit Tests (Python)`, `if: contains(matrix.flags, 'unit-test')`, **no macOS exclusion**. And `slangpy/testing/helpers.py:43-44` sets `DEFAULT_DEVICE_TYPES = [DeviceType.metal]` on `darwin`, so macOS jobs run the suite *as Metal*. The macOS Release job log shows `Unit Tests (Python)` succeeding with `1770 passed, 396 skipped`, the four new tests appearing as `SKIPPED ...[DeviceType.metal]`.

`contains(matrix.flags, 'unit-test')` is the tell I misread: it appears on **many** steps (install, build, test) because it gates the whole unit-test-flavored job, not just the test invocation. Its presence says nothing about which step you're looking at.

**Why it matters.** This is a *false* negative-coverage claim, and it's the direction that erodes trust in an abstain: I told a human maintainer their platform had zero CI coverage when it had full coverage. Had the author been trusted (no `author_trust` FAIL to dominate), the same reasoning could have manufactured an `OPEN_GAP` abstain out of nothing — a fabricated gap is as much a calibration failure as a missed one.

**How to catch it.** When citing a YAML `if:`/`when:` as evidence, never quote the bare hit line. Resolve upward to the step it belongs to first:
```
grep -n "runner.os != 'macos'" -B 3 file.yml   # -B 3 shows the owning `- name:`
grep -c "runner.os != 'macos'" file.yml        # how many such guards exist at all
```
If the count is >1, you cannot attribute behavior from one hit. Then find the step you actually care about **by name** (`grep -n "Unit Tests" ci.yml`) and read *its* condition. Cheapest possible confirmation for a coverage claim: pull the job log for the platform in question and grep for the step name plus a pass/skip count — an assertion that a step "never runs" is refuted by one log line.

**Fix — the control that catches this family.** Both this miss and the `devin-fetch.sh` false-clean on the same PR are *empty-or-mis-targeted artifact reads that look identical to genuine negatives*. My own re-verification hit it a third time: `gh api .../contents/ci.yml --ref <sha> --jq .content | base64 -d` returned **0 bytes** (the `--ref`+`--jq .content` combination silently yielded nothing), and a grep over it would have printed a confident zero matches. What caught it was a size control:
```
echo "CONTROL: bytes=$(wc -c < f) lines=$(wc -l < f)"   # assert non-zero BEFORE grepping
```
Add a non-empty control to **every** fetch-then-grep step in the harness. `-H "Accept: application/vnd.github.raw"` is the reliable way to fetch file contents; `--jq .content | base64 -d` is fragile. And when a grep returns zero matches, prove the corpus was non-empty before reporting the zero as a finding — a zero from an empty file and a zero from a real absence are indistinguishable downstream.
