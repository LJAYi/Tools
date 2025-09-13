// region-auto-direct.js
// 功能：根据当前出口国家，自动将对应地区的策略组切换到 DIRECT。
// 版本：Final Fix v8 — 将 setPolicy 逻辑内联到主循环，以规避函数调用问题。
// 触发：建议用于 network-changed 事件。
// 作者：@Helge_007 & Gemini

/* ===================== 可配置区域 ===================== */
// !!! 重要提示 !!!
// 下方 'group' 和 'proxy' 的中文名称必须与您在 Loon 中的策略组名称完全一致。
const MAP = {
  CN: { group: "大陆场景", direct: "DIRECT",     proxy: "大陆时延优选" },
  HK: { group: "香港场景", direct: "DIRECT",     proxy: "香港时延优选" },
  TW: { group: "台湾场景", direct: "DIRECT",     proxy: "台湾时延优选" },
  JP: { group: "日本场景", direct: "DIRECT",     proxy: "日本时延优选" },
  KR: { group: "韩国场景", direct: "DIRECT",     proxy: "韩国时延优选" },
  SG: { group: "新国场景", direct: "DIRECT",     proxy: "新国时延优选" },
  US: { group: "美国场景", direct: "DIRECT",     proxy: "美国时延优选" },
};

const GEO_URLS = [
  "https://ipapi.co/country",         // 例如 HK
  "https://ifconfig.co/country-iso",  // 例如 HK
  "https://api.country.is",           // {"ip":"x.x.x.x","country":"HK"}
];

const TIMEOUT_MS   = 3000;      // 请求超时
const DETECT_NODE  = "DIRECT";  // 使用 DIRECT 进行探测
const NOTIFY       = true;      // 国家变化时发送通知
const KEY_LAST_CC  = "RegionAutoDirect:last_cc";

const WAIT_TOTAL_TRIES = 10;    // 等待策略组就绪的最大重试次数
const WAIT_INTERVAL_MS = 500;   // 重试间隔（毫秒）

/* ===================== 工具函数 ===================== */
function isIso2(s){ return typeof s === 'string' && /^[A-Z]{2}$/.test(String(s).trim()); }

function parseMaybeJson(ccRaw){
  try { const o = JSON.parse(ccRaw); return o && typeof o.country === 'string' ? o.country.toUpperCase() : ''; }
  catch { return ''; }
}

function getSelectedSafe(group){
  try {
    return typeof $config.getSelectedPolicy === 'function' ? $config.getSelectedPolicy(group) : undefined;
  } catch(e) {
    console.log(`RegionAutoDirect: [警告] 读取策略组 (${group}) 的当前选中策略时出错 -> ${e}`);
  }
  return undefined;
}

function groupReady(){
  return Object.values(MAP).every(({group}) => typeof getSelectedSafe(group) !== 'undefined');
}

function waitPoliciesReady(tries = WAIT_TOTAL_TRIES){
  if (groupReady()) return Promise.resolve(true);
  if (tries <= 0)   return Promise.resolve(false);
  return new Promise(res => setTimeout(res, WAIT_INTERVAL_MS)).then(() => waitPoliciesReady(tries - 1));
}

function applyForCountry(cc){
  const code = String(cc || '').trim().toUpperCase();
  if (!isIso2(code)) {
    $notification.post('区域探测失败', '未能获取有效的国家代码。', '已回退为所有地区均使用代理。');
    return fallbackToProxy();
  }

  const last = $persistentStore.read(KEY_LAST_CC) || '';
  const changed = last && code !== last;

  console.log("RegionAutoDirect: 即将开始遍历 MAP 并直接在循环内设置策略...");
  
  // 将 setPolicy 的逻辑直接内联到循环中
  for (const k of Object.keys(MAP)) {
    const { group, direct, proxy } = MAP[k];
    const target = (code === k) ? direct : proxy;
    
    console.log(`RegionAutoDirect: 正在处理 "${group}"，目标是 "${target}"`);

    try {
      const cur = getSelectedSafe(group);
      if (cur === target) {
        console.log(`RegionAutoDirect: "${group}" 已是 "${target}"，跳过。`);
        continue; // 跳到下一个循环
      }

      if (typeof $config.setSelectPolicy !== 'function'){
        $notification.post('RegionAutoDirect', 'API 不可用', '缺少 $config.setSelectPolicy');
        continue;
      }

      const availablePolicies = $config.getPolicies(group) || [];
      console.log(`RegionAutoDirect: [诊断] "${group}" 内可用子策略: [${availablePolicies.join(', ')}]`);

      if (!availablePolicies.includes(target)) {
        console.log(`RegionAutoDirect: [错误] 目标 "${target}" 不存在于 "${group}" 中！`);
        $notification.post('切换失败：名称不匹配', `找不到目标 "${target}"`, `请检查策略组 "${group}" 的配置。`);
        continue;
      }

      const ok = $config.setSelectPolicy(group, target);
      console.log(`RegionAutoDirect: 切换 "${group}" -> "${target}": ${ok ? '成功' : '失败'}`);
      if (!ok) {
        $notification.post('切换失败', `"${group}" -> "${target}"`, 'Loon 拒绝了操作，请检查名称。');
      }
    } catch (e) {
      $notification.post('切换异常', `"${group}" -> "${target}"`, String(e));
    }
  }

  console.log("RegionAutoDirect: MAP 遍历和策略设置完成。");
  if (NOTIFY) {
    if (!last) $notification.post('出口国家已探测', `当前: ${code}`, '已根据您的位置设置策略。');
    else if (changed) $notification.post('出口国家已变更', `${last} -> ${code}`, '策略已更新。');
  }
  $persistentStore.write(code, KEY_LAST_CC);
}

function fallbackToProxy(){
  console.log('RegionAutoDirect: 执行回退：将所有地区设为代理策略。');
  for (const k of Object.keys(MAP)) {
     const { group, proxy } = MAP[k];
     try {
       $config.setSelectPolicy(group, proxy);
     } catch(e) {
       // fallback 失败时不再打扰用户
       console.log(`RegionAutoDirect: [回退失败] ${group} -> ${proxy}`);
     }
  };
}

function probe(urls, i = 0){
  if (i >= urls.length) { 
    fallbackToProxy();
    setTimeout(() => $done(), 500);
    return;
  }
  const url = urls[i];
  console.log(`RegionAutoDirect: 正在尝试 API #${i + 1}: ${url}`);

  $httpClient.get({ url, timeout: TIMEOUT_MS, policy: DETECT_NODE }, (err, resp, data) => {
    if (!err && resp && resp.status === 200 && data) {
      let cc = String(data).trim();
      if (url.includes('api.country.is')) cc = parseMaybeJson(cc);

      if (isIso2(cc)) {
        console.log(`RegionAutoDirect: 成功获取国家代码: ${cc}`);
        applyForCountry(cc);
        setTimeout(() => {
            console.log("RegionAutoDirect: 脚本已在延迟后结束。");
            $done();
        }, 500);
        return;
      }
    }
    probe(urls, i + 1);
  });
}

/* ===================== 脚本入口点 ===================== */
console.log('RegionAutoDirect: 脚本启动，正在等待策略组就绪...');
waitPoliciesReady().then(ready => {
  if (!ready){
    $notification.post('RegionAutoDirect 警告', '策略组加载超时。', '切换可能会失败，请检查配置。');
    probe(GEO_URLS);
  } else {
    console.log('RegionAutoDirect: 策略组已就绪，开始探测国家...');
    probe(GEO_URLS);
  }
});

