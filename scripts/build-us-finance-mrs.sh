#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
rule_dir="$repo_dir/Rule"
output_dir="$rule_dir/Mihomo"
mihomo_bin=${MIHOMO_BIN:-}

if [ -z "$mihomo_bin" ]; then
  mihomo_bin=$(command -v mihomo || true)
fi
if [ -z "$mihomo_bin" ] || [ ! -x "$mihomo_bin" ]; then
  printf '%s\n' 'mihomo was not found. Install it or set MIHOMO_BIN=/path/to/mihomo.' >&2
  exit 1
fi

mkdir -p "$output_dir/USFinance"
tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/us-finance-mrs.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

build_mrs() {
  input=$1
  output=$2
  relative=${input#"$rule_dir/"}
  payload="$tmp_dir/${relative%.list}.txt"

  mkdir -p "$(dirname "$payload")" "$(dirname "$output")"

  awk -F, '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    $1 == "DOMAIN-SUFFIX" { print "+." $2; next }
    $1 == "DOMAIN" { print $2; next }
    { print "Unsupported rule: " $0 > "/dev/stderr"; failed = 1 }
    END { exit failed }
  ' "$input" > "$payload"

  "$mihomo_bin" convert-ruleset domain text "$payload" "$output"
  printf 'Built %s\n' "$output"
}

# Primary interface: one independently assignable MRS per institution.
find "$rule_dir/USFinance" -type f -name '*.list' -print |
  LC_ALL=C sort |
  while IFS= read -r input; do
    relative=${input#"$rule_dir/"}
    build_mrs "$input" "$output_dir/${relative%.list}.mrs"
  done

# Backward-compatible optional aggregates.
for name in USFinanceBanks USFinanceBrokerage USCreditBureaus USFinance; do
  build_mrs "$rule_dir/$name.list" "$output_dir/$name.mrs"
done
