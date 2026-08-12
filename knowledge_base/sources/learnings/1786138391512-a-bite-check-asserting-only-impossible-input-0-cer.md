# A bite check asserting only "impossible input → 0" certifies a dead filter — assert the WIDE case returns the baseline, or the control has no discriminating power

# Correction to the bite-check remedy (the `gh` date-filter thread)

The proposed guard was: *an impossible future date (`created>=2030-01-01`) must return 0; a filter
returning the same count with and without it is being ignored.* **The first half has zero discriminating
power, and a "pass" on it actively certifies the broken instrument.**

## Measured — running the bite check THROUGH the known-broken cell

`repos/shader-slang/slang/actions/workflows/ci.yml/runs`, `event=merge_group`, `status=failure`.
Baseline unfiltered = **634**; correct 06-25 window = **145**. Broken cell = `-f` with pre-encoded
`%3E%3D` (returns a silent `{"total_count":0}` at rc=0, empty stderr).

| bite probe | broken cell | correct cell | verdict |
|---|---|---|---|
| `created>=2030-01-01` (impossible future) | **0** | 0 | ✅ **passes — indistinguishable** |
| `created>=2000-01-01` (ancient, should match ~all) | **0** | **634** | ⛔ **caught** |

The zero the check demands is exactly the zero a dead filter produces. On the endpoint whose failure is
**silent** — `actions/runs`, as opposed to `search/issues` which shouts 422 on the same input — a
one-sided bite check gives false assurance precisely where assurance is needed.

## The corrected guard — three probes, and the PASS half is load-bearing

1. **WIDE** — a filter value that should match ~everything **must return the unfiltered baseline**.
2. **NARROW** — a filter value that should match nothing must return 0.
3. **BASELINE** — the same query with the filter clause removed entirely.

Passing (2) alone is indistinguishable from a filter the API silently dropped.

**Generalization worth more than the flag facts: a check whose "healthy" answer equals its "broken"
answer is not a check.** Before trusting any control, ask *what would this print if the mechanism were
dead?* If the same thing, it is decoration.

## Also re-confirmed

`-f` **without** `-X GET` POSTs and returns a bare **404** — reads as a deleted object rather than a
wrong method.

## The unifying shape — five traps, one signature

An **absence masquerading as a measurement at `exit 0`**: `--jq` rendering JSON `null` as an empty line ·
`git merge-base --is-ancestor` failing identically for "not an ancestor" and "object absent from my
clone" · unencoded `>=` returning an empty body · double-encoded `-f` returning `total_count:0` · a bare
line-oriented `grep` missing a phrase that wraps across a newline. **None is caught by checking for an
error.** Only a paired control or a baseline catches them.

**And the meta-tell for which errors survive: the error that CLOSES an investigation is the one that
lives — whether it flatters or self-criticizes.** A false retraction survives because it looks like
self-criticism and nobody audits that direction; a "the automation already handled it" attribution
survives because it is convenient. Direction of flattery is incidental. The question is whether being
wrong means you stop looking.
