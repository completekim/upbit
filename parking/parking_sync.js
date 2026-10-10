/* 주차 BT 로그 반영 — 시동 꺼짐(BT 끊김)부터 다음 시동 켜짐(BT 연결)까지를 주차 1건으로 만든다.
 * 같은 코드가 두 곳에서 돈다: 주차 아티팩트 페이지(열 때 즉시 반영)와 Claude 루틴(node로 실행).
 * 로그 한 줄: YYYY-MM-DD,H:MM,OFF|ON[,위도,경도]  (MacroDroid 매크로 「주차 BT 기록」이 쓴다, 시각은 KST)
 */
(function (root) {
  'use strict';
  var DEBOUNCE_MS = 3 * 60 * 1000;   // 꺼짐→켜짐이 이보다 짧으면 신호가 잠깐 끊긴 것으로 보고 버린다
  var MERGE_MS = 20 * 60 * 1000;     // 이 안에 시작한 기존 기록(수동 입력 포함)이 있으면 새로 만들지 않고 합친다
  var PLACE_R = 200;
  var LONG_MS = 24 * 3600 * 1000;
  var SILENT_MS = 96 * 3600 * 1000;  // 이만큼 BT 이벤트가 없으면 로그 끊김으로 본다

  function num(v) { var n = Number(String(v == null ? '' : v).trim()); return String(v == null ? '' : v).trim() !== '' && isFinite(n) ? n : null; }

  // KST 날짜·시각 → epoch ms. 날짜는 Y-M-D 계열(구분자 무관), 시각은 H:MM 또는 H:MM:SS.
  function kstMs(dateStr, timeStr) {
    var d = String(dateStr).match(/(\d{4})\D+(\d{1,2})\D+(\d{1,2})/);
    var t = String(timeStr).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!d || !t) return null;
    var ms = Date.UTC(+d[1], +d[2] - 1, +d[3], +t[1] - 9, +t[2], t[3] ? +t[3] : 0);
    return isFinite(ms) ? ms : null;
  }

  function parseLog(text) {
    var out = [], seen = {};
    String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).forEach(function (line) {
      var c = line.split(',');
      if (c.length < 3) return;
      var ev = String(c[2]).trim().toUpperCase();
      if (ev !== 'OFF' && ev !== 'ON') return;
      var ms = kstMs(c[0], c[1]);
      if (ms == null) return;
      var lat = num(c[3]), lng = num(c[4]);
      if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) { lat = null; lng = null; }
      var k = ms + ev;
      if (seen[k]) { if (lat != null && seen[k].lat == null) { seen[k].lat = lat; seen[k].lng = lng; } return; }
      seen[k] = { ms: ms, ev: ev, lat: lat, lng: lng };
      out.push(seen[k]);
    });
    // 같은 분에 켜짐·꺼짐이 같이 찍히면 켜짐을 먼저 둔다(지난 주차를 닫고 새 주차를 연다)
    out.sort(function (a, b) { return a.ms - b.ms || (a.ev === 'ON' ? -1 : 1) - (b.ev === 'ON' ? -1 : 1); });
    return out;
  }

  function distM(aLat, aLng, bLat, bLng) {
    var r = Math.PI / 180, dLat = (bLat - aLat) * r, dLng = (bLng - aLng) * r;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(aLat * r) * Math.cos(bLat * r) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * 6371000 * Math.asin(Math.min(1, Math.sqrt(s)));
  }
  function matchPlace(places, lat, lng) {
    if (lat == null || lng == null) return null;
    var best = null;
    (places || []).forEach(function (p) {
      if (p.lat == null || p.lng == null) return;
      var d = distM(lat, lng, p.lat, p.lng);
      if (d <= (p.radius || PLACE_R) && (!best || d < best.d)) best = { p: p, d: d };
    });
    return best;
  }
  function estFee(ms, rate10) { if (!rate10) return null; return Math.ceil(Math.floor(ms / 60000) / 10) * rate10; }

  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  /**
   * events: parseLog 결과. docs: 현재 parkings 문서(id 포함). places: 장소 문서. state: {lastEventMs}.
   * 돌려주는 값: { changed: {id: doc}, state, report: [문자열] } — changed의 문서를 그대로 set 하면 된다.
   */
  function reconcile(events, docs, places, state, now) {
    var work = {}, changed = {}, report = [];
    (docs || []).forEach(function (d) { work[d.id] = clone(d); });
    var last = (state && state.lastEventMs) || 0;
    var evs = events.filter(function (e) { return e.ms > last; });

    function put(d) { work[d.id] = d; changed[d.id] = d; }
    function openDoc() {
      var a = null;
      Object.keys(work).forEach(function (k) { var d = work[k]; if (d.endMs == null && (!a || d.startMs > a.startMs)) a = d; });
      return a;
    }
    // 같은 주차로 볼 기록: 시작이 ±20분 안이고, 아직 다른 BT 꺼짐에 묶이지 않았고, 이 시각에 끝나 있지 않은 것
    function nearStart(ms) {
      var best = null;
      Object.keys(work).forEach(function (k) {
        var d = work[k], g = Math.abs(d.startMs - ms);
        if (g > MERGE_MS) return;
        if (d.btStartMs != null && d.btStartMs !== ms) return;
        if (d.endMs != null && d.endMs <= ms) return;
        if (!best || g < best.g) best = { d: d, g: g };
      });
      return best && best.d;
    }
    function applyPlace(d, lat, lng) {
      if (d.placeId) return;
      var hit = matchPlace(places, lat, lng);
      if (!hit) return;
      d.placeId = hit.p.id; d.place = hit.p.name; d.longOk = !!hit.p.home; d.placeDist = Math.round(hit.d);
      if (!d.spot && hit.p.spot) d.spot = hit.p.spot;
      if (d.rate10 == null && hit.p.rate10) d.rate10 = hit.p.rate10;
    }
    function close(d, ms, exact) {
      d.endMs = ms;
      if (d.fee == null && d.rate10) d.fee = estFee(ms - d.startMs, d.rate10);
      if (exact) { d.btEndMs = ms; delete d.autoClosed; } else d.autoClosed = true;
      put(d);
    }

    for (var i = 0; i < evs.length; i++) {
      var e = evs[i], nxt = evs[i + 1];
      if (e.ev === 'OFF') {
        if (nxt && nxt.ev === 'ON' && nxt.ms - e.ms < DEBOUNCE_MS) { report.push('짧은 끊김 무시 ' + fmt(e.ms)); last = nxt.ms; i++; continue; }
        if (!nxt && now - e.ms < DEBOUNCE_MS) { report.push('대기(3분 미만) ' + fmt(e.ms)); break; }
        var same = nearStart(e.ms);
        if (same) {
          // 이미 있는 기록(수동 입력 등)과 같은 주차 — 좌표·BT 시각만 채운다
          if (same.lat == null && e.lat != null) { same.lat = e.lat; same.lng = e.lng; }
          same.btStartMs = e.ms;
          applyPlace(same, e.lat, e.lng);
          put(same);
          report.push('기존 기록과 합침 ' + fmt(e.ms) + ' → ' + same.id);
        } else {
          var a = openDoc();
          if (a && a.startMs < e.ms) { close(a, e.ms, false); report.push('열린 기록 추정 종료 ' + a.id); }
          var d = { id: 'p' + e.ms, startMs: e.ms, endMs: null, lat: e.lat, lng: e.lng, spot: null, note: '', rate10: null, fee: null, photoId: null,
                    source: 'bt-log', btStartMs: e.ms, createdAt: now, placeId: null, place: null, longOk: false };
          applyPlace(d, e.lat, e.lng);
          put(d);
          report.push('주차 시작 ' + fmt(e.ms) + (d.place ? ' · ' + d.place : ''));
        }
      } else {
        var o = openDoc();
        if (o && o.startMs < e.ms) { close(o, e.ms, true); report.push('출차 ' + fmt(e.ms) + ' ← ' + o.id); }
      }
      last = e.ms;
    }
    return { changed: changed, state: { lastEventMs: last, syncedAt: now }, report: report };
  }

  function fmt(ms) {
    var d = new Date(ms + 9 * 3600 * 1000);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return (d.getUTCMonth() + 1) + '/' + d.getUTCDate() + ' ' + p(d.getUTCHours()) + ':' + p(d.getUTCMinutes());
  }

  // 루틴용 판정: 24시간 넘게 열린 외부 주차, 로그 끊김
  function alerts(events, docs, now) {
    var out = [], lastEv = events.length ? events[events.length - 1].ms : null;
    (docs || []).forEach(function (d) {
      if (d.endMs == null && !d.longOk && now - d.startMs > LONG_MS) out.push({ kind: 'long', doc: d, hours: Math.floor((now - d.startMs) / 3600000) });
    });
    if (lastEv == null || now - lastEv > SILENT_MS) out.push({ kind: 'silent', lastEventMs: lastEv });
    return out;
  }

  var api = { parseLog: parseLog, reconcile: reconcile, alerts: alerts, kstMs: kstMs, fmt: fmt, DEBOUNCE_MS: DEBOUNCE_MS, MERGE_MS: MERGE_MS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ParkingSync = api;

  // ---------- CLI (루틴) ----------
  // node parking_sync.js --log a.csv [--log b.csv ...] --db DIR [--versions versions.json] [--now ms] --outdir OUT
  //   DIR: ArtifactData list 를 out_dir=DIR 로 받은 폴더 (DIR/parkings/<id>.json, DIR/places/<id>.json, DIR/sync/state.json)
  //   versions.json: {"parkings/<id>": 버전, "sync/state": 버전} — 이미 있는 문서를 고칠 때 if_version 으로 쓴다
  //   OUT/plan.json: ArtifactData batch 의 writes 배열(각 항목 file_path 사용). 버전이 필요한데 없으면 NEED_VERSION 줄을 찍는다.
  if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) {
    var fs = require('fs'), pathm = require('path');
    var args = process.argv.slice(2), opt = { log: [] };
    for (var k = 0; k < args.length; k += 2) { var key = args[k].replace(/^--/, ''); if (key === 'log') opt.log.push(args[k + 1]); else opt[key] = args[k + 1]; }
    var rows = function (coll) {
      var dir = pathm.join(opt.db || '.', coll);
      if (!fs.existsSync(dir)) return [];
      return fs.readdirSync(dir).filter(function (f) { return /\.json$/.test(f); }).map(function (f) {
        var b = JSON.parse(fs.readFileSync(pathm.join(dir, f), 'utf8'));
        b.id = f.replace(/\.json$/, '');
        return b;
      });
    };
    var versions = opt.versions && fs.existsSync(opt.versions) ? JSON.parse(fs.readFileSync(opt.versions, 'utf8')) : {};
    var now = opt.now ? Number(opt.now) : Date.now();
    var text = opt.log.filter(function (p) { return fs.existsSync(p); }).map(function (p) { return fs.readFileSync(p, 'utf8'); }).join('\n');
    var events = parseLog(text);
    var parkings = rows('parkings'), places = rows('places');
    var stateRow = rows('sync').filter(function (r) { return r.id === 'state'; })[0] || null;
    var exists = {}; parkings.forEach(function (d) { exists['parkings/' + d.id] = true; });
    if (stateRow) exists['sync/state'] = true;
    var r = reconcile(events, parkings, places, stateRow, now);
    var out = opt.outdir || 'out', plan = [], need = [];
    if (!fs.existsSync(out)) fs.mkdirSync(out, { recursive: true });
    function emit(coll, id, data) {
      var body = Object.assign({}, data); delete body.id;
      var file = pathm.resolve(out, coll + '__' + id + '.json');
      fs.writeFileSync(file, JSON.stringify(body));
      var w = { op: 'set', collection: coll, doc_id: id, file_path: file }, key = coll + '/' + id;
      if (exists[key]) { if (versions[key] != null) w.if_version = Number(versions[key]); else need.push(key); }
      plan.push(w);
    }
    Object.keys(r.changed).forEach(function (id) { emit('parkings', id, r.changed[id]); });
    if (Object.keys(r.changed).length || !stateRow || stateRow.lastEventMs !== r.state.lastEventMs) emit('sync', 'state', r.state);
    fs.writeFileSync(pathm.join(out, 'plan.json'), JSON.stringify(plan, null, 1));
    var after = parkings.map(function (d) { return r.changed[d.id] || d; });
    Object.keys(r.changed).forEach(function (id) { if (!after.some(function (d) { return d.id === id; })) after.push(r.changed[id]); });
    var al = alerts(events, after, now);
    console.log('EVENTS: ' + events.length + ' · 마지막 ' + (events.length ? fmt(events[events.length - 1].ms) + ' ' + events[events.length - 1].ev : '없음'));
    console.log('PLAN: ' + plan.length + ' writes → ' + pathm.join(out, 'plan.json'));
    need.forEach(function (k2) { console.log('NEED_VERSION: ' + k2); });
    r.report.forEach(function (s2) { console.log('  ' + s2); });
    al.forEach(function (a) {
      if (a.kind === 'long') console.log('ALERT_LONG: ' + a.hours + '|' + (a.doc.place ? a.doc.place + ' · ' : '') + (a.doc.spot || '위치 미입력') + ' · ' + fmt(a.doc.startMs) + ' 시작');
      else console.log('ALERT_SILENT: ' + (a.lastEventMs ? fmt(a.lastEventMs) : '기록 없음'));
    });
  }
})(this);
