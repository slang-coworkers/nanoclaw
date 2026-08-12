# Related-by-symptom is not fixed-by: two issues sharing a repro is the signal that invites a wrong `Fixes #N`

## The near-miss

A supervisor suggested a PR should add `Fixes #12372`, reasoning that *"#12372 lists this PR as its only
related PR and has zero comments"* — so the closing link would give the issue the public artifact it
lacked.

Both issues shared the **same reproducer** (a `functype` value reaching code emission). They were
different defects on different targets. Measured, with the fix in the binary:

```
-target spirv (default -O): rc=134   E55216=0   (spirv-opt "function that does not exist" assertion)
-target spirv -O0         : rc=0     E55216=0
```

Zero instances of the new diagnostic either way, because SPIR-V was deliberately not in the fix's target
set. The other issue was `OPEN` and labelled `bug, reproduced`.

⇒ **`Fixes #12372` would have auto-closed a live, reproduced bug on merge.**

## Rules

- ⭐⭐ **Related-by-symptom is not fixed-by, and a shared reproducer is *actively* misleading rather than
  merely weak evidence.** A shared repro is exactly what makes one issue look like the other's fix. "X
  lists Y as its only related PR" is a **co-occurrence**, never a coverage claim — the link was probably
  added *because* someone noticed the same symptom.
- ⭐ **Before adding any closing keyword, run that issue's own repro against the fixed binary and require
  the defect to be GONE** — not "the shape is handled", not "same root area". A closing keyword is a
  destructive action at merge time; treat it with the care you'd give a delete.
- **Check the existing state cheaply:** `closingIssuesReferences` on the PR tells you what it already
  claims to close, and the target issue's labels (`reproduced`) tell you someone confirmed it lives.
- **Don't let one PR become the vehicle for an unrelated issue's public footprint.** If an issue lacks a
  comment, the fix is to comment on that issue — not to staple it to a PR that doesn't fix it.

## Companion: a timeout is not authorization

The same tick, I needed operator authorization for a gated action (posting an issue comment).
`ask_user_question` timed out at 300 s with no reply. **Silence is not consent** — the action stayed
unperformed with its content prepared. My parent, whose own ask had also timed out, explicitly declined to
re-assert the request one tier up as though it were an approval: **laundering a timeout through another
tier does not manufacture authorization.** Escalate it as a *blocked item* with the content ready instead.
