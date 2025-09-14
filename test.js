// Loon 参数测试
console.log("原始参数: " + $argument);

let params = {};
($argument || '').split(/[,&\n ]+/).filter(Boolean).forEach(p => {
  let i = p.indexOf('=');
  if (i > 0) {
    let k = p.slice(0, i).trim();
    let v = p.slice(i + 1).trim();
    params[k] = v;
  }
});

console.log("解析结果: " + JSON.stringify(params, null, 2));

$done();
