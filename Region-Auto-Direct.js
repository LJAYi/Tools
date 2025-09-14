// region-auto-direct.js
// Date: 2025-09-14 11:46:!2
// Author: LJAYi

const MAP = {
  CN:{group:"大陆场景", direct:"DIRECT", proxy:"大陆时延优选"},
  HK:{group:"香港场景", direct:"DIRECT", proxy:"香港时延优选"},
  TW:{group:"台湾场景", direct:"DIRECT", proxy:"台湾时延优选"},
  JP:{group:"日本场景", direct:"DIRECT", proxy:"日本时延优选"},
  KR:{group:"韩国场景", direct:"DIRECT", proxy:"韩国时延优选"},
  SG:{group:"新国场景", direct:"DIRECT", proxy:"新国时延优选"},
  US:{group:"美国场景", direct:"DIRECT", proxy:"美国时延优选"},
};

const URLS = [
  "https://ipapi.co/country",
  "https://ifconfig.co/country-iso",
//  "https://api.country.is"
];

const T=3000, NODE="DIRECT", KEY="RegionAutoDirect:last_cc";
const KEYS = Object.keys(MAP);

const sel=g=>{try{
  if(typeof $config.getSelectedPolicy==="function") return $config.getSelectedPolicy(g)||"";
  if(typeof $config.getPolicy==="function")         return $config.getPolicy(g)||"";
}catch{} return "";};

const note=(title, lines)=>$notification.post("Region Auto Direct", title||"", (lines&&lines.length)?lines.join("\n"):"");

const subsCache = Object.create(null);
function getSubs(name, cb){
  if(name in subsCache){ return cb(subsCache[name]); }
  try{
    if(typeof $config.getSubPolicies!=="function"){ subsCache[name]=undefined; return cb(undefined); }
    $config.getSubPolicies(name, subs=>{
      subsCache[name]=subs;
      cb(subs);
    });
  }catch{
    subsCache[name]=undefined;
    cb(undefined);
  }
}
function isEmptySubs(subs){
  if (Array.isArray(subs)) return subs.length===0;
  if (typeof subs==="string") {
    const s=subs.trim();
    if (s==="[]") return true;
    if (s[0]==="[" && s[s.length-1]==="]") {
      try { const arr=JSON.parse(s); return Array.isArray(arr)&&arr.length===0; } catch {}
    }
  }
  return false;
}

function doSwitch(groupName,targetName,errs){
  const cur=sel(groupName);
  if(cur===targetName){ console.log(`[SKIP] ${groupName} 已是 ${targetName}`); return; }
  let ok=false;
  if(typeof $config.setSelectPolicy==="function"){
    ok=$config.setSelectPolicy(groupName,targetName);
    if(!ok) ok=(sel(groupName)===targetName);
  }else ok=(sel(groupName)===targetName);
  if(!ok){ errs.push(`${groupName} → ${targetName} 失败`); console.log(`[FAIL] ${groupName} → ${targetName}`); }
  else    { console.log(`[OK]   ${groupName} → ${targetName}`); }
}

function wantSwitch(groupName, targetName, errs, done){
  const cur=sel(groupName);
  if (targetName==="DIRECT"){ doSwitch(groupName,targetName,errs); return done(); }
  if (cur && cur!=="DIRECT"){ console.log(`[SKIP] ${groupName} 已是代理(${cur})，不切到 ${targetName}`); return done(); }
  getSubs(targetName, subs=>{
    if (isEmptySubs(subs)){ console.log(`[SKIP] 目标组 ${targetName} 候选为空，保持 ${groupName}=${cur||"DIRECT"}`); return done(); }
    doSwitch(groupName,targetName,errs); done();
  });
}

function runForAll(targetResolver, after){
  const errs=[]; let left=KEYS.length;
  const next=()=>{ if(--left===0) after(errs); };
  for (const k of KEYS){
    const {group,direct,proxy}=MAP[k];
    const target = targetResolver(k, direct, proxy);
    wantSwitch(group, target, errs, next);
  }
}

function align(cc, done){
  const last=$persistentStore.read(KEY)||"";
  console.log(`对齐：${last?last+" → ":""}${cc}`);
  runForAll((k,direct,proxy)=> (k===cc?direct:proxy), errs=>{
    if(!last||cc!==last){ note(last?`${last} → ${cc}`:cc, errs); $persistentStore.write(cc,KEY); }
    done();
  });
}

function allProxy(label, done){
  console.log(`回退：${label}`);
  runForAll((k,direct,proxy)=> proxy, errs=>{
    note(label, errs);
    done();
  });
}

(function run(){
  console.log("并发 GEO 探测…");
  let taken=false, left=URLS.length;
  const allFail=()=>{
    if(!taken && --left<=0){
      console.log("全部失败 → Direct Failed");
      allProxy("Direct Failed", ()=>$done());
    }
  };
  for (const u of URLS){
    console.log(`请求 ${u}`);
    $httpClient.get({url:u, timeout:T, policy:NODE, node:NODE}, (e,r,d)=>{
      if(taken) return;
      if(!e && r && r.status===200 && d){
        const cc=String(d).trim().toUpperCase();
        if(!cc){ allFail(); return; }
        if (MAP[cc]){ taken=true; console.log(`命中 MAP：${cc}`); align(cc, ()=>$done()); }
        else        { taken=true; console.log(`不在 MAP：${cc} → ${cc} Proxy`); allProxy(`${cc} Proxy`, ()=>$done()); }
        return;
      }
      console.log(`失败：${u} → ${e||("HTTP "+(r&&r.status))}`); allFail();
    });
  }
})();
