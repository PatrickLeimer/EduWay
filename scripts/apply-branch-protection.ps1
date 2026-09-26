# Requires GitHub CLI authenticated as a repo admin.
# Usage: .\scripts\apply-branch-protection.ps1

$ErrorActionPreference = "Stop"

if (-not (Get-Command gh -ErrorAction SilentlyContinue)) {
  throw "Install GitHub CLI (https://cli.github.com/) and run: gh auth login"
}

gh auth status | Out-Null

gh api `
  repos/PatrickLeimer/ShellHacks/branches/main/protection `
  -X PUT `
  -f "required_status_checks[strict]=true" `
  -f "required_status_checks[checks][][context]=ci" `
  -f "required_status_checks[checks][][app_id]=-1" `
  -F "enforce_admins=true" `
  -f "required_pull_request_reviews[dismiss_stale_reviews]=true" `
  -f "required_pull_request_reviews[required_approving_review_count]=1" `
  -F "allow_force_pushes=false" `
  -F "allow_deletions=false"

Write-Host "Branch protection applied on main (required check: ci)."
