// region-auto-direct.debug.js
// 作用：按“出口国家”把对应场景组切到 DIRECT，其他地区切回各自的“时延优选”。
// 版本：Debug Fix v2  — 针对 setSelectPolicy 返回 false 的情况，增加“策略组就绪等待 + 重试 +详细日志”。
// 触发：network-changed（启动 / 切网 会触发）。
// 适配：Loon 3.3.3（若你是旧版，API 可能不同）。

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

const GEO_URLS = [
  "https://ipapi.co/country",         // e.g. HK
  "https://ifconfig.co/country-iso",  // e.g. HK
  "https://api.country.is",           // {"ip":"x.x.x.x","country":"HK"}
];

const TIMEOUT_MS   = 3000;      // 单次请求超时
const DETECT_NODE  = "DIRECT";  // 探测走直连，避免被代理污染
const NOTIFY       = true;      // 国家变化时通知（首次也会提示）
const KEY_LAST_CC  = "RegionAutoDirect:last_cc";

// 等待策略组“就绪”的重试参数（解决：脚本在策略组尚未完全装载前就运行导致 setSelectPolicy 失败）
const WAIT_TOTAL_TRIES = 10;    // 最多重试次数
const WAIT_INTERVAL_MS = 500;   // 每次间隔（毫秒）

/* ===================== 工 具 函 数 ===================== */
function isIso2(s){ return typeof s === 'string' && /^[A-Z]{2}$/.test(String(s).trim()); }

function parseMaybeJson(ccRaw){
  try { const o = JSON.parse(ccRaw); return o && typeof o.country === 'string' ? o.country.toUpperCase() : ''; }
  catch { return ''; }
}

function getSelectedSafe(group){
  try {
    if (typeof $config.getSelectedPolicy === 'function') {
      // 若策略组不存在，某些版本会返回 undefined / null
      return $config.getSelectedPolicy(group);
    }
  } catch(e) {
    console.log(`RegionAutoDirect: 读取当前子项异常 (${group}) → ${e}`);
  }
  return undefined;
}

function groupReady(){
  // 所有 MAP 中的 group 都能被读取到“当前选中项”（不一定有值，但不是 undefined）视为就绪
  return Object.values(MAP).every(({group}) => typeof getSelectedSafe(group) !== 'undefined');
}

function waitPoliciesReady(tries = WAIT_TOTAL_TRIES){
  if (groupReady()) return Promise.resolve(true);
  if (tries <= 0)   return Promise.resolve(false);
  return new Promise(res => setTimeout(res, WAIT_INTERVAL_MS))
    .then(() => waitPoliciesReady(tries - 1));
}

function setPolicy(group, target){
  try {
    // 幂等：如果当前就是目标，直接跳过
    const cur = getSelectedSafe(group);
    if (cur === target) { console.log(`RegionAutoDirect: ${group} 已是 ${target}，跳过`); return true; }

    if (typeof $config.setSelectPolicy !== 'function'){
      $notification.post('RegionAutoDirect', 'API 不可用', '缺少 $config.setSelectPolicy（请检查 Loon 版本）');
      return false;
    }
    const ok = $config.setSelectPolicy(group, target);
    console.log(`RegionAutoDirect: 切换 ${group} → ${target}：${ok ? '成功' : '失败'}`);
    if (!ok) {
      // 提示最常见的三类原因：1) 组名不匹配；2) 子项名不在该组内；3) 组尚未完全装载
      $notification.post('策略切换失败', `${group} → ${target}`, '可能原因：名称不匹配 / 目标子项不在该组 / 组尚未装载');
    }
    return ok;
  } catch (e){
    $notification.post('策略切换异常', `${group} → ${target}`, String(e));
    return false;
  }
}

function applyForCountry(cc){
  const code = String(cc || '').trim().toUpperCase();
  if (!isIso2(code)) {
    $notification.post('地区探测失败', '未获取到有效国家码', '已回退到各地区代理');
    return fallbackToProxy();
  }

  const last = $persistentStore.read(KEY_LAST_CC) || '';
  const changed = last && code !== last;

  // ★ 每次都对齐策略（幂等）
  Object.keys(MAP).forEach(k => {
    const { group, direct, proxy } = MAP[k];
    setPolicy(group, code === k ? direct : proxy);
  });

  if (NOTIFY) {
    if (!last) $notification.post('出口国家确认', `当前：${code}`, '已根据当前位置初始化各地区策略');
    else if (changed) $notification.post('出口国家已更新', `${last} → ${code}`, '已按新位置切换各地区策略');
  }
  $persistentStore.write(code, KEY_LAST_CC);
}

function fallbackToProxy(){
  console.log('RegionAutoDirect: API 失败或国家无效 → 回退为各地区代理');
  Object.keys(MAP).forEach(k => setPolicy(MAP[k].group, MAP[k].proxy));
}

function probe(urls, i = 0){
  if (i >= urls.length) { fallbackToProxy(); return $done(); }
  const url = urls[i];
  console.log(`RegionAutoDirect: 尝试第 ${i + 1} 个 API：${url}`);

  $httpClient.get({ url, timeout: TIMEOUT_MS, policy: DETECT_NODE }, (err, resp, data) => {
    const ok = !err && resp && resp.status === 200 && data;
    if (!ok) {
      console.log(`RegionAutoDirect: 失败：${url} → ${err ? err : 'HTTP ' + (resp && resp.status)}`);
      return probe(urls, i + 1);
    }
    let cc = String(data).trim();
    if (url.includes('api.country.is')) cc = parseMaybeJson(cc);

    if (isIso2(cc)) { console.log(`RegionAutoDirect: 成功获取国家码：${cc}`); applyForCountry(cc); return $done(); }
    console.log(`RegionAutoDirect: 数据格式不符（${url}）：${String(data).slice(0,80)}...`);
    return probe(urls, i + 1);
  });
}

/* ===================== 脚 本 入 口 ===================== */
console.log('RegionAutoDirect: 脚本启动，等待策略组装载…');
waitPoliciesReady().then(ready => {
  if (!ready){
    console.log('RegionAutoDirect: 策略组似乎尚未完全装载（超过等待上限）— 仍继续探测，但切组可能失败');
    $notification.post('RegionAutoDirect 警告', '策略组加载超时', '切换操作可能失败，请检查配置或手动切换');
  } else {
    console.log('RegionAutoDirect: 策略组已就绪，开始探测出口国家…');
  }
  probe(GEO_URLS);
  // 在 probe 结束后，$done 会被调用，此处无需再调用
});

