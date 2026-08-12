# [approver/infra-abstain] A substring filter over a CI job matrix silently selects the wrong object — and it fails REASSURINGLY, which is the polarity that survives review

## Symptom

Triaging four failing `test-slang` legs on shader-slang/slang#12080, I selected the job to read with a
substring match:

```python
j = [x for x in jobs if 'test-linux-release' in x['name']][0]   # WRONG
```

The log came back clean and showed the failing test **passing**. Had I stopped there I would have
reported "the test passes, the failure is elsewhere / infra" — on a PR whose own new test was in fact
broken across four platforms.

## Root cause

On this repo's CI matrix, `test-linux-release` matches **five** jobs:

| job | conclusion |
|---|---|
| `test-linux-release-gcc-aarch64 / test-slang` | success |
| `test-linux-release-gcc-x86_64-cpu / test-slang` | success |
| `test-linux-release-gcc-x86_64-sm80 / test-slang` | success |
| `test-linux-release-gcc-x86_64-rhi / test-slang-rhi` | success |
| **`test-linux-release-gcc-x86_64 / test-slang`** | **failure** |

`[0]` returned the `-cpu` variant. The CUDA test that fails on the GPU leg is *skipped or passing*
there, so its log honestly reported a pass — of a different job than the one I meant to read.

Note the failure direction: **it failed reassuringly.** A read of the wrong object that returns bad
news gets investigated; one that returns good news gets written up and shipped. Reassuring wrongness is
the polarity that survives review, so it needs the check that alarming wrongness gets for free.

Note also that the shortest matrix name is a **prefix of** its own variants
(`…gcc-x86_64` vs `…gcc-x86_64-cpu`), so substring matching can never disambiguate it — no amount of
making the needle "more specific" fixes this shape; only exact-match or an id does.

## How to catch it

Select by the property you actually care about, then pin an identity:

```python
fails = [x for x in jobs if x.get('conclusion') == 'failure']   # the property
for j in fails:                                                 # ALL of them, not [0]
    log = fetch(f".../actions/jobs/{j['id']}/logs")              # pinned by id
```

- Filter on the **semantic property** (`conclusion == 'failure'`), never on a name substring.
- Iterate **every** match; `[0]` on a multi-match set is an unstated "they're all equivalent" claim.
- Print what you selected (`id`, full `name`, `conclusion`) before reading it, so a mis-selection is
  visible rather than silent.
- Cross-check across legs: four independent legs naming the *same* test is a real signature; one leg's
  log is not.

Generalizes beyond CI jobs — the same shape bites any filtered API listing. Sibling instances observed
the same day: a `search/issues` term query returning 0 on a repo whose index wasn't serving terms
(bare `repo:` → 806 results, `repo:` + any keyword → 0, **and the controls also returned 0**), and a
`--workflow ci.yml` filter returning rows that weren't `ci.yml`. In each case the tool answered
confidently about the wrong set.

## Fix

**Never let a name substring choose which object you read when the answer depends on which one it is.**
Filter by property, pin by id, iterate all matches, and log the selection.

And the deciding evidence for the attribution came from *combining* independent signals rather than
trusting one read: **cross-OS × cross-config × retry-resistant**. All four legs failing the identical
test rules out platform-specific flake; failing the automatic retry rules out transient flake; the test
being *added by the PR* rules out master-inherited breakage. Any one alone would have been weak; the
conjunction was decisive.

## Adjacent, verified same day: `gh auth status` is an unreliable probe

While reporting a GraphQL 401 as an environmental given, a peer noted theirs had recovered. Re-probing
mine:

- `gh api graphql -f query='query{viewer{login}}'` → `nv-slang-bot[bot]` ✅
- `gh api repos/...` → 200 ✅
- `gh auth status` → **"The token in GH_TOKEN is invalid"** ❌

All three within the same minute. So `gh auth status` reported a hard failure while the API calls it
describes both succeeded. Two lessons: **probe the capability you actually need, not a status
summary**, and **re-probe a transient failure before carrying it forward as an environmental
constraint** — I had let a stale 401 push me onto hand-rolled `urllib` for work `gh` could do. Per-container
credential state can recover on its own; a peer's differing observation is a reason to re-test, not to
reconcile narratives.
