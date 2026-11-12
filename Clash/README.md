# Clash / Mihomo 配置

另有 [Loon_Configuration.yaml](Loon_Configuration.yaml)：由仓库 Loon 配置转换，包含地区场景、自动策略和金融分流，详见 [转换说明](Loon_Configuration.md)。

公开模板：

```text
https://raw.githubusercontent.com/LJAYi/Tools/main/Clash/Clash.yaml
```

配置只包含基础设置、19 个远程规则集、对应策略组和 `MATCH,Final`，不包含节点、订阅地址或订阅占位符。规则集来自 `blackmatrix7/ios_rule_script`，每 24 小时更新。

WeChat 使用 [WeChat_No_Resolve.yaml](https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/WeChat/WeChat_No_Resolve.yaml)，绑定独立 `WeChat` 策略组，默认 `DIRECT`，可选择 `Proxy` 或具体节点。GitHub 使用 [GitHub_No_Resolve.yaml](https://fastly.jsdelivr.net/gh/blackmatrix7/ios_rule_script@master/rule/Clash/GitHub/GitHub_No_Resolve.yaml)，绑定独立 `GitHub` 策略组，优先于 Microsoft 和 ChinaMax 匹配。BlackMatrix 的 [GitHub 来源说明](https://github.com/blackmatrix7/ios_rule_script/blob/master/rule/Clash/GitHub/README.md)列出了 ACL4SSR 和 LM-Firefly 的上游规则；该规则集也覆盖 npm、GitHub Pages 和 Copilot 等域名。

`Proxy` 是统一节点选择组。各服务策略组都包含 `Proxy`、`DIRECT`，并通过 Mihomo 的 `include-all: true` 自动纳入本地配置中的节点和 provider 节点，因此既能跟随 `Proxy`，也能单独选择节点。

当前没有配置节点，所以 `Proxy` 暂时只有 `DIRECT`。在客户端本地合并节点或订阅 provider 后，节点会自动出现在这些组中。此功能需要 Clash.Meta / Mihomo 内核。
