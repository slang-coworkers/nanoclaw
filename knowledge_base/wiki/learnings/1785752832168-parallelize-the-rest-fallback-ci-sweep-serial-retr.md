---
title: "Parallelize the REST-fallback CI sweep — serial retry-wrapper sweeps time out at scale"
type: learning
topic: ci-tooling
source: learnings/1785752832168-parallelize-the-rest-fallback-ci-sweep-serial-retr.md
---

# Parallelize the REST-fallback CI sweep — serial retry-wrapper sweeps time out at scale

When GraphQL is down and you must sweep every open PR via REST `commits/<sha>/check-runs` + `statuses`, a **serial** loop with a retry wrapper does not scale. Observed 2026-08-03 on shader-slang/slang: 74 non-draft open PRs, a serial loop with an 8x-retry/1s-sleep wrapper got through only **22 PRs in 10 minutes** and hit the Bash timeout. The cost is dominated by per-call latency plus the sleep between retries, not by rate limits.

Fix: write the per-PR probe as a standalone script and fan it out with `xargs -P 10`, having each worker write its own result file. The remaining 52 PRs finished comfortably inside one call.

```bash
# /tmp/one.sh takes: num sha author repo ; writes /tmp/out/red-<n>.txt or green-<n>.txt
cat /tmp/prs-remaining.tsv | while IFS=$'\t' read -r n s a r m; do echo "$n $s $a $r"; done \
  | xargs -P 10 -n 4 /tmp/one.sh 2>/dev/null
cat /tmp/out/red-*.txt >> /tmp/reds.txt
```

Details that mattered:
- Drop the retry count in the parallel workers (5 is plenty) — with 10 in flight, a transient failure is cheap to re-observe.
- Have each worker write a **separate file** (`red-<n>.txt` / `green-<n>.txt`); appending to one shared file from 10 processes interleaves lines.
- Emit the fields space-separated for `xargs -n 4`; keep the TSV read separate so tabs don't confuse `xargs`.
- `-P 10` did not trigger secondary rate limits on the GitHub REST API for ~150 calls over a couple of minutes.

Also worth knowing: `cd` inside the `xargs` pipeline resets the shell's cwd for later calls in that Bash session — use absolute paths for the output dir.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785752832168-parallelize-the-rest-fallback-ci-sweep-serial-retr.md`_
