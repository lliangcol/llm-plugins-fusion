#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

active_dir="nova-plugin/agents"
archive_dir=".claude/agents/archive"

expected=(
  api-design.md
  build-deps.md
  data-analytics.md
  db-engineer.md
  devops-platform.md
  git-release-manager.md
  incident-responder.md
  java-backend-engineer.md
  orchestrator.md
  quality-engineer.md
  refactoring-specialist.md
  security-audit.md
  security-engineer.md
  test-automator.md
)

echo "== Active agents =="
mapfile -t actual < <(ls -1 "$active_dir"/*.md 2>/dev/null | xargs -n1 basename | sort)
echo "Count: ${#actual[@]}"
printf -- "- %s\n" "${actual[@]}"

if [[ ${#actual[@]} -lt 14 || ${#actual[@]} -gt 18 ]]; then
  echo "ERROR: Active agents count must be 14..18 (got ${#actual[@]})." >&2
  exit 1
fi
if ! printf "%s\n" "${actual[@]}" | grep -qx "orchestrator.md"; then
  echo "ERROR: Missing required agent: orchestrator.md" >&2
  exit 1
fi

missing=()
for e in "${expected[@]}"; do
  if ! printf "%s\n" "${actual[@]}" | grep -qx "$e"; then
    missing+=("$e")
  fi
done
extra=()
for a in "${actual[@]}"; do
  if ! printf "%s\n" "${expected[@]}" | grep -qx "$a"; then
    extra+=("$a")
  fi
done

if [[ ${#missing[@]} -ne 0 || ${#extra[@]} -ne 0 ]]; then
  [[ ${#missing[@]} -ne 0 ]] && { echo "Missing expected:"; printf -- "- %s\n" "${missing[@]}"; }
  [[ ${#extra[@]} -ne 0 ]] && { echo "Unexpected extra:"; printf -- "- %s\n" "${extra[@]}"; }
  echo "ERROR: Active agent set mismatch. Expected exactly the 14-file set." >&2
  exit 1
fi

echo
echo "== Archive presence (should not be default-scanned) =="
if [[ -d "$archive_dir" ]]; then
  arch_count="$(find "$archive_dir" -type f -name "*.md" 2>/dev/null | wc -l | tr -d ' ')"
  echo "Archive md files: $arch_count"
  if [[ "$arch_count" != "0" ]]; then
    echo "NOTE: Archive is outside nova-plugin/agents, but if your Claude Code scans .claude/**, tokens may still be high."
    echo "Mitigation (if needed): rename \`.claude/agents/archive/\` to \`.claude/agents-archive/\` or move it outside the repo."
  fi
else
  echo "Archive directory not found (ok)."
fi

echo
echo "== Manual acceptance checklist =="
echo "1) In Claude Code, run \`/context\` BEFORE and note: Custom agents tokens = ____"
echo "2) Run \`/context\` AFTER and note:  Custom agents tokens = ____"
echo "3) Target: tokens drop >= 50%."

echo
echo "== Routing test prompts (paste into Claude Code) =="
cat <<'EOF'
- Route this task: 'CI pipeline failing after dependency upgrade; lockfile conflicts.'
- Route this task: 'Spring Boot add a new REST endpoint + OpenAPI docs.'
- Route this task: 'Review this PR for security/performance/maintainability; give prioritized findings.'
- Route this task: 'Refactor a legacy module to reduce coupling; keep behavior unchanged.'
- Route this task: 'Add integration tests and fix flaky tests in CI.'
- Route this task: 'Design an API contract: pagination, error schema, versioning.'
- Route this task: 'Production 5xx spike; need mitigation and rollback plan now.'
- Route this task: 'Postgres slow query; propose indexes and explain EXPLAIN plan.'
- Route this task: 'Define KPIs + funnel analysis; propose experiments.'
- Route this task: 'Threat model auth flow; harden secrets/config; OWASP risks.'
- Route this task: 'SOC2-style audit checklist + evidence collection plan.'
- Route this task: 'Deploy pipeline + Docker/K8s config needs cleanup and rollback steps.'
- Route this task: 'Plan release: versioning, tags, changelog, hotfix procedure.'
- Route this task: 'Unclear owner: mixed app bug + CI + data metric mismatch; coordinate specialists.'
EOF

echo
echo "OK"

