# Loon 配置的 Mihomo 版

文件：`Loon_Configuration.yaml`。基于仓库的 `Loon/Loon_Configuration.lcf` 转换，需使用 Clash.Meta / Mihomo 内核。

```text
https://raw.githubusercontent.com/LJAYi/Tools/main/Clash/Loon_Configuration.yaml
```

- 策略组依次排列场景选择、时延优选、故障转移，再保留负载均衡和兜底策略；各部分地区按美国、大陆、香港、日本、新国排列，另保留全球场景。
- `场景选择` 为总选择入口，包含各地区场景、`DIRECT` 和本地节点。地区场景包含对应地区的具体节点、自动策略和 `DIRECT`；通过 `include-all`、`filter`、`exclude-filter` 筛选节点，不额外生成地区节点策略组。
- 不包含订阅或节点占位符。需在客户端本地合并节点或 provider；空节点池不能用于代理访问。规则每 24 小时更新。
- 应用规则用 BlackMatrix 对应 Clash YAML 替换 Kelee Loon 规则，覆盖范围不完全相同。`AI` 拆为 OpenAI、Claude、Gemini；`AppleAccount` 对应 AppleID；国际测速对应 Speedtest；LAN 和大陆区域对应 Lan 和 ChinaMax。
- 金融机构只作为独立规则集，不生成机构策略组；全部金融规则默认指向 `DIRECT`。金融规则直接使用仓库的原始 `.list`，Mihomo 按 `format: text` 读取，置于应用和大陆大类规则之前；HSBC Reward+ 仍先于 HSBC。
- Loon 的正则含前后查找，已改成地区匹配加排除匹配；节点名匹配可能略有差异。PCC 负载均衡近似为 `consistent-hashing`，不是完全相同的算法。
- 保留本机 HTTP 7222、SOCKS 7221，并提供 mixed 7890；采用 DoH DNS 和 TLS/HTTP 嗅探。TUN 可在客户端按需启用；Loon 的系统 DNS、bypass-tun 和 DNS 防泄漏插件没有直接等价移植。
- Loon 的插件、签到脚本、网络变化脚本、Rewrite 和 MITM 不在此配置中运行。

修改 Loon 配置后可重新生成，并用 Mihomo 检查：

```bash
ruby scripts/build-loon-clash.rb
mihomo -t -f Clash/Loon_Configuration.yaml
```
