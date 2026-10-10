// node parking/test_parking_sync.js — 반영 규칙 회귀 시험 (좌표는 가짜 값)
'use strict';
var S = require('./parking_sync.js');
var assert = require('assert');
var places = [{ id: 'plH', name: '집', lat: 37.5, lng: 127.0, radius: 200, home: true, spot: 'B1' },
              { id: 'plW', name: '회사', lat: 37.2, lng: 127.1, radius: 400, home: false }];
var T = function (d, t) { return S.kstMs(d, t); };
var n = 0;
function check(name, fn) { fn(); n++; console.log('ok ' + n + ' ' + name); }

check('형식: 패딩 없는 시각, BOM, 이상한 좌표, 중복 줄', function () {
  var ev = S.parseLog('﻿2026-10-11,8:05,OFF,{last_loc_lat},{last_loc_long}\n2026-10-11,8:05,OFF,37.2001,127.1001\n2026-10-11,18:30,ON,,\n잡음\n');
  assert.strictEqual(ev.length, 2);
  assert.strictEqual(ev[0].lat, 37.2001);          // 중복 줄의 좌표를 살린다
  assert.strictEqual(ev[0].ms, Date.UTC(2026, 9, 10, 23, 5));
});

check('기본: 꺼짐→켜짐 = 1건, 장소 인식', function () {
  var ev = S.parseLog('2026-10-11,08:05,OFF,37.2001,127.1001\n2026-10-11,18:30,ON,,');
  var r = S.reconcile(ev, [], places, null, T('2026-10-11', '19:00'));
  var d = r.changed['p' + T('2026-10-11', '08:05')];
  assert.strictEqual(d.endMs, T('2026-10-11', '18:30'));
  assert.strictEqual(d.place, '회사');
  assert.strictEqual(d.source, 'bt-log');
  assert.strictEqual(r.state.lastEventMs, T('2026-10-11', '18:30'));
});

check('3분 미만 끊김 무시', function () {
  var ev = S.parseLog('2026-10-11,08:05,OFF,,\n2026-10-11,08:07,ON,,');
  var r = S.reconcile(ev, [], places, null, T('2026-10-11', '09:00'));
  assert.strictEqual(Object.keys(r.changed).length, 0);
  assert.strictEqual(r.state.lastEventMs, T('2026-10-11', '08:07'));
});

check('막 꺼진 3분 미만은 대기(다음 실행에서 처리)', function () {
  var ev = S.parseLog('2026-10-11,08:05,OFF,,');
  var r = S.reconcile(ev, [], places, null, T('2026-10-11', '08:06'));
  assert.strictEqual(Object.keys(r.changed).length, 0);
  assert.strictEqual(r.state.lastEventMs, 0);
});

check('꺼짐만 두 번(켜짐 누락) → 앞 주차 추정 종료', function () {
  var ev = S.parseLog('2026-10-11,08:05,OFF,,\n2026-10-11,19:10,OFF,37.5,127.0');
  var r = S.reconcile(ev, [], places, null, T('2026-10-11', '20:00'));
  var a = r.changed['p' + T('2026-10-11', '08:05')], b = r.changed['p' + T('2026-10-11', '19:10')];
  assert.strictEqual(a.endMs, T('2026-10-11', '19:10'));
  assert.strictEqual(a.autoClosed, true);
  assert.strictEqual(b.endMs, null);
  assert.strictEqual(b.longOk, true);              // 집
  assert.strictEqual(b.spot, 'B1');
});

check('켜짐만 있음 → 무시', function () {
  var r = S.reconcile(S.parseLog('2026-10-11,08:05,ON,,'), [], places, null, T('2026-10-11', '09:00'));
  assert.strictEqual(Object.keys(r.changed).length, 0);
});

check('수동 기록과 합침(시작 ±20분) — 층·메모 보존, 켜짐으로 닫힘', function () {
  var man = { id: 'pM', startMs: T('2026-10-11', '10:15'), endMs: null, spot: 'B1', note: '엘베 쪽', rate10: 600, fee: null, lat: null, lng: null, source: 'manual' };
  var ev = S.parseLog('2026-10-11,10:02,OFF,37.21,127.1\n2026-10-11,12:24,ON,,');
  var r = S.reconcile(ev, [man], places, null, T('2026-10-11', '13:00'));
  assert.deepStrictEqual(Object.keys(r.changed), ['pM']);
  var d = r.changed.pM;
  assert.strictEqual(d.note, '엘베 쪽');
  assert.strictEqual(d.lat, 37.21);
  assert.strictEqual(d.endMs, T('2026-10-11', '12:24'));
  assert.strictEqual(d.fee, Math.ceil(129 / 10) * 600);
});

check('이미 손으로 닫은 기록과도 합침(나중에 로그가 올라온 경우)', function () {
  var man = { id: 'pM', startMs: T('2026-10-11', '10:15'), endMs: T('2026-10-11', '12:24'), source: 'manual', lat: null, lng: null };
  var ev = S.parseLog('2026-10-11,10:14,OFF,,\n2026-10-11,12:25,ON,,');
  var r = S.reconcile(ev, [man], places, null, T('2026-10-11', '13:00'));
  assert.deepStrictEqual(Object.keys(r.changed), ['pM']);
  assert.strictEqual(r.changed.pM.endMs, T('2026-10-11', '12:24'));   // 손으로 넣은 출차는 건드리지 않는다
});

check('잠깐 이동 후 재주차(켜짐 뒤 15분 만에 꺼짐) → 별개 2건', function () {
  var ev = S.parseLog('2026-10-11,10:00,OFF,,\n2026-10-11,10:10,ON,,\n2026-10-11,10:15,OFF,,\n2026-10-11,11:00,ON,,');
  var r = S.reconcile(ev, [], places, null, T('2026-10-11', '12:00'));
  assert.strictEqual(Object.keys(r.changed).length, 2);
});

check('멱등: 같은 로그를 두 번 반영해도 변화 없음 / 지운 기록 되살리지 않음', function () {
  var ev = S.parseLog('2026-10-11,08:05,OFF,,\n2026-10-11,18:30,ON,,');
  var r1 = S.reconcile(ev, [], places, null, T('2026-10-11', '19:00'));
  var docs = Object.keys(r1.changed).map(function (k) { return r1.changed[k]; });
  var r2 = S.reconcile(ev, docs, places, r1.state, T('2026-10-11', '20:00'));
  assert.strictEqual(Object.keys(r2.changed).length, 0);
  var r3 = S.reconcile(ev, [], places, r1.state, T('2026-10-11', '20:00'));   // 사용자가 지운 뒤
  assert.strictEqual(Object.keys(r3.changed).length, 0);
});

check('나눠 들어온 로그: 꺼짐 먼저 반영, 켜짐은 다음 실행에서', function () {
  var r1 = S.reconcile(S.parseLog('2026-10-11,08:05,OFF,,'), [], places, null, T('2026-10-11', '09:00'));
  var docs = Object.keys(r1.changed).map(function (k) { return r1.changed[k]; });
  var r2 = S.reconcile(S.parseLog('2026-10-11,08:05,OFF,,\n2026-10-11,18:30,ON,,'), docs, places, r1.state, T('2026-10-11', '19:00'));
  var d = r2.changed['p' + T('2026-10-11', '08:05')];
  assert.strictEqual(d.endMs, T('2026-10-11', '18:30'));
  assert.ok(!d.autoClosed);
});

check('판정: 24시간 넘은 외부 주차, 로그 끊김', function () {
  var docs = [{ id: 'a', startMs: T('2026-10-10', '08:00'), endMs: null, longOk: false, place: '회사' },
              { id: 'b', startMs: T('2026-10-09', '08:00'), endMs: null, longOk: true }];
  var ev = S.parseLog('2026-10-10,08:00,OFF,,');
  var al = S.alerts(ev, docs, T('2026-10-11', '09:00'));
  assert.strictEqual(al.length, 1);
  assert.strictEqual(al[0].kind, 'long');
  assert.strictEqual(S.alerts(ev, [], T('2026-10-15', '09:00'))[0].kind, 'silent');
});

console.log('전부 통과 ' + n);
