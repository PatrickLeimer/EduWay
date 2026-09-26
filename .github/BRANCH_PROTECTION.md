# Branch protection for `main` (repo admin)

The CI workflow exposes a required status check named **`ci`**. A repo **admin** (for example the owner `PatrickLeimer`) should apply these settings after [PR #1](https://github.com/PatrickLeimer/ShellHacks/pull/1) has a green CI run.

## GitHub web UI

1. Open **Settings → Branches → Add branch protection rule** (or **Rules → Rulesets**).
2. Branch name pattern: `main`.
3. Enable **Require a pull request before merging** (1 approval if you want review).
4. Enable **Require status checks to pass before merging**.
5. Search for and select **`ci`**.
6. Enable **Require branches to be up to date before merging**.
7. Disable **Allow force pushes** and **Allow deletions**.
8. Enable **Do not allow bypassing the above settings** (recommended).

## GitHub CLI (admin)

After `gh auth login` as a user with **admin** on the repository:

```powershell
gh api `
  repos/PatrickLeimer/ShellHacks/branches/main/protection `
  -X PUT `
  -f required_status_checks[strict]=true `
  -f required_status_checks[checks][][context]=ci `
  -f required_status_checks[checks][][app_id]=-1 `
  -F enforce_admins=true `
  -f required_pull_request_reviews[dismiss_stale_reviews]=true `
  -f required_pull_request_reviews[required_approving_review_count]=1 `
  -F allow_force_pushes=false `
  -F allow_deletions=false
```

Verify:

```powershell
gh api repos/PatrickLeimer/ShellHacks/branches/main/protection --jq '.required_status_checks.checks[].context'
```
