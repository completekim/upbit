// node test-wirye-fuel.mjs [oilnow_html_dir] — extracts the DOM-free modules from the page and checks them.
import fs from "node:fs"; import vm from "node:vm"; import assert from "node:assert/strict";
const html = fs.readFileSync(new URL("./wirye-fuel.html", import.meta.url), "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
new vm.Script(js); // syntax
const mods = js.slice(0, js.indexOf("/* ===================== 5."));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(mods + ";globalThis.out={Calc,Oilnow,STATIONS,DEFAULT_CARDS};", ctx);
const {Calc, Oilnow, STATIONS, DEFAULT_CARDS} = ctx.out;
const card = o => ({eligible:true, brand:"ALL", fuel:"ALL", type:"perLiter", basis:"actual", value:100, reference:null, remaining:null, cap:null, ...o});
const B = Calc.benefit; let n = 0; const t = (a, b, m) => { assert.equal(Math.round(a*1000)/1000, b, m); n++; };
t(B(1800, 40, "SOL", "B027", card({brand:"SOL", value:80})), 3200, "SOL 80원×40L");
t(B(1800, 40, "SKE", "B027", card({brand:"SOL", value:80})), 0, "정유사 불일치");
t(B(1800, 40, "SKE", "B027", card({eligible:false})), 0, "실적 미충족");
t(B(1800, 40, "SKE", "D047", card({fuel:"B027"})), 0, "유종 불일치");
t(B(1800, 40, "SKE", "B027", card({remaining:0})), 0, "잔여 한도 0");
t(B(1800, 40, "SKE", "B027", card({remaining:1500})), 1500, "월 잔여 한도");
t(B(1800, 40, "SKE", "B027", card({cap:2000})), 2000, "건당 한도");
t(B(1800, 40, "SKE", "B027", card({basis:"reference", reference:null})), 0, "기준가 없음");
t(B(1800, 40, "SKE", "B027", card({basis:"reference", reference:2000})), 3600, "기준가 환산 72000/2000×100");
t(B(1800, 40, "SKE", "B027", card({type:"percent", value:5})), 3600, "5%");
t(B(1800, 1, "SKE", "B027", card({value:5000})), 1800, "결제금액 초과 금지");
// SK 120 vs SOL 80: SOL wins only if pre-discount gap > 40
const cards = DEFAULT_CARDS();
const st = (no, brand, price) => ({no, id:"X"+no, brand, prices:{B027:{price, source:"manual", at:"2026-10-11T00:00:00Z"}}});
let r = Calc.rank([st(1,"SKE",1850), st(2,"SOL",1809)], cards, "B027", 40);
t(r.rows[0].station.no, 2, "SOL 41원 쌈 → SOL"); t(r.rows[0].eff, 1729, "SOL 실질 1729");
r = Calc.rank([st(1,"SKE",1850), st(2,"SOL",1811)], cards, "B027", 40);
t(r.rows[0].station.no, 1, "SOL 39원 쌈 → SK"); t(r.rows[0].eff, 1730, "SK 실질 1730");
r = Calc.rank([st(1,"SKE",1850), {no:2,id:"X2",brand:"SOL",prices:{D047:{price:1700,source:"manual",at:"x"}}}], cards, "B027", 40);
t(r.rows.length, 1, "다른 유종 가격 재사용 금지"); t(r.missing.length, 1, "미입력 집계");
t(Calc.rank([st(1,"SKE",1850)], [], "B027", 40).rows[0].net, 74000, "카드 없이 비교");
t(Math.round(Calc.distanceKm({lat:37.475372,lon:127.127533},{lat:37.475427,lon:127.128572})*1000), 92, "남성대-위례드림 ≈92m");
// parser on real pages
const dir = process.argv[2];
if (dir){
  for (const s of STATIONS){
    const h = fs.readFileSync(`${dir}/oil_${s.id}.html`, "utf8");
    const wrapped = {executionId:"x", outputs:{tool_output:{statusCode:200, headers:[{name:"date", value:"Sun, 11 Oct 2026 06:56:07 GMT"}], data:h}}, status:1};
    for (const payload of [wrapped, {result:wrapped}, JSON.stringify(wrapped)]){
      const u = Oilnow.unwrap(payload); assert.equal(u.status, 200); assert.equal(u.date, "2026-10-11T06:56:07.000Z");
      const p = Oilnow.parse(u.html, s); assert.ok(p.prices.B027 && p.prices.D047, s.id);
      if (payload === wrapped) console.log(s.no, s.id, p.name, "|", p.address, "|", JSON.stringify(p.prices));
    }
    n++;
    const other = STATIONS.find(o => o.id !== s.id && o.addrKey !== s.addrKey);
    assert.throws(() => Oilnow.parse(h, other), e => e.code === "MISMATCH"); n++;
  }
  // 송파대로 3 must not match 송파대로 30
  assert.throws(() => Oilnow.parse(fs.readFileSync(`${dir}/oil_A0010021.html`,"utf8").replace("송파대로 3\"", "송파대로 30\""), STATIONS[1]), e => e.code === "MISMATCH"); n++;
}
console.log("ok", n, "checks");
