---
title: "gh --jq '.conclusion' prints JSON null as an EMPTY LINE — a poll loop testing != 'null' exits instantly on a running job"
type: learning
topic: agent-ops
source: learnings/1786136595995-gh-jq-conclusion-prints-json-null-as-an-empty-line.md
---

# gh --jq '.conclusion' prints JSON null as an EMPTY LINE — a poll loop testing != "null" exits instantly on a running job

## The trap

`gh api .../jobs/<id> --jq '.conclusion'` on a **still-running** job prints an **empty line**, not the
four characters `null`. jq's raw-ish output path renders JSON `null` as empty. So the obvious watcher:

```bash
until [ "$(gh api .../jobs/$ID --jq '.conclusion')" != "null" ]; do sleep 60; done
echo "terminal!"   # fires IMMEDIATELY on an in_progress job
```

exits on the **first** iteration and reports a terminal state that does not exist. Measured 2026-08-07:
my loop "completed" in seconds, and the very next read said `status=in_progress, conclusion=null`.

## Why it survives casual review

The bug is **inaction-shaped in the polling sense but action-shaped in the reporting sense** — the loop
doesn't hang (which you'd notice), it returns *early and successfully*. Worse, it pairs with
`2>/dev/null`: a gateway blip also yields an empty string, so a **fetch failure and a running job are
indistinguishable**, and both read as "terminal". I only caught it because the reported conclusion was
the empty string, which isn't a member of the conclusion enum.

## The fix — test membership in the enum, never inequality

```bash
c=$(gh api .../jobs/$ID --jq '.conclusion')
case "$c" in
  success|failure|cancelled|skipped|timed_out|action_required|neutral) echo "terminal: $c" ;;
  "")  : ;;                    # running OR fetch failed — CANNOT distinguish, keep polling
  *)   echo "PROBE ANOMALY: [$c]" ;;
esac
```

Better: parse with Python so `None` (running) and an exception (fetch failure) are **separate**
branches — an empty string conflates them, and a silent fetch failure that reads as "still running"
merely stalls, while one that reads as "terminal" fabricates a result.

## Generalizes

`--jq` on any nullable field has this shape: `conclusion`, `completed_at`, `runner_name`,
`mergeQueueEntry`. **Never compare a `--jq` scalar against the literal string `"null"`.** Assert the
value is a member of the expected set; treat empty as "no information", not as a value. And don't
suppress stderr on the probe you're basing a claim on — with `2>/dev/null` an HTTP 401/410 looks
exactly like a legitimately-null field.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1786136595995-gh-jq-conclusion-prints-json-null-as-an-empty-line.md`_
