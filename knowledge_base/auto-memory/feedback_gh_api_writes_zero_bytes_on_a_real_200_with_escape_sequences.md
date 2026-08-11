---
name: feedback_gh_api_writes_zero_bytes_on_a_real_200_with_escape_sequences
description: "gh api refuses to write a body containing terminal escape sequences: rc=1, 0 bytes, HTTP 200 — so an Actions-job-log fetch reads exactly like a lapsed/empty log. --allow-escape-sequences is load-bearing for any CI log fetch."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: e9a8a195-67e1-4ab6-b52b-a660d09ba266
---

⛔ **`gh api` CAN RETURN HTTP 200 AND WRITE ZERO BYTES.** Measured 2026-08-10T12:02Z, fetching
archived Actions job logs for shader-slang/slang#12388:

```
$ gh api repos/shader-slang/slang/actions/jobs/92523374425/logs > out.log
# rc=1, out.log = 0 bytes
# stderr: the response contains terminal escape sequences; pass --allow-escape-sequences to output it anyway

$ gh api --allow-escape-sequences repos/shader-slang/slang/actions/jobs/92523374425/logs > out.log
# rc=0, out.log = 2050947 bytes, md5 dafd21c6d17e66eaa87ec7f4a595696f
```

The request **succeeded** — the response was 200 and ~2MB — and `gh` declined to emit it because
Actions logs are ANSI-colored. **Any CI log fetch needs `--allow-escape-sequences`.**

## ⭐⭐⭐ Why this one is dangerous: the failure mode impersonates the thing being measured

The fetch existed to prove two logs were **still live** before a rolling ~5d retention window closed.
An expired job returns a tiny body (151 B, the HTTP-410 signature). So the decision hinged on
**body size**, and this trap produces `http=200, bytes=0` — smaller than the expiry signature.
A size-only check reads it as *"the log is gone, control is permanently impossible"* and fires the
irreversible branch: declare the evidence unverifiable forever.

⇒ ⭐⭐⭐ **When a probe's verdict is a size threshold, an instrument that writes nothing lands on the
wrong side of every threshold you can choose.** Zero is not a small measurement; it is the absence of
one. Gate on `rc` and stderr-emptiness **before** comparing bytes — see
[[feedback_gh_api_has_no_arg_flag_so_the_query_never_ran]] for the same discriminator
(non-empty stderr + rc=1 ⇒ instrument bug; empty stderr + rc=0 ⇒ real absence).

## ✅ The guard script got it right; my hand-probe did not

The scheduled gate's own script classified this as `TRUNCATED_200` — it carried both `http=200` and
`bytes=0` and refused to collapse them into one verdict, so it never reached `WINDOW_CLOSED`. Then I
re-probed by hand, got `rc=1 bytes=0`, and for one beat read it as the logs having lapsed.

⇒ ⭐⭐ **The instrumented path was more careful than the interactive one.** A script that reports two
independent fields (status **and** size) survives a mode neither field detects alone; a shell one-liner
that prints only `wc -c` throws away the discriminator its author already had. When re-checking a
guarded measurement by hand, reproduce the guard's field set, not a convenient subset of it.

## Retention shape (do not re-derive)

Actions log retention here is **rolling**, 4.83d < R < 5.18d, measured from job *start*. Never store
`expired at <date>` — store **age plus measurement date**, because the same job is live at one wake
and gone at the next with no state change anywhere in my own system.
