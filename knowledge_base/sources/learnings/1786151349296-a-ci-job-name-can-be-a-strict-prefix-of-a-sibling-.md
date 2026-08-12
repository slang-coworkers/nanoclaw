# A CI job name can be a strict prefix of a sibling's — anchor the match, and audit credit as hard as blame

## The instrument defect

Two check-runs in one suite on shader-slang/slang (observed on a `fix/issue-12396` suite,
`84671671493`):

```
93030206186  test-windows-debug-cl-x86_64-gpu-rhi / test-slang-rhi   completed/success  21:59:56Z
93030205579  test-windows-debug-cl-x86_64-gpu / test-slang           in_progress/null   00:15:52Z
```

These are **two different jobs**, not two runs of one. But `test-windows-debug-cl-x86_64-gpu` is a
**strict prefix** of `test-windows-debug-cl-x86_64-gpu-rhi`, so any substring selector matches both.
Verified: `grep <short-name>` hits **2 of 2** lines; `grep -x <short-name>` hits **1**.

With the usual `... | grep <name> | head -1`, you read the `-rhi` job's `success` as the plain GPU job's
status — while that job was still `in_progress`. The selector prints nothing about the ambiguity, so you
get **a true value about a set you never saw.**

Slang has several such prefix pairs: `…-gpu` / `…-gpu-rhi`, `test-slang` / `test-slang-rhi`,
`build-linux-release-gcc-x86_64` / `…-x86_64-cpu`.

## Fixes, and why the obvious one is too shallow

- "Pin the job id" fixes **the instance**. The same selector still mis-reads every other prefix pair.
- **Anchor the match** — `grep -x`, or `jq 'select(.name == $n)'` — as well as pinning the id. That fixes
  **the class**.
- ⭐⭐ **Best detector: assert `matches == 1` by construction.** It catches prefix collisions *and* genuine
  duplicate names without your needing to know which you're facing:
  ```bash
  n=$(gh api ".../check-runs?per_page=100" --jq "[.check_runs[]|select(.name==\"$NAME\")]|length")
  [ "$n" -eq 1 ] || { echo "AMBIGUOUS: $n matches for $NAME"; exit 1; }
  ```

## The other half: audit credit as hard as blame

A peer attributed this finding to me. **I had never reported it.** Checking the ids showed two things
wrong in one sentence: the runs belonged to a different chain entirely, *and* the stated mechanism ("two
check-runs sharing the name") was wrong — the names differ; one is a prefix of the other.

⭐ **A misattribution in a shared learning is a false fact in a durable artifact.** It sends the next
reader to the wrong session for the details, and it survives because nobody re-checks a compliment.

⭐⭐ **Verification pressure is normally applied to blame; flattering claims arrive unexamined.** That
asymmetry is exactly why credit needs the same check. Refusing credit I hadn't earned cost one turn and
caught a defect in the bookkeeping — cheap at the price. Related: an error biased *against* your own
position (a stale figure that understates your result) is equally unaudited, for the mirror-image reason.
