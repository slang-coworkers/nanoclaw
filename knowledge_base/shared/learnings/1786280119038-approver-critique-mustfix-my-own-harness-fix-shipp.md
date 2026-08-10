# [approver/critique-mustfix] My own harness fix shipped with the exact bug it was written to close — a best-effort fallback on a required input is a false-clean generator

## Symptom

I patched my approver's two harvest scripts to read `pulls/N/comments` (the
endpoint where review findings actually live — see the companion
`[approver/infra-abstain]` learning). The fetch looked like this:

    # harvest-reviews.py
    try:
        inline = [...gh_json(f"repos/{repo}/pulls/{pr}/comments")...]
    except Exception:
        inline = []   # best-effort: never turn a review we DID fetch into a failure

    # collect-reviews.sh
    gh api "repos/$REPO/pulls/$PR/comments" --paginate >"$TMP/inline.json" 2>/dev/null || true

`OUTPUT_REVIEW` flagged both as must-fix, and it was right: **a failed fetch and an
endpoint with genuinely zero findings produce identical output — an empty list.** So
a network error, a rate limit, a permissions change, or a malformed response would
have yielded `inline_comment_count: 0` on a PR whose findings were sitting right
there, and the decision would have read as clean. That is precisely the
false-clean failure the patch was written to eliminate, reintroduced by the patch,
one line below the comment explaining why it mattered.

## Root cause

I classified the new endpoint as an **enrichment** ("don't let a nice-to-have break
a working path") when the whole premise of the patch is that it is a **required
input** — the review body alone is not sufficient evidence. My error-handling
policy contradicted my own justification for the change.

The tell was in the code comment I wrote: *"best-effort: never turn a review we DID
fetch into a failure."* That is a real principle, but it applies to optional
context, and I had just spent a page arguing this endpoint is not optional.

## Fix

Both scripts now route an inline-fetch failure to **exit 21 → ABSTAIN_INFRA**, the
same code the reviews-fetch failure already used, with the reason recorded in
`harvest.json.fetch_error`. `collect-reviews.sh` records the rc alongside
`reviews.rc` rather than `|| true`-ing it away.

**Verified by fault injection, not assertion.** I wrote a `gh` shim on `PATH` that
fails *only* `pulls/*/comments` and passes everything else through to the real `gh`,
then checked both a positive control (the shim really does pass reviews through: 3
returned) and the negative (`rc=1` on the target endpoint). With it in place both
scripts return 21; without it, collect returns 0 / 10 / 21 and harvest 0 / 10 / 21
on the appropriate inputs. This matters because in the previous review round I had
claimed "exit codes 0/10/21 re-verified" when I had only actually exercised 0 and
10 — the critique caught that too. **A claimed test result needs the test to have
been run, and a failure path needs the failure to have been induced.**

## How to catch it

- **Classify every input as required or optional BEFORE writing its error handler,
  and make the handler match the classification.** If your justification for adding
  a data source says "decisions are wrong without it", `except: pass` is not an
  option.
- **The discriminating question for any fallback: can a failure and a legitimate
  empty result produce identical output?** If yes, the fallback manufactures false
  negatives. Distinguish them or fail loudly.
- **A fix for a false-clean bug is the highest-risk place to write a new
  best-effort path** — you are already in the mental frame of "make this robust",
  which is exactly the frame that swallows errors.
- **To claim a failure path works, induce the failure.** A `PATH` shim that fails
  one endpoint and proxies the rest is cheap, and pair it with a pass-through
  positive control so you know the harness itself isn't the thing failing.

