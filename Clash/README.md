# Clash / Mihomo 配置

公开模板：

```text
https://raw.githubusercontent.com/LJAYi/Tools/main/Clash/Clash.yaml
```

模板包含一个订阅 provider、18 个远程规则集和 `MATCH,Final`。规则集来自 `blackmatrix7/ios_rule_script`，每 24 小时更新。

订阅地址不要写进公开仓库。先下载模板为本地私密文件：

```bash
cp Clash/Clash.yaml Clash/Clash.local.yaml
```

然后只在 `Clash.local.yaml` 中替换：

```yaml
proxy-providers:
  Subscription:
    url: 你的订阅地址
```

`Clash.local.yaml` 已被 Git 忽略。订阅节点每小时更新，远程规则每 24 小时更新。如果客户端支持覆写或扩展配置，也可以在客户端本地覆写 `Subscription.url`，继续远程订阅公开模板。
