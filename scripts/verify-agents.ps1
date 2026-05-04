$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $repoRoot

$activeDir = Join-Path $repoRoot 'nova-plugin/agents'
$archiveDir = Join-Path $repoRoot '.claude/agents/archive'
$legacyAgentsDir = Join-Path $repoRoot '.claude/agents/archive/nova-plugin/agents'

$expected = @(
  'architect.md',
  'builder.md',
  'orchestrator.md',
  'publisher.md',
  'reviewer.md',
  'verifier.md'
) | Sort-Object

$requiredSections = @(
  'Do:',
  "Don't:",
  'Use when:',
  'Workflow:',
  'Output:',
  'Pack hints:'
)

Write-Host "== Active agents =="
$actual = @()
if (Test-Path $activeDir) {
  $actual = Get-ChildItem -File $activeDir -Filter *.md | Select-Object -ExpandProperty Name | Sort-Object
}
Write-Host ("Count: {0}" -f $actual.Count)
$actual | ForEach-Object { Write-Host ("- {0}" -f $_) }

if ($actual.Count -ne 6) {
  Write-Error "Active agents count must be exactly 6 (got $($actual.Count))."
}
if (-not ($actual -contains 'orchestrator.md')) {
  Write-Error "Missing required agent: orchestrator.md"
}

$missing = @($expected | Where-Object { $actual -notcontains $_ })
$extra = @($actual | Where-Object { $expected -notcontains $_ })
if ($missing.Count -ne 0 -or $extra.Count -ne 0) {
  if ($missing.Count) { Write-Host "Missing expected:"; $missing | ForEach-Object { Write-Host ("- {0}" -f $_) } }
  if ($extra.Count) { Write-Host "Unexpected extra:"; $extra | ForEach-Object { Write-Host ("- {0}" -f $_) } }
  throw "Active agent set mismatch. Expected exactly the 6 core-agent files."
}

Write-Host ""
Write-Host "== Agent contract =="
foreach ($fileName in $actual) {
  $path = Join-Path $activeDir $fileName
  $content = Get-Content -Raw $path
  $frontmatter = [regex]::Match($content, "(?s)^---\r?\n(.*?)\r?\n---")
  if (-not $frontmatter.Success) {
    throw "$fileName is missing YAML frontmatter."
  }
  $fm = $frontmatter.Groups[1].Value
  foreach ($field in @('name', 'description', 'tools')) {
    if (-not [regex]::IsMatch($fm, "(?m)^$field\s*:\s*\S")) {
      throw "$fileName frontmatter missing required field: $field"
    }
  }
  $nameMatch = [regex]::Match($fm, "(?m)^name\s*:\s*([a-z0-9-]+)\s*$")
  $expectedName = [IO.Path]::GetFileNameWithoutExtension($fileName)
  if (-not $nameMatch.Success -or $nameMatch.Groups[1].Value -ne $expectedName) {
    throw "$fileName frontmatter name must equal basename '$expectedName'."
  }
  $body = $content.Substring($frontmatter.Index + $frontmatter.Length)
  foreach ($section in $requiredSections) {
    if (-not $body.Contains($section)) {
      throw "$fileName body missing required label: $section"
    }
  }
  Write-Host ("- {0}: ok" -f $fileName)
}

Write-Host ""
Write-Host "== Archive presence (should not be default-scanned) =="
if (Test-Path $archiveDir) {
  $archCount = (Get-ChildItem -Recurse -File $archiveDir -Filter *.md | Measure-Object).Count
  Write-Host ("Archive md files: {0}" -f $archCount)
  if (Test-Path $legacyAgentsDir) {
    $legacyAgentCount = (Get-ChildItem -Recurse -File $legacyAgentsDir -Filter *.md | Measure-Object).Count
    Write-Host ("Legacy agent files: {0}" -f $legacyAgentCount)
  }
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
  "Route this task: 'Threat model auth flow; harden secrets/config; OWASP risks.'",
  "Route this task: 'Plan release: versioning, tags, changelog, hotfix procedure.'",
  "Route this task: 'Marketplace schema validation failed after metadata edits.'",
  "Route this task: 'MCP server setup docs and config need review.'",
  "Route this task: 'Registry portal layout has accessibility regressions.'",
  "Route this task: 'Unclear owner: mixed app bug + CI + docs mismatch; coordinate core agents and packs.'"
)
$prompts | ForEach-Object { Write-Host ("- {0}" -f $_) }

Write-Host ""
Write-Host "OK"
