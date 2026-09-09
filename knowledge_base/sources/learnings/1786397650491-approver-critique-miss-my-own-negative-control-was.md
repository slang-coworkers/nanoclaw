---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786396750013-59x57n
written_at: 2026-08-10T21:34:10.491Z
---

# [approver/critique-miss] My own negative control was inert too: GH_TOKEN is proxy-injected, so a "bogus token" test breaks nothing

**Symptom.** While verifying a probe I wrote, I ran what I believed was a negative control — `GH_TOKEN=bogus ./probe.sh shader-slang/slang 12084` — expecting a loud auth failure. It returned rc=0 and a clean "0 threads". I first read that as a real defect in my probe (a false-clean on auth failure).

**Root cause.** The control never broke anything. In this container `GH_TOKEN=ROUTED_VIA_ONECLI_PROXY` — a literal sentinel, not a credential. Auth is injected at the OneCLI HTTPS proxy (`HTTPS_PROXY`, `SSL_CERT_FILE=/tmp/onecli-combined-ca.pem`, `NODE_EXTRA_CA_CERTS`). Overriding `GH_TOKEN` changes a variable nothing reads. Confirmed: the same bogus-token call against raw `gh api graphql` returned real data (`totalCount:1`).

**The lesson, and it is the one I was dispatched to verify.** I was sent a correction whose stated rule was *run the control once before prescribing it* — and I then authored a control against my model of how auth works rather than how it works here, inside the very task about that error class. Proximity to the rule did not help. The framing that let it through: I treated the control's *result* as data about the probe without first asking whether the control was capable of failing.

**How to catch it.** A negative control needs its own positive check: **prove the control can fail before trusting what it says about the target.** Concretely — before reading a red/green from a control, break it deliberately in a way you can verify (here: point the probe at a nonexistent PR, which genuinely fails ⇒ `PROBE FAILED (no liveness) … exit 4`). If you cannot make the control fail, it carries no bits, exactly like the dead-flag revert-drill that is green by construction.

**Generalization.** `env`-var overrides are not a valid failure-injection mechanism in a proxy-credentialed container. Anything of the shape "unset/corrupt the credential to test the sad path" is inert here. Inject the failure at a layer the code actually consults — a bad PR number, a bad repo name, a malformed query.

**Fix applied.** The probe now asserts LIVENESS by selecting the PR's own `number` and comparing it to the requested one, and ships a `--self-test` mode that feeds canned null/partial-error payloads through the assertion logic so the guards are *observed* firing rather than assumed. Both were added only because the inert control forced me to find a failure injection that worked.
