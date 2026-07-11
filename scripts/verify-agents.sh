#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

active_dir="nova-plugin/agents"
retired_surface_dirs=(
  ".claude/agents"
  "docs/reports"
  "nova-plugin/docs/history"
)

expected=(
  architect.md
  builder.md
  orchestrator.md
  publisher.md
  reviewer.md
  verifier.md
)

required_sections=(
  "Do:"
  "Don't:"
  "Use when:"
  "Workflow:"
  "Output:"
  "Pack hints:"
)

array_contains() {
  local needle="$1"
  shift
  local item
  for item in "$@"; do
    if [[ "$item" == "$needle" ]]; then
      return 0
    fi
  done
  return 1
}

echo "== Active agents =="
actual=()
while IFS= read -r file_name; do
  actual+=("$file_name")
done < <(find "$active_dir" -maxdepth 1 -type f -name "*.md" -exec basename {} \; 2>/dev/null | LC_ALL=C sort)
echo "Count: ${#actual[@]}"
printf -- "- %s\n" "${actual[@]}"

if [[ ${#actual[@]} -ne 6 ]]; then
  echo "ERROR: Active agents count must be exactly 6 (got ${#actual[@]})." >&2
  exit 1
fi
if ! array_contains "orchestrator.md" "${actual[@]}"; then
  echo "ERROR: Missing required agent: orchestrator.md" >&2
  exit 1
fi

missing=()
for e in "${expected[@]}"; do
  if ! array_contains "$e" "${actual[@]}"; then
    missing+=("$e")
  fi
done
extra=()
for a in "${actual[@]}"; do
  if ! array_contains "$a" "${expected[@]}"; then
    extra+=("$a")
  fi
done

if [[ ${#missing[@]} -ne 0 || ${#extra[@]} -ne 0 ]]; then
  [[ ${#missing[@]} -ne 0 ]] && { echo "Missing expected:"; printf -- "- %s\n" "${missing[@]}"; }
  [[ ${#extra[@]} -ne 0 ]] && { echo "Unexpected extra:"; printf -- "- %s\n" "${extra[@]}"; }
  echo "ERROR: Active agent set mismatch. Expected exactly the 6 core-agent files." >&2
  exit 1
fi

echo
echo "== Agent contract =="
for file_name in "${actual[@]}"; do
  file_path="$active_dir/$file_name"
  IFS= read -r first_line < "$file_path"
  first_line="${first_line%$'\r'}"
  if [[ "$first_line" != "---" ]]; then
    echo "ERROR: $file_name is missing YAML frontmatter." >&2
    exit 1
  fi
  frontmatter="$(awk '{sub(/\r$/, "")} NR==1 && $0=="---"{in_fm=1; next} in_fm && $0=="---"{exit} in_fm{print}' "$file_path")"
  for field in name description tools; do
    if ! grep -Eq "^${field}:[[:space:]]*[^[:space:]]" <<< "$frontmatter"; then
      echo "ERROR: $file_name frontmatter missing required field: $field" >&2
      exit 1
    fi
  done
  name_value="$(sed -n 's/^name:[[:space:]]*//p' <<< "$frontmatter")"
  expected_name="${file_name%.md}"
  if [[ "$name_value" != "$expected_name" ]]; then
    echo "ERROR: $file_name frontmatter name must equal basename '$expected_name'." >&2
    exit 1
  fi
  body="$(awk 'BEGIN{delims=0} {sub(/\r$/, "")} /^---$/{delims++; next} delims>=2{print}' "$file_path")"
  for section in "${required_sections[@]}"; do
    if ! grep -Fq "$section" <<< "$body"; then
      echo "ERROR: $file_name body missing required label: $section" >&2
      exit 1
    fi
  done
  echo "- $file_name: ok"
done

echo
echo "== Retired active-agent surfaces =="
for retired_dir in "${retired_surface_dirs[@]}"; do
  if [[ -e "$retired_dir" ]]; then
    echo "ERROR: Retired active-agent path must not exist in the current public surface: $retired_dir" >&2
    echo "Active agents live only in nova-plugin/agents; do not recreate retired archive/history paths without a documented policy change." >&2
    exit 1
  fi
  echo "- $retired_dir: absent (ok)"
done

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
- Route this task: 'Threat model auth flow; harden secrets/config; OWASP risks.'
- Route this task: 'Plan release: versioning, tags, changelog, hotfix procedure.'
- Route this task: 'Marketplace schema validation failed after metadata edits.'
- Route this task: 'MCP server setup docs and config need review.'
- Route this task: 'Host-project registry UI layout has accessibility regressions.'
- Route this task: 'Unclear owner: mixed app bug + CI + docs mismatch; coordinate core agents and packs.'
EOF

echo
echo "OK"
