// region-auto-direct.js
// 功能：根据“当前出口国家”动态把对应地区策略组切到 DIRECT；不在该国则维持代理
// 触发：建议挂在 [Script] 的 network-changed（启动/换网都会触发）
// 作者：@Helge_007 & Gemini
// 说明：使用第一个成功返回的 GEO API；失败则继续下一个；全失败则保守回退为“走代理”

/* ===================== 可 配 置 区 ===================== */

// 地区映射：键=国家码，值=该国对应的“场景组名”和代理组名
// !!! 重要：这里的 `group` 和 `proxy` 名称必须与你的 Loon 配置中的策略组名完全一致，包括空格和符号！
const MAP = {
  "CN": { group: "大陆场景", direct: "DIRECT", proxy: "大陆时延优选" },
  "HK": { group: "香港场景", direct: "DIRECT", proxy: "香港时延优选" },
  "TW": { group: "台湾场景", direct: "DIRECT", proxy: "台湾时延优选" },
  "JP": { group: "日本场景", direct: "DIRECT", proxy: "日本时延优选" },
  "KR": { group: "韩国场景", direct: "DIRECT", proxy: "韩国时延优选" },
  "SG": { group: "新国场景", direct: "DIRECT", proxy: "新国时延优选" },
  "US": { group: "美国场景", direct: "DIRECT", proxy: "美国时延优选" },
};

// GEO API 地址（顺序尝试，已移除返回格式错误的 API）
const GEO_URLS = [
  "https://ipapi.co/country",       // 返回两字母国家码, e.g., CN
  "https://ifconfig.co/country-iso", // 返回两字母国家码, e.g., CN
  "https://api.country.is"         // [新增] 同样返回两字母国家码，作为备用
];

// 单次请求超时（毫秒）
const TIMEOUT_MS = 3000;

// 探测时强制走的策略（一般用 DIRECT，避免被代理干扰）
const DETECT_POLICY = "DIRECT";

// 是否在“国家变化时”通知
const NOTIFY_ON_CHANGE = true;

// 上次国家缓存 key（用于减少不必要的重复执行和通知）
const PERSIST_KEY_LAST_CC = "RegionAutoDirect:last_cc";

/* ===================== 主 逻 辑 ===================== */

// 检查字符串是否为两字母
function isIso2(s) {
  return typeof s === "string" && /^[A-Z]{2}$/.test(s.trim());
}

// 切换策略组选项（Loon 提供的脚本 API）
function setPolicy(group, target) {
  // 检查当前策略是否已经是目标策略，避免不必要的操作
  if ($config.getSelectPolicy(group) === target) {
    console.log(`RegionAutoDirect: ${group} 当前已是 ${target}，无需切换。`);
    return;
  }

  try {
    if (typeof $config.setSelectPolicy !== "function") {
      $notification.post("脚本错误", "API 不可用", "缺少 $config.setSelectPolicy，请检查 Loon 版本。");
      return;
    }
    const ok = $config.setSelectPolicy(group, target);
    console.log(`RegionAutoDirect: 切换 ${group} → ${target}，结果: ${ok ? '成功' : '失败'}`);
    if (!ok) {
      $notification.post("策略切换失败", `组: ${group} → 目标: ${target}`, "请检查你的策略组名称是否与脚本 MAP 中的配置完全一致。");
    }
  } catch (e) {
    $notification.post("策略切换异常", `组: ${group} → 目标: ${target}`, `异常信息：${e}`);
  }
}

// 根据获取到的国家代码执行地区切换
function applyForCountry(cc) {
  const code = (cc || "").trim().toUpperCase();
  
  if (!isIso2(code)) {
    $notification.post("地区探测失败", "未能获取有效的国家代码", "将回退至全部代理模式。");
    fallbackToProxy();
    return;
  }

  // 读取上次国家，如果无变化则不执行任何操作，减少资源消耗
  const last = $persistentStore.read(PERSIST_KEY_LAST_CC) || "";
  if (code === last) {
    console.log(`RegionAutoDirect: 国家未变化 (${code})，跳过执行。`);
    return;
  }
  
  const changed = last !== ""; // 只有当之前有过记录时，才算“变化”

  // 按照是否在“本地国”决定使用 DIRECT 还是代理
  Object.keys(MAP).forEach(k => {
    const { group, direct, proxy } = MAP[k];
    setPolicy(group, code === k ? direct : proxy);
  });

  if (changed && NOTIFY_ON_CHANGE) {
    $notification.post("出口国家已更新", `${last} → ${code}`, "已根据最新国家位置自动切换各地区策略。");
  } else if (NOTIFY_ON_CHANGE) {
    // 首次运行时也通知一下
    $notification.post("出口国家确认", `当前位于: ${code}`, "已根据当前位置初始化各地区策略。");
  }

  $persistentStore.write(code, PERSIST_KEY_LAST_CC);
}

// 探测失败时的保守回退（全部走代理）
function fallbackToProxy() {
  console.log("RegionAutoDirect: 所有 API 探测失败，回退至全部代理模式。");
  Object.keys(MAP).forEach(k => setPolicy(MAP[k].group, MAP[k].proxy));
}

// 顺序尝试 GEO_URLS，谁先成功用谁的
function probe(urls, i = 0) {
  if (i >= urls.length) {
    console.log("RegionAutoDirect: 已尝试所有 GEO API，均失败。");
    fallbackToProxy();
    return $done();
  }

  const currentUrl = urls[i];
  console.log(`RegionAutoDirect: 尝试第 ${i + 1} 个 API: ${currentUrl}`);

  $httpClient.get({ url: currentUrl, timeout: TIMEOUT_MS, policy: DETECT_POLICY }, (err, resp, data) => {
    if (err || resp.status !== 200 || !data) {
      console.log(`RegionAutoDirect: API ${currentUrl} 请求失败。错误: ${err || `HTTP Status ${resp.status}`}`);
      // 继续尝试下一个
      probe(urls, i + 1);
      return;
    }
    
    const cc = data.trim().toUpperCase();
    if (isIso2(cc)) {
      console.log(`RegionAutoDirect: 从 ${currentUrl} 成功获取国家代码: ${cc}`);
      applyForCountry(cc);
      return $done();
    } else {
      console.log(`RegionAutoDirect: 从 ${currentUrl} 获取的数据格式不正确: "${data}"`);
      // 继续尝试下一个
      probe(urls, i + 1);
    }
  });
}

// 脚本入口
console.log("RegionAutoDirect: 脚本启动，开始探测出口国家...");
probe(GEO_URLS);
