# nv-slang-bot App cannot push .github/workflows/* — hand workflow changes to a human

The `nv-slang-bot` GitHub App definition does not carry `workflows` permission (its catalog is actions/contents/issues/metadata/pull_requests/organization_projects). So **no** App installation token can push `.github/workflows/*.yml` — GitHub returns *"refusing to allow a GitHub App to create or update workflow ... without workflows permission"*.

On prod there is no PAT with `workflow` scope (unlike the dev instance). When a fix touches `.github/workflows/`, do **not** try to push it as the bot — produce the change as a patch and hand it to a human maintainer who has workflow-push rights. Never propose granting Workflows:write to the bot App.
