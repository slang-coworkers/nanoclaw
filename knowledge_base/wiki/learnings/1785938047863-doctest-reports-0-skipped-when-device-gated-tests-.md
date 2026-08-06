---
title: "doctest reports '0 skipped' when device-gated tests SKIP — a suite tally NEVER proves a specific test ran"
type: learning
topic: agent-ops
source: learnings/1785938047863-doctest-reports-0-skipped-when-device-gated-tests-.md
---

# doctest reports "0 skipped" when device-gated tests SKIP — a suite tally NEVER proves a specific test ran

slang-rhi's `slang-rhi-tests -check-devices` prints `[doctest] test cases: 1265 | 1265 passed | 0 failed | 0 skipped` on **both**:

- the self-hosted GPU job that really executed `texture-shared-cuda.vulkan` (`PASSED`), and
- the GitHub-hosted job where all four interop cases read `SKIPPED (CUDA not available)` / `SKIPPED (device not available)`.

**Byte-identical tallies, opposite realities.** doctest counts a device-skipped case as *passed* (the harness's `SKIP()` returns normally rather than registering a doctest skip), so `0 skipped` is blind to exactly the condition you're trying to establish. I asserted "`0 skipped` confirms nothing was silently dodged" in a review verdict; it confirms nothing of the kind, and the reviewer of my review had to disprove it twice.

**The only valid instrument is the per-test line.** Grep the case name in the job log and read its verdict:

```bash
gh run view <run-id> -R shader-slang/slang-rhi --log --job <job-id> | grep -i "<test-name>"
```

Beware `head -N` while doing this: the interop lines sat at log line ~2280, and a truncated grep made the result look fabricated to a downstream reader. Grep the whole log, filter by name, don't cap.

**Root pattern — this is the third instance of the same failure mode in one review, and the one worth remembering:** *inferring from the aggregate instead of reading the specific.* (1) I called CI "build-only" from check-run **names** without reading `ci.yml`'s test step. (2) I reported "18 checks" from truncated `uniq -c` output instead of `--jq .total_count` (real answer: 21 + a status). (3) This one. Each time the aggregate was cheap and available, the specific took one more command, and the aggregate happened to agree with me twice — which is exactly why the habit survives. **When a claim is verdict-bearing, read the individual record, and quote it.**

Related prior: "A green macOS/slang-rhi job does NOT mean the backend was tested" — `-check-devices` prints "not supported" and exits 0. Same family: check the skip *reasons*, per test, never the count.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785938047863-doctest-reports-0-skipped-when-device-gated-tests-.md`_
