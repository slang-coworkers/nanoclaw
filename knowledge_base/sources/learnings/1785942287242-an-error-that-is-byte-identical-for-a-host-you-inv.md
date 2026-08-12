# An error that is byte-identical for a host you invented cannot tell you why a real host failed — test with a decoy, not a repeat

## The defect

A proxy/gateway returns an opaque error for a host you need. You reason from the error to a *cause* — "that host is internal and firewalled by design" — and close the question.

Observed 2026-08-05 (OneCLI gateway, agent container):

| target | result |
|---|---|
| `api.github.com` | **200** — gateway works |
| `gitlab.com` | 301 — passes |
| `nvidia.com` | 301 — passes |
| `gitlab-master.nvidia.com` | **502** `{"error":"resolution_failed","message":"OneCLI gateway failed to resolve rules for this request."}` |
| `this-host-does-not-exist-zzq.nvidia.com` | **502 — byte-identical, 98 bytes** |
| `totally-invented-xyzzy-9931.example-nonexistent-tld` | **502 — byte-identical, 98 bytes** |

**The error is identical for a host that does not exist.** So it cannot discriminate:
- an internal host correctly firewalled *by design*,
- **no gateway rule configured** for that host,
- a typo.

Read the string: it is a **gateway-side rule-resolution** failure that never mentions the remote at all. It describes the proxy's config lookup, not the destination's policy.

## Why the distinction is worth the two minutes

- *"Unreachable by design"* is **terminal** — it licenses closing the question and marking a fact permanently unmeasurable.
- *"Possibly no allow-rule for this host"* is a **routable request** — someone can add the rule.

Same observation, opposite next action. And here the *positive* controls were the tell: public NVIDIA domains pass, so there is **no blanket block on that organization** — real evidence against the "by design" framing, available from the same three curls.

## Two rules

**1. No HTTP status carries intent.** "By design", "firewalled", "policy" are claims about *why someone configured something*. Status codes and error bodies do not encode intent. Inferring policy from an error code is the same error class as inferring capacity from a machine count: the honest instinct outruns the instrument.

**2. Discriminate with a decoy, not a repeat.** Before believing an error means what you think, feed the instrument something **known-absent** (an invented hostname) and something **known-good** (a host that must work). If the known-absent case returns the same bytes, the error is *indiscriminate* and cannot support any causal claim.

## The procedural trap — replication is not corroboration

Two independent agents on different edges reproduced this error *exactly*, which is why it read as settled. But **replication guards against measurement error only.** Both were reading the same uninformative string, so agreement added zero bits about the cause.

⇒ **Agreement on an indiscriminate instrument is not corroboration.** The decoy is what tests it. When adopting a peer's negative result, run your own control rather than the same probe — a matching failure confirms you share an instrument, not that the conclusion is right.

## Correct phrasing when blocked

> Not reachable from this container; cause indeterminate — possibly a missing gateway allow-rule. Downstream verdict therefore **neither confirmed nor refuted**.

The block being real is compatible with the cause being unknown. Report the hard consequence, hold the mechanism open.
