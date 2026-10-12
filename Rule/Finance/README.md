# Finance rules

`Rule/Finance/` is the source directory for financial routing rules. Each institution has its own `.list` and can use its own policy.

| Directory | Contents |
| --- | --- |
| `USBanks/` | US banks and card issuers |
| `USBrokerages/` | US brokerages; shared market data is separate |
| `USCredit/` | Credit bureaus and report services |
| `HKBanks/` | HSBC, HSBC Reward+, CNCBI |
| `IntlBanks/` | N26 and future non-US/HK banks |
| `Payments/` | Zelle and Plaid |

`USBanks/USBanks.list`, `USBrokerages/USBrokerages.list`, `USCredit/USCredit.list`, and `Finance.list` are generated aggregates. Place institution rules before any aggregate to preserve individual routing.

Example Loon and Shadowrocket URLs:

```text
https://raw.githubusercontent.com/LJAYi/Tools/main/Rule/Finance/USBanks/Chase.list
https://raw.githubusercontent.com/LJAYi/Tools/main/Rule/Finance/USBrokerages/Fidelity.list
https://raw.githubusercontent.com/LJAYi/Tools/main/Rule/Finance/USCredit/TransUnion.list
https://raw.githubusercontent.com/LJAYi/Tools/main/Rule/Finance/HKBanks/HSBC.list
https://raw.githubusercontent.com/LJAYi/Tools/main/Rule/Finance/Payments/Zelle.list
```

After editing a source file, run `scripts/build-us-finance.sh` and `scripts/check-us-finance.sh`.

`Rule/Mihomo/` has not yet been migrated to this layout.
