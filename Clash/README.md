# Clash / Mihomo 配置

公开模板：

```text
https://raw.githubusercontent.com/LJAYi/Tools/main/Clash/Clash.yaml
```

配置只包含基础设置、18 个远程规则集、对应策略组和 `MATCH,Final`，不包含节点、订阅地址或订阅占位符。规则集来自 `blackmatrix7/ios_rule_script`，每 24 小时更新。

`Proxy` 是统一节点选择组。各服务策略组都包含 `Proxy`、`DIRECT`，并通过 Mihomo 的 `include-all: true` 自动纳入本地配置中的节点和 provider 节点，因此既能跟随 `Proxy`，也能单独选择节点。

当前没有配置节点，所以 `Proxy` 暂时只有 `DIRECT`。在客户端本地合并节点或订阅 provider 后，节点会自动出现在这些组中。此功能需要 Clash.Meta / Mihomo 内核。
