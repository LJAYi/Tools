# Shadowrocket 配置

`Shadowrocket.conf` 由仓库中的 Loon 配置转换而来，保留地区场景、时延优选、故障转移、负载均衡以及服务分流。

## 使用方法

1. 先在 Shadowrocket 中添加并更新你的节点订阅。
2. 下载 `Shadowrocket.conf`，在 Shadowrocket 的“配置”页面导入并启用。
3. 打开配置详情，检查“代理分组”中的各地区节点是否成功匹配。
4. 如果机场节点命名比较特殊，请修改对应分组的 `policy-regex-filter`。

## 金融分流

配置中的 Chase、Capital One、Amex、Bank of America、Citi、Discover、Wells Fargo、US Bank、PNC、Truist、Zelle、各家券商和三大征信机构都是独立规则与独立策略组。它们默认继承“美国金融”，因此日常只需调整一个总入口；需要时也可以单独将某家机构切换为 `DIRECT`、美国场景或其他场景。

不要同时加入 `Finance.list`、`USBrokerages/USBrokerages.list` 或 `USCredit/USCredit.list` 等聚合规则，否则排在前面的聚合规则会覆盖逐家设置。更多可按需添加的机构 URL 见 `Rule/Finance/README.md`。

配置不会保存订阅地址、账号或节点凭据。地区分组会从 Shadowrocket 当前已有节点中自动筛选。

Loon 专属的插件和网络变化脚本没有加入本配置。无忧行签到脚本也不属于代理分流，因此继续单独维护。
