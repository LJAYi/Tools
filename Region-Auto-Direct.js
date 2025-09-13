// region-auto-direct.js
// Function: Automatically switch policy groups to DIRECT based on the current egress country.
// Version: Debug Fix v4 — All comments and logs are in English to prevent file encoding issues.
// Trigger: Recommended for network-changed event.
// Author: @Helge_007 & Gemini

/* ===================== CONFIGURATION ===================== */
// !!! IMPORTANT !!!
// The Chinese names for 'group' and 'proxy' below MUST EXACTLY match your policy group names in Loon.
// These are the ONLY parts of the script that should contain non-English characters.
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

const TIMEOUT_MS   = 3000;      // Request timeout
const DETECT_NODE  = "DIRECT";  // Use DIRECT for detection to avoid proxy interference
const NOTIFY       = true;      // Notify on country change
const KEY_LAST_CC  = "RegionAutoDirect:last_cc";

// Parameters for waiting for policies to be ready
const WAIT_TOTAL_TRIES = 10;    // Max retries
const WAIT_INTERVAL_MS = 500;   // Interval between retries (ms)

/* ===================== UTILITY FUNCTIONS ===================== */
function isIso2(s){ return typeof s === 'string' && /^[A-Z]{2}$/.test(String(s).trim()); }

function parseMaybeJson(ccRaw){
  try { const o = JSON.parse(ccRaw); return o && typeof o.country === 'string' ? o.country.toUpperCase() : ''; }
  catch { return ''; }
}

function getSelectedSafe(group){
  try {
    return typeof $config.getSelectedPolicy === 'function' ? $config.getSelectedPolicy(group) : undefined;
  } catch(e) {
    console.log(`RegionAutoDirect: [WARNING] Error reading selected policy for (${group}) -> ${e}`);
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
    if (cur === target) { console.log(`RegionAutoDirect: Group "${group}" is already set to "${target}", skipping.`); return true; }

    if (typeof $config.setSelectPolicy !== 'function'){
      $notification.post('RegionAutoDirect', 'API Unavailable', 'Missing $config.setSelectPolicy. Please check your Loon version.');
      return false;
    }

    // --- Diagnostic Core ---
    const availablePolicies = $config.getPolicies(group) || [];
    console.log(`RegionAutoDirect: [DIAGNOSTIC] Policies available in group "${group}": [${availablePolicies.join(', ')}]`);

    if (!availablePolicies.includes(target)) {
      console.log(`RegionAutoDirect: [ERROR] Target policy "${target}" does not exist in group "${group}"!`);
      $notification.post(
        'Policy Switch Failed: Name Mismatch',
        `Target "${target}" not found`,
        `Please check the configuration for group "${group}".`
      );
      return false;
    }
    // --- End Diagnostic ---

    const ok = $config.setSelectPolicy(group, target);
    console.log(`RegionAutoDirect: Switching "${group}" -> "${target}": ${ok ? 'SUCCESS' : 'FAILED'}`);
    if (!ok) {
      $notification.post('Policy Switch Failed', `"${group}" -> "${target}"`, 'Loon rejected the operation. Please double-check names and config.');
    }
    return ok;
  } catch (e){
    $notification.post('Policy Switch Exception', `"${group}" -> "${target}"`, String(e));
    return false;
  }
}

function applyForCountry(cc){
  const code = String(cc || '').trim().toUpperCase();
  if (!isIso2(code)) {
    $notification.post('Region Detection Failed', 'Could not get a valid country code.', 'Falling back to proxy for all regions.');
    return fallbackToProxy();
  }

  const last = $persistentStore.read(KEY_LAST_CC) || '';
  const changed = last && code !== last;

  Object.keys(MAP).forEach(k => {
    const { group, direct, proxy } = MAP[k];
    setPolicy(group, code === k ? direct : proxy);
  });

  if (NOTIFY) {
    if (!last) $notification.post('Egress Country Detected', `Current: ${code}`, 'Policies have been set according to your location.');
    else if (changed) $notification.post('Egress Country Changed', `${last} -> ${code}`, 'Policies have been updated.');
  }
  $persistentStore.write(code, KEY_LAST_CC);
}

function fallbackToProxy(){
  console.log('RegionAutoDirect: Fallback: setting all region groups to their respective proxy policies.');
  Object.keys(MAP).forEach(k => setPolicy(MAP[k].group, MAP[k].proxy));
}

function probe(urls, i = 0){
  if (i >= urls.length) { fallbackToProxy(); return $done(); }
  const url = urls[i];
  console.log(`RegionAutoDirect: Probing API #${i + 1}: ${url}`);

  $httpClient.get({ url, timeout: TIMEOUT_MS, policy: DETECT_NODE }, (err, resp, data) => {
    if (!err && resp && resp.status === 200 && data) {
      let cc = String(data).trim();
      if (url.includes('api.country.is')) cc = parseMaybeJson(cc);

      if (isIso2(cc)) {
        console.log(`RegionAutoDirect: Successfully got country code: ${cc}`);
        applyForCountry(cc);
        return $done();
      }
    }
    probe(urls, i + 1);
  });
}

/* ===================== SCRIPT ENTRY POINT ===================== */
console.log('RegionAutoDirect: Script starting, waiting for policy groups to be ready...');
waitPoliciesReady().then(ready => {
  if (!ready){
    $notification.post('RegionAutoDirect WARNING', 'Policy groups took too long to load.', 'Switching may fail. Please check your config or switch manually.');
  } else {
    console.log('RegionAutoDirect: Policy groups are ready. Starting country detection...');
  }
  probe(GEO_URLS);
});

