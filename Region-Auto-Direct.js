// region-auto-direct.js
// Date: 2025-09-14 01:58:24
// Author: LJAYi

const MAP = {
  CN:{group:"大陆场景", direct:"DIRECT",      proxy:"大陆时延优选"},
  HK:{group:"香港场景", direct:"DIRECT",      proxy:"香港时延优选"},
  TW:{group:"台湾场景", direct:"DIRECT",      proxy:"台湾时延优选"},
  JP:{group:"日本场景", direct:"DIRECT",      proxy:"日本时延优选"},
  KR:{group:"韩国场景", direct:"DIRECT",      proxy:"韩国时延优选"},
  SG:{group:"新国场景", direct:"DIRECT",      proxy:"新国时延优选"},
  US:{group:"美国场景", direct:"DIRECT",      proxy:"美国时延优选"},
};

const URLS = [
  "https://ipapi.co/country",
  "https://ifconfig.co/country-iso",
//  "https://api.country.is"
];

const T=3000, NODE="DIRECT", KEY="RegionAutoDirect:last_cc";

const sel=g=>{try{
  if(typeof $config.getSelectedPolicy==="function")return $config.getSelectedPolicy(g)||"";
  if(typeof $config.getPolicy==="function")return $config.getPolicy(g)||"";
}catch{} return "";};

const note=(line,errs)=>$notification.post("Region Auto Direct", line||"", (errs&&errs.length)?errs.join("\n"):"");

function set(g,t,errs){
  try{
    const cur=sel(g);
    if (t!=="DIRECT"){
      if (cur && cur!=="DIRECT"){ console.log(`[SKIP] ${g} 已是代理 (${cur})，不切到 ${t}`); return true; }
      try{
        if (typeof $config.getSubPolicys==="function"){
          const tgtSubs=$config.getSubPolicys(t);
          if (Array.isArray(tgtSubs) && tgtSubs.length===0){
            console.log(`[SKIP] 目标组 ${t} 候选为空，跳过`);
            return true;
          }
        }
      }catch{}
    }
    if(cur===t){ console.log(`[SKIP] ${g} 已是 ${t}`); return true; }
    let ok=false;
    if(typeof $config.setSelectPolicy==="function"){
      ok=$config.setSelectPolicy(g,t);
      if(!ok){ const after=sel(g); ok=(after===t); }
    }else{ ok=(sel(g)===t); }
    if(!ok){ errs.push(`${g} → ${t} 失败`); console.log(`[FAIL] ${g} → ${t}`); }
    else    { console.log(`[OK]   ${g} → ${t}`); }
    return ok;
  }catch(e){ errs.push(`${g} → ${t} 异常: ${e}`); console.log(`[ERR] ${g} → ${t} | ${e}`); return false; }
}

function align(cc){
  const last=$persistentStore.read(KEY)||"", errs=[];
  console.log(`对齐：${last?last+" → ":""}${cc}`);
  for(const k in MAP){ const {group,direct,proxy}=MAP[k]; set(group, k===cc?direct:proxy, errs); }
  if(!last||cc!==last){ note(last?`${last} → ${cc}`:cc, errs); $persistentStore.write(cc, KEY); }
}

function allProxy(label){
  const errs=[]; console.log(`回退：${label}`);
  for(const k in MAP){ const {group,proxy}=MAP[k]; set(group, proxy, errs); }
  note(label, errs);
}

(function run(){
  console.log("并发 GEO 探测…");
  let done=false, left=URLS.length;
  const finish=()=>{ if(!done && --left<=0){ console.log("全部失败 → Direct Failed"); allProxy("Direct Failed"); $done(); } };

  for(const u of URLS){
    console.log(`请求 ${u}`);
    $httpClient.get({url:u, timeout:T, policy:NODE, node:NODE}, (e,r,d)=>{
      if(done) return;
      if(!e && r && r.status===200 && d){
        const cc=String(d).trim().toUpperCase();
        if(!cc){ finish(); return; }
        if(MAP[cc]){ done=true; console.log(`命中 MAP：${cc}`); align(cc); return $done(); }
        else       { done=true; console.log(`不在 MAP：${cc} → ${cc} Proxy`); allProxy(`${cc} Proxy`); return $done(); }
      }
      console.log(`失败：${u} → ${e || ("HTTP "+(r&&r.status))}`); finish();
    });
  }
})();
