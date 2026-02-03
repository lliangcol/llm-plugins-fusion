$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

$activeDir = Join-Path $repoRoot 'nova-plugin/agents'
$archiveDir = Join-Path $repoRoot '.claude/agents/archive'

$expected = @(
  'api-design.md',
  'build-deps.md',
  'data-analytics.md',
  'db-engineer.md',
  'devops-platform.md',
  'git-release-manager.md',
  'incident-responder.md',
  'java-backend-engineer.md',
  'orchestrator.md',
  'quality-engineer.md',
  'refactoring-specialist.md',
  'security-audit.md',
  'security-engineer.md',
  'test-automator.md'
) | Sort-Object

Write-Host "== Active agents =="
$actual = @()
if (Test-Path $activeDir) {
  $actual = Get-ChildItem -File $activeDir -Filter *.md | Select-Object -ExpandProperty Name | Sort-Object
}
Write-Host ("Count: {0}" -f $actual.Count)
$actual | ForEach-Object { Write-Host ("- {0}" -f $_) }

if ($actual.Count -lt 14 -or $actual.Count -gt 18) {
  Write-Error "Active agents count must be 14..18 (got $($actual.Count))."
}
if (-not ($actual -contains 'orchestrator.md')) {
  Write-Error "Missing required agent: orchestrator.md"
}

$missing = @($expected | Where-Object { $actual -notcontains $_ })
$extra = @($actual | Where-Object { $expected -notcontains $_ })
if ($missing.Count -ne 0 -or $extra.Count -ne 0) {
  if ($missing.Count) { Write-Host "Missing expected:"; $missing | ForEach-Object { Write-Host ("- {0}" -f $_) } }
  if ($extra.Count) { Write-Host "Unexpected extra:"; $extra | ForEach-Object { Write-Host ("- {0}" -f $_) } }
  throw "Active agent set mismatch. Expected exactly the 14-file set."
}

Write-Host ""
Write-Host "== Archive presence (should not be default-scanned) =="
if (Test-Path $archiveDir) {
  $archCount = (Get-ChildItem -Recurse -File $archiveDir -Filter *.md | Measure-Object).Count
  Write-Host ("Archive md files: {0}" -f $archCount)
  if ($archCount -gt 0) {
    Write-Host "NOTE: Archive is outside nova-plugin/agents, but if your Claude Code scans .claude/**, tokens may still be high."
    Write-Host "Mitigation (if needed): rename `.claude/agents/archive/` to `.claude/agents-archive/` or move it outside the repo."
  }
} else {
  Write-Host "Archive directory not found (ok)."
}

Write-Host ""
Write-Host "== Manual acceptance checklist =="
Write-Host "1) In Claude Code, run `/context` BEFORE and note: Custom agents tokens = ____"
Write-Host "2) Run `/context` AFTER and note:  Custom agents tokens = ____"
Write-Host "3) Target: tokens drop >= 50%."

Write-Host ""
Write-Host "== Routing test prompts (paste into Claude Code) =="
$prompts = @(
  "Route this task: 'CI pipeline failing after dependency upgrade; lockfile conflicts.'",
  "Route this task: 'Spring Boot add a new REST endpoint + OpenAPI docs.'",
  "Route this task: 'Review this PR for security/performance/maintainability; give prioritized findings.'",
  "Route this task: 'Refactor a legacy module to reduce coupling; keep behavior unchanged.'",
  "Route this task: 'Add integration tests and fix flaky tests in CI.'",
  "Route this task: 'Design an API contract: pagination, error schema, versioning.'",
  "Route this task: 'Production 5xx spike; need mitigation and rollback plan now.'",
  "Route this task: 'Postgres slow query; propose indexes and explain EXPLAIN plan.'",
  "Route this task: 'Define KPIs + funnel analysis; propose experiments.'",
  "Route this task: 'Threat model auth flow; harden secrets/config; OWASP risks.'",
  "Route this task: 'SOC2-style audit checklist + evidence collection plan.'",
  "Route this task: 'Deploy pipeline + Docker/K8s config needs cleanup and rollback steps.'",
  "Route this task: 'Plan release: versioning, tags, changelog, hotfix procedure.'",
  "Route this task: 'Unclear owner: mixed app bug + CI + data metric mismatch; coordinate specialists.'"
)
$prompts | ForEach-Object { Write-Host ("- {0}" -f $_) }

Write-Host ""
Write-Host "OK"
