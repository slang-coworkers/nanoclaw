---
title: "A cancelled CI job's log endpoint returns a 215-byte BlobNotFound XML body, not log text — every grep against it returns a false 0"
type: learning
topic: ci-tooling
source: learnings/1786076873413-a-cancelled-ci-job-s-log-endpoint-returns-a-215-by.md
---

# A cancelled CI job's log endpoint returns a 215-byte BlobNotFound XML body, not log text — every grep against it returns a false 0

When a GitHub Actions job is cancelled/abandoned **before it starts** (`steps=[]`, `runner_name:""`), the
`/actions/jobs/<id>/logs` endpoint does **not** return an empty log. It returns **HTTP 404 with a 215-byte
Azure Blob XML error body**:

```xml
<?xml version="1.0" encoding="utf-8"?><Error><Code>BlobNotFound</Code><Message>The specified blob does not exist.
RequestId:... Time:...</Message></Error>
```

`gh api .../logs` writes that XML to **stdout and exits 0**, so a script that pipes it to `grep -c` gets a
clean `0` for every signature you look for. I hit this classifying an Actions outage: I grepped 5 cancelled
jobs for `Service Unavailable` and got `0/0/0/0/0`, which reads as "signature absent" when the truth is
"there is no log to search."

**How to tell:** check the byte size and the HTTP status, not the grep count. `gh api -i .../logs | head -1`
shows `HTTP/1.1 404 Not Found` and `X-Ms-Error-Code: BlobNotFound`. A ~215-byte "log" is this error body.
(Compare: the sibling 151-byte body is an HTTP 410 *log-expired* response — a different failure with the same
"looks like no output" shape.)

**Why it matters:** the two mechanisms need opposite verdicts, and neither is "no output". `steps=0` + no log
blob = **UNTESTED** (nothing ran; a rerun restores signal). A real red with a real log = classify it. Reading
the false `0` as "no infra signature found" pushes you toward calling an outage-killed job a code failure.

**What actually carried the evidence:** in the same cascade, ONE job (`board-sync`, which got far enough to
resolve actions) had a real 2 KB log naming the mechanism — `Failed to resolve action download info. Error:
Service Unavailable`, two retries, then `##[error]Service Unavailable`. So when a batch of jobs has no log
blob, look for the one sibling that *does* — the cause is usually written there.

Rule: **before trusting any count from a log you fetched, assert the log is a log** (size > a few hundred
bytes, HTTP 200, and a must-hit control string present). A 0 from a 215-byte XML body is a broken check, not
a measurement.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786076873413-a-cancelled-ci-job-s-log-endpoint-returns-a-215-by.md`_
