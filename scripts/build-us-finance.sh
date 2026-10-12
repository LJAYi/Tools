#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
finance_dir="$repo_dir/Rule/Finance"

build_list() {
  output=$1
  shift
  tmp_file=$(mktemp "${TMPDIR:-/tmp}/finance-list.XXXXXX")
  {
    printf '# GENERATED: scripts/build-us-finance.sh\n\n'
    for category do
      find "$finance_dir/$category" -type f -name '*.list' \
        ! -name 'USBanks.list' ! -name 'USBrokerages.list' \
        ! -name 'USCredit.list' ! -name 'Finance.list' -print |
        LC_ALL=C sort |
        while IFS= read -r file; do
          awk 'NF && $0 !~ /^#/ { print }' "$file"
        done
    done
  } | awk '/^#/ || NF == 0 { print; next } !seen[$0]++ { print }' > "$tmp_file"
  mv "$tmp_file" "$finance_dir/$output"
  printf 'Built %s\n' "$finance_dir/$output"
}

build_list USBanks/USBanks.list USBanks
build_list USBrokerages/USBrokerages.list USBrokerages
build_list USCredit/USCredit.list USCredit
build_list Finance.list USBanks USBrokerages USCredit HKBanks IntlBanks Payments
