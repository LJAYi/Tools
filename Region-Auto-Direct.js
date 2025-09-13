// region-auto-direct.js
// 功能：根据“当前出口国家”动态把对应地区策略组切到 DIRECT；不在该国则切回该地区的时延优选
// 触发：挂在 [Script] 的 network-changed（启动/换网都会触发）
// 作者：@Helge_007 & Gemini（整合修复）
// 说明：顺序尝试多个 GEO API；首个成功即用；全部失败则保守回退到“全部代理”。
// 重要：MAP 里的组名/子项名必须与 [Proxy Group] 完全一致（含空格/符号/简繁体）。

/* ===================== 可 配 置 区 ===================== */

const MAP = {
  CN: { group: "大陆场景", direct: "DIRECT",     proxy: "大陆时延优选" },
  HK: { group: "香港场景", direct: "DIRECT",     proxy: "香港时延优选" },
  TW: { group: "台湾场景", direct: "DIRECT",     proxy: "台湾时延优选" },
  JP: { group: "日本场景", direct: "DIRECT",     proxy: "日本时延优选" },
  KR: { group: "韩国场景", direct: "DIRECT",     proxy: "韩国时延优选" },
  SG: { group: "新国场景", direct: "DIRECT",     proxy: "新国时延优选" },
  US: { group: "美国场景", direct: "DIRECT",     proxy: "美国时延优选" },
};

// GEO API（返回两字母 ISO 国家码）。按顺序依次尝试：
const GEO_URLS = [
  "https://ipapi.co/country",        // 例如：HK
  "https://ifconfig.co/country-iso", // 例如：HK
  "https://api.country.is",          // 例如：{"ip":"x.x.x.x","country":"HK"}
];

// 单次请求超时（毫秒）
const TIMEOUT_MS = 3000;

// 探测请求的出站节点/策略（建议 DIRECT，避免代理污染出口国判断）
const DETECT_NODE = "DIRECT";

// 是否在“国家变化时”通知（首次成功探测也会提示一次）
const NOTIFY_ON_CHANGE = true;

// 持久化键：上次国家
const KEY_LAST_CC = "RegionAutoDirect:last_cc";

/* ===================== 主 逻 辑 ===================== */

function isIso2(s) { return typeof s === "string" && /^[A-Z]{2}$/.test(String(s).trim()); }

// 切组（幂等）：当前已是目标则跳过，避免多余切换
function setPolicy(group, target) {
  try {
    const cur = (typeof $config.getSelectedPolicy === "function")
      ? ($config.getSelectedPolicy(group) || "")
      : "";
    if (cur === target) {
      console.log(`RegionAutoDirect: ${group} 已是 ${target}，跳过`);
      return;
    }
    if (typeof $config.setSelectPolicy !== "function") {
      $notification.post("RegionAutoDirect", "API 不可用", "缺少 $config.setSelectPolicy（请检查 Loon 版本）");
      return;
    }
    const ok = $config.setSelectPolicy(group, target);
    console.log(`RegionAutoDirect: 切换 ${group} → ${target}：${ok ? "成功" : "失败"}`);
    if (!ok) $notification.post("策略切换失败", `${group} → ${target}`, "请核对组名/子项是否与配置一致");
  } catch (e) {
    $notification.post("策略切换异常", `${group} → ${target}`, String(e));
  }
}

// 应用当前国家：本地国场景= DIRECT，其它场景= 各自“时延优选”
function applyForCountry(cc) {
  const code = String(cc || "").trim().toUpperCase();
  if (!isIso2(code)) {
    $notification.post("地区探测失败", "未获取到有效国家码", "已回退为全部代理");
    return fallbackToProxy();
  }

  const last = $persistentStore.read(KEY_LAST_CC) || "";
  const changed = last && code !== last;

  // ★ 每次都对齐策略（幂等），不要因为国家未变而直接 return
  Object.keys(MAP).forEach(k => {
    const { group, direct, proxy } = MAP[k];
    setPolicy(group, code === k ? direct : proxy);
  });

  if (NOTIFY_ON_CHANGE) {
    if (!last) $notification.post("出口国家确认", `当前：${code}`, "已根据当前位置初始化各地区策略");
    else if (changed) $notification.post("出口国家已更新", `${last} → ${code}`, "已按新位置切换各地区策略");
  }
  $persistentStore.write(code, KEY_LAST_CC);
}

// 全部走代理（安全回退）
function fallbackToProxy() {
  console.log("RegionAutoDirect: 全部 API 失败或国家无效 → 回退到各地区代理");
  Object.keys(MAP).forEach(k => setPolicy(MAP[k].group, MAP[k].proxy));
}

// 解析第三个 API（api.country.is）的返回
function parseMaybeJson(ccRaw) {
  try {
    const obj = JSON.parse(ccRaw);
    return typeof obj?.country === "string" ? obj.country.toUpperCase() : "";
  } catch { return ""; }
}

// 依次探测 GEO_API
function probe(urls, i = 0) {
  if (i >= urls.length) { fallbackToProxy(); return $done(); }
  const url = urls[i];
  console.log(`RegionAutoDirect: 尝试第 ${i + 1} 个 API：${url}`);

  $httpClient.get({ url, timeout: TIMEOUT_MS, node: DETECT_NODE }, (err, resp, data) => {
    const ok = !err && resp && resp.status === 200 && data;
    if (!ok) {
      console.log(`RegionAutoDirect: 失败：${url} → ${err ? err : "HTTP " + (resp && resp.status)}`);
      return probe(urls, i + 1);
    }

    let cc = String(data).trim();
    // 第 3 个 API 返回 JSON，需要额外解析
    if (url.includes("api.country.is")) cc = parseMaybeJson(cc);

    if (isIso2(cc)) {
      console.log(`RegionAutoDirect: 成功获取国家码：${cc}`);
      applyForCountry(cc);
      return $done();
    } else {
      console.log(`RegionAutoDirect: 数据格式不符（${url}）：${String(data).slice(0, 80)}...`);
      return probe(urls, i + 1);
    }
  });
}

console.log("RegionAutoDirect: 脚本启动，开始探测出口国家…");
probe(GEO_URLS);
