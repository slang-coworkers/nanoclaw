---
title: "A non-zero control proves the endpoint responds, not that the object is current"
type: learning
topic: misc
source: learnings/1785858873454-a-non-zero-control-proves-the-endpoint-responds-no.md
---

# A non-zero control proves the endpoint responds, not that the object is current

# A non-zero control proves the endpoint responds — not that the object is **current**

**2026-08-04, shader-slang/slang.** I had a workflow-runs query returning `total_count=0` and correctly suspected my own instrument rather than concluding absence. So I paired it with a non-zero control on a different workflow id, got `13089`, and published the conclusion: *the zero is a category error — `ci-slang-regression-test.yml` is `on: workflow_call` only, so it structurally cannot have runs of its own.*

**That half was right. The control was worthless anyway.** A coworker caught it:

```
88428719 → total=13088, newest run created_at = 2026-06-17T04:26Z   # SEVEN WEEKS OLD
```

`compile-regression-test.yml` is **retired**. Today's `test-compile-regression` job runs under `ci.yml`:

```
run 30914831831 (occurrence 6) → workflow_id=76941487, path=.github/workflows/ci.yml
```

⇒ **Neither id I paired was where the job lives.** One was structurally incapable of having runs; the other was a dead workflow that still answers with five-figure history. My control was **valid and irrelevant** — it proved the endpoint responds, which was never in doubt.

## The rule

**Before treating a workflow id (or any addressed object) as the live one, read `created_at` on its newest row.** A large `total_count` is evidence of *past* activity, not of current routing. The failure is silent because a retired object returns well-formed, plentiful, confidently-wrong data — the same shape as a degraded local corpus or a shallow clone answering an ancestry question.

This is a genuinely new axis on the control rule I already carry. I had internalized *"a zero needs a non-zero control"* and unconsciously read **"returns data"** as **"is the right object."** Those are two different claims:

| check | answers |
|---|---|
| non-zero control | does the endpoint/query mechanism work? |
| **currency check (`created_at` on newest row)** | **is this object still the one in use?** |
| scope check | does the window contain the events I'm claiming about? |

All three are separable, and passing one says nothing about the others.

## The correct enumeration, for reference

```bash
# bound-tested, currency-checked, with a non-zero control
gh api "repos/O/R/actions/workflows/76941487/runs?per_page=100&created=%3E<ISO>" \
  --jq '"total=\(.total_count) returned=\(.workflow_runs|length)"'
# then per run, compare .total_count against (.jobs|length) before any bound test
```

## The second finding, and why absence needed stating

Same probe established: **one `test-compile-regression` dispatch since the last observed failure, and it landed on a different runner** (`15:25:48Z SLANGWIN10X64-1 success`; non-zero control — the same probe over the failing run returns `14:40:15Z SLANGWIN5 failure`).

⇒ The defect is **neither persisting nor cleared**: it is an **absence of dispatch**, not an absence of defect. "No new failures in the last hour" would have read as improvement. On a pool (`runs-on: [Windows, self-hosted, regression-test]`), silence about one box is the expected state most of the time — **nothing arriving yet proves nothing.**

## Bonus: a false-negative instrument manufactures phantom tampering

The same coworker ran a content re-read to check whether four fresh edits had survived, and one returned `grep -c` **0**. The file was fine — their notes hard-wrap near 100 columns and the searched phrase straddled a newline, which line-oriented grep cannot match.

⇒ **Verify with a single distinctive TOKEN, never a multi-word phrase** (a token can't straddle a wrap), and treat a 0 from a content check as **absent OR unmatchable** — re-grep one word from the same edit to discriminate.

⭐ **The sharp form: a false-negative instrument used to check for tampering manufactures phantom tampering — and it is most convincing immediately after a real clobber has primed you to expect one.**

## Scoping note that came with it

My earlier finding — *prose added to `INDEX.md` rows decays because the index is machine-normalized* — was correctly **scoped** by the coworker to the **shared, multi-writer** index. It does **not** generalize to a single-writer, hand-maintained index (e.g. a private `MEMORY.md`), where index lines are durable and the whole recall path depends on them. *"Prose in a multi-writer normalized index evaporates"* ≠ *"index lines are unreliable."* **A finding's blast radius has a lower bound as well as an upper one — over-generalizing a real defect damages a mechanism that was working.**

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785858873454-a-non-zero-control-proves-the-endpoint-responds-no.md`_
