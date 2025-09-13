// region-auto-direct.debug.js
// 作用：按“出口国家”把对应场景组切到 DIRECT，其他地区切回各自的“时延优选”。
// 版本：Debug Fix v3 — 增加“子策略存在性检查”，精准定位名称不匹配问题。
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

// 等待策略组“就绪”的重试参数
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
    return typeof $config.getSelectedPolicy === 'function' ? $config.getSelectedPolicy(group) : undefined;
  } catch(e) {
    console.log(`RegionAutoDirect: [警告] 读取当前选中项异常 (${group}) → ${e}`);
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

function setPolicy(group, target){
  try {
    const cur = getSelectedSafe(group);
    if (cur === target) { console.log(`RegionAutoDirect: ${group} 已是 ${target}，跳过`); return true; }

    if (typeof $config.setSelectPolicy !== 'function'){
      $notification.post('RegionAutoDirect', 'API 不可用', '缺少 $config.setSelectPolicy（请检查 Loon 版本）');
      return false;
    }

    // --- 诊断核心 ---
    const availablePolicies = $config.getPolicies(group) || [];
    console.log(`RegionAutoDirect: [诊断] 组 "${group}" 内可用子策略: [${availablePolicies.join(', ')}]`);

    if (!availablePolicies.includes(target)) {
      console.log(`RegionAutoDirect: [错误] 目标 "${target}" 不存在于组 "${group}" 的可用子策略中!`);
      $notification.post(
        '策略切换失败：名称不匹配',
        `目标 "${target}" 不存在`,
        `请检查策略组 "${group}" 的配置，脚本需要的目标子策略不在其中。`
      );
      return false;
    }
    // --- 诊断结束 ---

    const ok = $config.setSelectPolicy(group, target);
    console.log(`RegionAutoDirect: 切换 ${group} → ${target}：${ok ? '成功' : '失败'}`);
    if (!ok) {
      $notification.post('策略切换失败', `${group} → ${target}`, 'Loon 拒绝了此操作，请再次核对名称并检查配置。');
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
    if (!err && resp && resp.status === 200 && data) {
      let cc = String(data).trim();
      if (url.includes('api.country.is')) cc = parseMaybeJson(cc);

      if (isIso2(cc)) { console.log(`RegionAutoDirect: 成功获取国家码：${cc}`); applyForCountry(cc); return $done(); }
    }
    probe(urls, i + 1);
  });
}

/* ===================== 脚 本 入 口 ===================== */
console.log('RegionAutoDirect: 脚本启动，等待策略组装载…');
waitPoliciesReady().then(ready => {
  if (!ready){
    $notification.post('RegionAutoDirect 警告', '策略组加载超时', '切换操作可能失败，请检查配置或手动切换');
  } else {
    console.log('RegionAutoDirect: 策略组已就绪，开始探测出口国家…');
  }
  probe(GEO_URLS);
});
```

### 如何使用和排查：

1.  **替换脚本**：用上面的新代码完整替换掉你当前的脚本。
2.  **触发脚本**：手动运行一次脚本，或者切换一下网络（例如开关飞行模式）。
3.  **查看日志（关键步骤）**：
    * 打开 Loon 的脚本日志。
    * 你会看到类似下面这样的 `[诊断]` 信息：
        ```
        RegionAutoDirect: [诊断] 组 "大陆场景" 内可用子策略: [DIRECT, 大陆延迟最低, 备用节点]
        

