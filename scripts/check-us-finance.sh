#!/bin/sh
set -eu

repo_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
finance_dir="$repo_dir/Rule/Finance"

find "$finance_dir" -mindepth 2 -type f -name '*.list' -print |
  LC_ALL=C sort |
  while IFS= read -r file; do
  awk -F, '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ { next }
    ($1 != "DOMAIN" && $1 != "DOMAIN-SUFFIX" && $1 != "DOMAIN-KEYWORD" && $1 != "IP-ASN") || NF != 2 || $2 !~ /^[A-Za-z0-9._-]+$/ {
      print FILENAME ":" FNR ": invalid rule: " $0 > "/dev/stderr"
      failed = 1
    }
    seen[$0]++ { print FILENAME ":" FNR ": duplicate rule: " $0 > "/dev/stderr"; failed = 1 }
    END { exit failed }
  ' "$file"
  done

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/finance-check.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM
for aggregate in USBanks USBrokerages USCredit Finance; do
  case "$aggregate" in
    USBanks) aggregate_file="$finance_dir/USBanks/USBanks.list" ;;
    USBrokerages) aggregate_file="$finance_dir/USBrokerages/USBrokerages.list" ;;
    USCredit) aggregate_file="$finance_dir/USCredit/USCredit.list" ;;
    Finance) aggregate_file="$finance_dir/Finance.list" ;;
  esac
  cp "$aggregate_file" "$tmp_dir/$aggregate.list"
done
"$repo_dir/scripts/build-us-finance.sh" >/dev/null
for aggregate in USBanks USBrokerages USCredit Finance; do
  case "$aggregate" in
    USBanks) aggregate_file="$finance_dir/USBanks/USBanks.list" ;;
    USBrokerages) aggregate_file="$finance_dir/USBrokerages/USBrokerages.list" ;;
    USCredit) aggregate_file="$finance_dir/USCredit/USCredit.list" ;;
    Finance) aggregate_file="$finance_dir/Finance.list" ;;
  esac
  cmp -s "$tmp_dir/$aggregate.list" "$aggregate_file" || {
    printf '%s\n' "$aggregate.list was not reproducible." >&2
    exit 1
  }
done

printf '%s\n' 'Finance rule checks passed.'
