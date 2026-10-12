# Sing-box 路由配置

`config.json` 是可直接导入的 sing-box 配置，包含本机 `127.0.0.1:2080` mixed 入站、基础出口、18 个远程规则集和最终出口 `Final`。完整配置的订阅地址是：

```text
https://raw.githubusercontent.com/LJAYi/Tools/main/Singbox/config.json
```

目前没有你的节点信息，因此所有策略组最终都走 `DIRECT`。要让分流走代理，需将你的节点出口加入 `outbounds`，并放入 `Final` 或对应服务选择器。不要在公开仓库提交私人节点凭据。

```text
DIRECT, Apple, BiliBili, Netflix, Disney, YouTube, TikTok, GlobalMedia,
OpenAI, Claude, Gemini, Google, Microsoft, PayPal, Telegram, Steam, Lan,
China, Final
```

BlackMatrix 提供的是 Clash YAML，Sing-box 不能直接读取。`build-rules.py` 会把上游 YAML 转成 Sing-box source JSON，结果写入 `rules/`。配置通过 GitHub raw URL 读取这些转换结果，默认每 24 小时检查更新并缓存；`.github/workflows/singbox-rules.yml` 每天从上游拉取并提交转换结果。此工作流需要仓库 Actions 的写入权限。

Sing-box 原生 rule-set 不支持 Clash 的 `IP-ASN` 规则；转换脚本会明确报告并略过它们。当前涉及 WeChat 1 条、OpenAI 1 条、Telegram 5 条、ChinaMax 1 条。其他上游规则类型已转换并由 Sing-box 编译验证。

```bash
python3 Singbox/build-rules.py
```

也可以手动运行脚本并提交 `Singbox/rules/`。规则顺序与请求中的 18 个规则集一致，最后由 `route.final` 处理未匹配流量。
