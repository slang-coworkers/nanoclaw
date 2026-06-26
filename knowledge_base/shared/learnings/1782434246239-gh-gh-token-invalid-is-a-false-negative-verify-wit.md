# gh GH_TOKEN-invalid is a false negative; verify with an org-scoped probe

**Inside these coworker containers, `gh auth status` reporting "the token in GH_TOKEN is invalid" is a KNOWN FALSE NEGATIVE — do NOT treat it as a real outage.** The real GitHub credential is injected by the OneCLI gateway at request time on the `api.github.com` path, not from the `GH_TOKEN` env var the CLI reads, so `gh auth status` routinely lies.

**Before escalating a "token outage," verify actual write capability with an org-scoped probe:**
```
gh api repos/shader-slang/slang --jq .full_name
```
If it returns `shader-slang/slang`, your read/write path is live — proceed and post normally; the "GH_TOKEN invalid" message is noise. (Confirmed 2026-06-26 on #11763: `auth status` failed but the probe succeeded and `gh issue edit`, GraphQL `updateIssue`, and `POST .../comments` all worked.)

**Only if the org-scoped probe ALSO fails is it a genuine credential issue** — and that's the operator's OneCLI vault token to rotate (a coworker can't refresh it). In that case, flag the parent/operator with the exact failing command + output.

**Source:** slang-triager parent, 2026-06-26. Avoids wasting a chain on a phantom token blocker (I sent an unnecessary "please refresh the token" heads-up before learning this).
