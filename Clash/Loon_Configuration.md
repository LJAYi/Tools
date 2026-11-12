# Loon 配置的 Mihomo 版

文件：`Loon_Configuration.yaml`。基于仓库的 `Loon/Loon_Configuration.lcf` 转换，需使用 Clash.Meta / Mihomo 内核。

```text
https://raw.githubusercontent.com/LJAYi/Tools/main/Clash/Loon_Configuration.yaml
```

- 保留大陆、香港、台湾、日本、韩国、新加坡、美国、全球场景，以及时延优选、故障转移、负载均衡和金融机构独立策略。
- `Proxy` 汇总本地节点；手动策略组可选择原来的场景、`Proxy` 或具体节点。地区节点和自动策略通过 `include-all`、`filter`、`exclude-filter` 筛选节点。
- 不包含订阅或节点占位符。需在客户端本地合并节点或 provider；空节点池不能用于代理访问。规则每 24 小时更新。
- 应用规则用 BlackMatrix 对应 Clash YAML 替换 Kelee Loon 规则，覆盖范围不完全相同。`AI` 拆为 OpenAI、Claude、Gemini；`AppleAccount` 对应 AppleID；国际测速对应 Speedtest；LAN 和大陆区域对应 Lan 和 ChinaMax。
- 金融规则直接使用仓库的原始 `.list`，Mihomo 按 `format: text` 读取。金融规则置于应用和大陆大类规则之前，HSBC Reward+ 仍先于 HSBC，防止广泛规则盖住专用分流。
- Loon 的正则含前后查找，已改成地区匹配加排除匹配；节点名匹配可能略有差异。PCC 负载均衡近似为 `consistent-hashing`，不是完全相同的算法。
- 保留本机 HTTP 7222、SOCKS 7221，并提供 mixed 7890；采用 DoH DNS 和 TLS/HTTP 嗅探。TUN 可在客户端按需启用；Loon 的系统 DNS、bypass-tun 和 DNS 防泄漏插件没有直接等价移植。
- Loon 的插件、签到脚本、网络变化脚本、Rewrite 和 MITM 不在此配置中运行。

修改 Loon 配置后可重新生成，并用 Mihomo 检查：

```bash
ruby scripts/build-loon-clash.rb
mihomo -t -f Clash/Loon_Configuration.yaml
```
