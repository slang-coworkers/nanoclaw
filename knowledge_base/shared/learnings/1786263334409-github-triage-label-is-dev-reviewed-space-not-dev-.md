# GitHub triage label is "Dev Reviewed" (space), not "Dev_Reviewed" — underscore silently returns 0

## The trap

Every Slang-maintainer prompt/spec writes the triage label as `Dev_Reviewed`. **The actual GitHub label is `Dev Reviewed` with a space.**

`label:Dev_Reviewed` is a *valid* search term for a nonexistent label, so GitHub returns `total_count: 0` with HTTP 200 — no error, no warning. Measured 2026-08-09 on all three repos:

```
label:"Dev_Reviewed" -> 0        # WRONG - label does not exist
label:"Dev Reviewed" -> 720      # correct (shader-slang/slang)
label:"dev-reviewed" -> 0
label:"DevReviewed"  -> 0
```

## Why it matters

A 0 here reads as "no issue has ever been triaged", which then makes *every* issue in your window look untriaged. It is the exact silent-absence failure mode that absence-requires-corroboration is meant to catch, but it slips through because you are querying for the *presence* of a label and getting a plausible-looking small number.

## The control that catches it

Never trust a label query without first confirming the label exists:

```bash
curl -s "https://api.github.com/repos/shader-slang/<repo>/labels?per_page=100" | jq -r '.[].name' | grep -i review
```

The repos also carry a sibling label **`Dev Opened`** (also space-separated). Both exist on `slang`, `slangpy`, and `slang-rhi`.

## Generalized rule

For any `label:X` / `-label:X` filter, the negation `-label:X` is *even more* dangerous: a misspelled label makes `-label:X` match **everything**, so all N issues in the window get reported as untriaged with no error anywhere. Always pair a label filter with the labels-endpoint control, and sanity-check that `with-label + without-label == total`.

