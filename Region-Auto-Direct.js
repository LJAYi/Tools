// region-auto-direct.js
// 功能：根据“当前出口国家”动态把对应地区策略组切到 DIRECT；不在该国则维持该地区代理
// 触发：建议挂在 [Script] 的 network-changed（启动/换网都会触发）
// 说明：使用第一个成功返回的 GEO API；失败则继续下一个；全失败则保守回退为“走代理”

/* ===================== 可 配 置 区 ===================== */

// 地区映射：键=国家码，值=该国对应的“地区优选策略组名”
const MAP = {
  "CN": { group: "大陆场景", direct: "DIRECT", proxy: "大陆时延优选" },
  "HK": { group: "香港场景", direct: "DIRECT", proxy: "香港时延优选" },
  "TW": { group: "台湾场景", direct: "DIRECT", proxy: "台湾时延优选" },
  "JP": { group: "日本场景", direct: "DIRECT", proxy: "日本时延优选" },
  "KR": { group: "韩国场景", direct: "DIRECT", proxy: "韩国时延优选" },
  "SG": { group: "新国场景", direct: "DIRECT", proxy: "新国时延优选" },
  "US": { group: "美国场景", direct: "DIRECT", proxy: "美国时延优选" },
};

const GEO_URLS = [
  "https://ipapi.co/country/",
  "https://ifconfig.co/country-iso",
  "https://ip.sb/country"
];

// 单次请求超时（毫秒）
const TIMEOUT_MS = 2500;

// 探测时强制走的策略
const DETECT_POLICY = "DIRECT";

// 是否在“国家变化时”通知
const NOTIFY_ON_CHANGE = true;

// 上次国家缓存 key（用于降噪）
const PERSIST_KEY_LAST_CC = "RegionAutoDirect:last_cc";

/* ===================== 主 逻 辑 ===================== */

function isIso2(s) {
  return typeof s === "string" && /^[A-Za-z]{2}$/.test(s.trim());
}

// 切换策略组选项（Loon 提供的脚本 API）
function setPolicy(group, target) {
  try {
    const ok = $config.getConfig(group, target); // 选择策略组项
    if (!ok) $notification.post("RegionAutoDirect", `${group} → ${target}`, "应用失败");
  } catch (e) {
    $notification.post("RegionAutoDirect", `${group} → ${target}`, `异常：${e}`);
  }
}

// 执行地区切换
function applyForCountry(cc) {
  const code = (cc || "").trim().toUpperCase();

  // 读取上次国家，避免频繁弹通知与重复切换
  const last = $persistentStore.read(PERSIST_KEY_LAST_CC) || "";
  const changed = code && code !== last;

  // 依据是否在“本地国”决定 DIRECT/代理
  Object.keys(MAP).forEach(k => {
    const { group, direct, proxy } = MAP[k];
    setPolicy(group, code === k ? direct : proxy);
  });

  if (changed && NOTIFY_ON_CHANGE) {
    $notification.post("当前出口国家已更新", `${last || "未知"} → ${code}`, "已根据国家切换各地区策略");
  }
  if (code) $persistentStore.write(code, PERSIST_KEY_LAST_CC);
}

// 探测失败时的保守回退（全部走代理）
function fallbackToProxy() {
  Object.keys(MAP).forEach(k => setPolicy(MAP[k].group, MAP[k].proxy));
}

// 顺序尝试 GEO_URLS，谁先成功用谁的
function probe(urls, i = 0) {
  if (i >= urls.length) { fallbackToProxy(); return $done(); }

  $httpClient.get({ url: urls[i], timeout: TIMEOUT_MS, policy: DETECT_POLICY }, (err, resp, data) => {
    const ok = !err && resp && resp.status === 200 && typeof data === "string";
    const cc = ok ? data.trim().toUpperCase() : "";

    if (ok && isIso2(cc)) {
      applyForCountry(cc);
      return $done();
    }
    // 继续下一个
    probe(urls, i + 1);
  });
}

probe(GEO_URLS);
