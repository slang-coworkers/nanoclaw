---
title: "A probe that cannot produce a positive proves nothing by its negative"
type: learning
topic: verification
source: learnings/1786025100521-a-probe-that-cannot-produce-a-positive-proves-noth.md
---

# A probe that cannot produce a positive proves nothing by its negative

# A probe that cannot produce a positive proves nothing by its negative

Measured 2026-08-06 reviewing slang-coworkers/nanoclaw#1118 (supply-chain release-age gate). Two
distinct instances of the same class in one session, one of them in the PR's own CI script.

## Rule

⭐⭐⭐ **Before believing a probe's negative result, ask: under what input would this same probe
print a positive?** If you cannot name one, the negative is not evidence — it is an untested
instrument. Run the positive case FIRST, as the control.

## Instance 1 — my own, caught by luck

Testing whether pnpm's `minimum-release-age` gate reaches `pnpm install -g`, I probed with
`is-odd@3.0.1` against the repo's real 4320-minute (3-day) window. It installed; I briefly read
`RC=0` as "the gate does not apply to global installs."

**But `is-odd@3.0.1` is years old — it passes a 3-day gate whether or not the gate is read.** The
probe had no configuration under which it could refuse, so its success discriminated nothing.
Re-ran with a forced ~190-year window (`minimum-release-age=99999999`), which makes *every* package
under-age, plus a local-install control in the same shell. The finding survived — but by luck, not
method: the conclusion happened to be right for a reason the test never established.

⇒ **When probing a threshold, set the threshold so the expected outcome is forced, not incidental.**

## Instance 2 — the same bug in the artifact under review, one level up

`scripts/check-release-age-policy.sh` printed `pnpm --version` from the repo root (10.33.0, resolved
from `packageManager`) and concluded *"verified against pnpm 10.33.0"*. Its probe fixture was
`{"name":...,"private":true}` with **no `packageManager`**.

Where `pnpm` is a **corepack shim** (`/usr/local/bin/pnpm` → `corepack/dist/pnpm.js`), the version
resolves **per-cwd**. Instrumented the real script, adding only `pnpm --version` inside the probe
subshell:

```
reported by the script (repo root) : 10.33.0
actually used inside BOTH probes   : 11.20.0
```

The script's entire premise is "don't trust a claim you haven't made the tool demonstrate" — and its
provenance line could silently name a tool that never ran. Fix is one field in the fixture
(`"packageManager":"pnpm@10.33.0"`); better, interpolate the root's resolved version so it can't
drift.

⇒ ⭐⭐ **Print a tool's version from INSIDE the fixture that used it, never from the caller's cwd.**
Version managers (corepack, mise, asdf, nvm, `packageManager`) make `tool --version` a function of
directory. A version reported from one cwd about work done in another is an unsourced claim.

## Detector

Cheapest discriminator for both: **the tool's own output footer.** pnpm prints
`Done in 2.4s using pnpm v11.20.0` — that line, not my assumption, is what caught instance 2. When a
tool volunteers its identity in output, read it instead of inferring it.

## Reporting note

Both defects were reported as *"this does not change the verdict today, and here is why"* —
CI provisioned a real standalone binary, so CI measured the right pnpm; only the local path was
affected. ⭐ **Separating "the instrument is wrong" from "the conclusion is wrong" keeps the finding
credible**; conflating them overstates it and invites dismissal of both.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786025100521-a-probe-that-cannot-produce-a-positive-proves-noth.md`_
