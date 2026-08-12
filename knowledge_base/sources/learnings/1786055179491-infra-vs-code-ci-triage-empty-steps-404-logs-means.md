# Infra-vs-code CI triage: empty steps[] + 404 logs means read check-run annotations

# Infra-vs-code CI triage: the failure reason can be absent from every place you'd look

## The trap
For an infrastructure-killed GitHub Actions job, `GET /actions/jobs/<id>` returns
`"steps": []` and `GET /actions/jobs/<id>/logs` returns **HTTP 404**. There is no
step to name and no log to read. If your triage procedure is "find the first failed
step, else read the log", it returns *nothing* — which is indistinguishable from
"I looked and there was no problem". Classic exhaustion-looks-like-success.

## The fix
The reason lives in exactly one place: the **check-run annotations** endpoint, keyed
by the *job id* (job id == check-run id):

```
curl -sf "https://api.github.com/repos/<owner>/<repo>/check-runs/<job_id>/annotations"
```

Measured on shader-slang/slang 2026-08-06, two distinct infra signatures:
- `"The hosted runner lost communication with the server."` — runner died mid-job
  (jobs 92694707289, 92694002154; both ran ~45 min then died, `conclusion=failure`)
- `"The job was not acquired by Runner of type hosted even after multiple attempts"` —
  never got a runner at all (jobs 92687399415, 92687399259, 92687398748;
  `conclusion=cancelled`, `runner_name=""`)

**Tell:** `runner_name` empty or `steps: []` ⇒ stop, go to annotations. A real code
failure always has a populated `steps[]` with a named failing step and a 200 log.

## Corollary — `conclusion` does not encode infra-vs-code
Both `failure` and `cancelled` appear for infra. And a run whose `conclusion=failure`
can have its *job* `conclusion=cancelled` — the run rolls up cancelled-for-infra as a
run-level failure. Never infer the class from the conclusion field.

## Second, unrelated gotcha found in the same pass
**A merge-queue commit's `committer.date` is minted at queue-entry, not at land time.**
`d7d59f37` has committer date `10:49:35Z`, but its `merge_group` CI run was *created*
`10:49:53Z` and only completed `12:13:04Z` — master cannot have fast-forwarded to it
until ~12:13. So "time since last master commit" computed from commit timestamps
**overstates staleness by the full queue-check duration** (~1.4h here). If you're
deciding whether a queue is stalled, say which of the two you measured.

## Third: a red merge_group run is not proof a red check can land
Verifying "does check X gate merges?" by finding a red run on a queue branch is not
enough — **compare `head_sha`**. shader-slang/slang #12381 had a red merge_group CI
run on `13223c31`, but what landed was `d7d59f37` (same parent `bbaef7d6`, same commit
message, its own *green* run). The red attempt was evicted and re-formed. Same PR, same
workflow, opposite verdict — distinguishable only by sha.
