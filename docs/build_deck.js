const pptxgen = require('pptxgenjs');
const sharp = require('sharp');
const React = require('react');
const RDS = require('react-dom/server');
const Fi = require('react-icons/fi');

// ---------- palette : Midnight Executive ----------
const NAVY = "1E2761", DEEP = "141B45", MID = "31408A", ICE = "CADCFC",
      AMBER = "FFB627", WHITE = "FFFFFF", BG = "F4F6FC",
      BODY = "3C4459", MUTED = "7C86A2", LINE = "DDE3F2";
const KO = "Malgun Gothic";

const sh = () => ({ type: 'outer', color: '1E2761', blur: 14, offset: 2, angle: 90, opacity: 0.10 });

const iconCache = {};
async function icon(name, color) {
  const key = name + color;
  if (iconCache[key]) return iconCache[key];
  const svg = RDS.renderToStaticMarkup(React.createElement(Fi[name], { size: 320, color: '#' + color }));
  const png = await sharp(Buffer.from(svg)).resize(320, 320).png().toBuffer();
  iconCache[key] = "image/png;base64," + png.toString('base64');
  return iconCache[key];
}

async function main() {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';           // 13.333 x 7.5
  pres.author = 'Team';
  pres.title = '팀 업무 마일스톤 관리 체계 도입안';

  const W = 13.333;

  // shared helpers ------------------------------------------------
  const lightBg = (s) => s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 7.5, fill: { color: BG } });
  const darkBg  = (s) => s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: W, h: 7.5, fill: { color: NAVY } });

  const kicker = (s, t, color) => s.addText(t, {
    x: 0.65, y: 0.42, w: 8, h: 0.3, fontFace: KO, fontSize: 12, bold: true,
    color: color || AMBER, charSpacing: 2, margin: 0
  });

  const title = (s, t, color) => s.addText(t, {
    x: 0.65, y: 0.78, w: 11.9, h: 0.75, fontFace: KO, fontSize: 32, bold: true,
    color: color || NAVY, margin: 0
  });

  const card = (s, x, y, w, h, fill) => s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.10, fill: { color: fill || WHITE }, shadow: sh()
  });

  // circle holding an icon
  const iconDot = async (s, x, y, d, bg, iconName, iconColor) => {
    s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color: bg } });
    const pad = d * 0.27;
    s.addImage({ data: await icon(iconName, iconColor), x: x + pad, y: y + pad, w: d - pad * 2, h: d - pad * 2 });
  };

  // =====================================================  1. TITLE
  {
    const s = pres.addSlide();
    darkBg(s);
    // milestone motif (right)
    const cy = 3.55, d = 0.40;
    const cxs = [9.05, 10.15, 11.25, 12.35];
    s.addShape(pres.ShapeType.rect, { x: cxs[0] + d / 2, y: cy + d / 2 - 0.015, w: cxs[3] - cxs[0], h: 0.03, fill: { color: MID } });
    const labels = ['시작', '중간점검 1', '중간점검 2', '완료'];
    cxs.forEach((cx, i) => {
      const done = i < 2;
      s.addShape(pres.ShapeType.ellipse, {
        x: cx, y: cy, w: d, h: d,
        fill: { color: done ? AMBER : NAVY }, line: { color: done ? AMBER : ICE, width: 2 }
      });
      s.addText(labels[i], {
        x: cx + d / 2 - 0.75, y: cy + 0.58, w: 1.5, h: 0.28, align: 'center',
        fontFace: KO, fontSize: 10, color: done ? ICE : MUTED, margin: 0
      });
    });
    s.addText('P L A N', { x: 8.55, y: 2.62, w: 4.2, h: 0.3, fontFace: 'Arial', fontSize: 11, bold: true, color: AMBER, charSpacing: 4, margin: 0 });

    s.addText('업무 관리 도구 도입 계획', {
      x: 0.9, y: 2.05, w: 7.4, h: 0.32, fontFace: KO, fontSize: 13, bold: true, color: AMBER, charSpacing: 2, margin: 0
    });
    s.addText('팀 업무 마일스톤\n관리 체계', {
      x: 0.9, y: 2.45, w: 7.6, h: 1.9, fontFace: KO, fontSize: 40, bold: true, color: WHITE, lineSpacing: 48, margin: 0
    });
    s.addText('업무를 까먹는 일이 없는 팀을, 사람의 기억이 아니라 시스템으로 만든다', {
      x: 0.9, y: 4.45, w: 7.6, h: 0.4, fontFace: KO, fontSize: 15, color: ICE, margin: 0
    });
    s.addShape(pres.ShapeType.rect, { x: 0.9, y: 5.25, w: 1.4, h: 0.02, fill: { color: MID } });
    s.addText('2026. 07  ·  3인 팀 기준  ·  NHN 두레이(Dooray) 도입안', {
      x: 0.9, y: 5.5, w: 7.6, h: 0.35, fontFace: KO, fontSize: 12, color: MUTED, margin: 0
    });
    s.addNotes('이 발표는 팀원이 자기 업무를 잊고 방치하는 문제를 시스템으로 관리하기 위한 도구 도입안입니다. 결론은 NHN 두레이를 무료 플랜으로 도입하는 것입니다.');
  }

  // ==============================================  2. 왜 필요한가
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '문제 정의');
    title(s, '왜 이 도구가 필요한가');

    card(s, 0.65, 1.85, 5.35, 4.45, NAVY);
    s.addText('지금 우리 팀의 모습', {
      x: 1.05, y: 2.25, w: 4.6, h: 0.3, fontFace: KO, fontSize: 12, bold: true, color: AMBER, charSpacing: 1, margin: 0
    });
    s.addText('“그거 하고\n계신가요?”', {
      x: 1.05, y: 2.7, w: 4.6, h: 1.5, fontFace: KO, fontSize: 30, bold: true, color: WHITE, lineSpacing: 40, margin: 0
    });
    s.addText('매번 사람이 직접 물어봐야만\n진행 상황을 알 수 있는 상태.', {
      x: 1.05, y: 4.3, w: 4.6, h: 0.8, fontFace: KO, fontSize: 14, color: ICE, lineSpacing: 24, margin: 0
    });
    s.addText('묻는 사람도 지치고, 묻지 않으면 그대로 잊혀집니다.', {
      x: 1.05, y: 5.35, w: 4.6, h: 0.6, fontFace: KO, fontSize: 12, color: MUTED, italic: true, lineSpacing: 18, margin: 0
    });

    const pains = [
      ['FiAlertCircle', '업무 자체를 잊어버린다', '맡은 일이 어디에도 기록되어 있지 않아, 담당자가 잊으면 그대로 사라집니다.'],
      ['FiEyeOff', '진행 상황이 보이지 않는다', '중간에 어디까지 왔는지 알 수 없어, 마감 직전에야 문제가 드러납니다.'],
      ['FiClock', '늦어져도 아무도 모른다', '일정이 밀린 사실이 조용히 넘어가고, 다음에도 똑같이 반복됩니다.']
    ];
    for (let i = 0; i < pains.length; i++) {
      const y = 1.85 + i * 1.53;
      card(s, 6.45, y, 6.25, 1.36);
      await iconDot(s, 6.78, y + 0.36, 0.64, ICE, pains[i][0], NAVY);
      s.addText(pains[i][1], { x: 7.62, y: y + 0.24, w: 4.85, h: 0.34, fontFace: KO, fontSize: 16, bold: true, color: NAVY, margin: 0 });
      s.addText(pains[i][2], { x: 7.62, y: y + 0.62, w: 4.85, h: 0.62, fontFace: KO, fontSize: 12, color: BODY, lineSpacing: 17, margin: 0 });
    }
    s.addNotes('문제는 개인의 성실함이 아니라 구조에 있습니다. 기록되지 않은 일은 잊히고, 보이지 않는 진행은 관리할 수 없습니다.');
  }

  // ==============================================  3. 목표 3가지
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '도입 목적');
    title(s, '이 도구가 노리는 것 세 가지');
    s.addText('사람의 의지에 기대지 않고, 구조가 대신 챙기게 만듭니다.', {
      x: 0.65, y: 1.55, w: 11.9, h: 0.32, fontFace: KO, fontSize: 14, color: MUTED, margin: 0
    });

    const goals = [
      ['FiEdit3', '01', '기록의 강제', '모든 업무는 마일스톤과 예상 일정이 기입된 상태로만 존재할 수 있게 합니다. 기록에 없는 일은 없는 일입니다.'],
      ['FiCheckSquare', '02', '자기 점검의 습관화', '각 팀원이 스스로 세운 계획 대비 진행 여부를 직접 체크합니다. 체크 행위 자체가 팀에 대한 보고가 됩니다.'],
      ['FiUsers', '03', '투명한 공유', '일정 도달과 지연 사실이 담당자뿐 아니라 팀원 전원에게 전달됩니다. 조용히 넘어갈 수 없는 구조입니다.']
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.63 + i * 4.14;
      card(s, x, 2.15, 3.8, 3.75);
      await iconDot(s, x + 0.42, 2.6, 0.78, NAVY, goals[i][0], AMBER);
      s.addText(goals[i][1], { x: x + 1.42, y: 2.72, w: 1.2, h: 0.5, fontFace: 'Arial', fontSize: 30, bold: true, color: ICE, margin: 0 });
      s.addText(goals[i][2], { x: x + 0.42, y: 3.62, w: 3.0, h: 0.42, fontFace: KO, fontSize: 18, bold: true, color: NAVY, margin: 0 });
      s.addText(goals[i][3], { x: x + 0.42, y: 4.12, w: 2.98, h: 1.55, fontFace: KO, fontSize: 12.5, color: BODY, lineSpacing: 19, margin: 0 });
    }
    s.addNotes('세 가지 목적: 기록의 강제, 자기 점검의 습관화, 투명한 공유. 특히 세 번째가 핵심입니다. 동료의 시선이 가장 강력한 리마인더입니다.');
  }

  // ==============================================  4. 요구사항
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '요구사항');
    title(s, '우리가 필요로 하는 기능');

    const reqs = [
      ['R1', '팀원별 업무를 마일스톤 방식으로 기록'],
      ['R2', '업무마다 4단계 계획 수립 : 시작 → 중간점검 1 → 중간점검 2 → 완료'],
      ['R3', '계획 대비 진행 여부를 담당자 본인이 체크'],
      ['R4', '계획된 일정에 도달하면 팀원 전원에게 개별 알림'],
      ['R5', '매일 아침 7시, 전 팀원의 진행 현황을 전원이 수신'],
      ['R6', '팀원 수 변동에 대응 (현재 3명, 변동 가능)'],
      ['R7', 'PC에서 누구나 쉽게 공유하고 편집할 수 있는 형태'],
      ['R8', '알림은 카카오톡 우선, 어려우면 팀원별 지정 이메일']
    ];
    for (let i = 0; i < 8; i++) {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.65 + col * 6.13, y = 1.68 + row * 1.24;
      card(s, x, y, 5.9, 1.08);
      s.addShape(pres.ShapeType.roundRect, { x: x + 0.28, y: y + 0.30, w: 0.66, h: 0.47, rectRadius: 0.08, fill: { color: NAVY } });
      s.addText(reqs[i][0], { x: x + 0.28, y: y + 0.30, w: 0.66, h: 0.47, align: 'center', valign: 'middle', fontFace: 'Arial', fontSize: 14, bold: true, color: AMBER, margin: 0 });
      s.addText(reqs[i][1], { x: x + 1.08, y: y + 0.16, w: 4.62, h: 0.76, valign: 'middle', fontFace: KO, fontSize: 12.5, color: BODY, lineSpacing: 18, margin: 0 });
    }
    s.addText('※ R4·R5의 “전원에게”가 이 도구의 성패를 가르는 지점입니다.', {
      x: 0.65, y: 6.66, w: 11.9, h: 0.35, fontFace: KO, fontSize: 12, color: MUTED, italic: true, margin: 0
    });
    s.addNotes('여덟 가지 요구사항 중 R4와 R5, 즉 담당자가 아니라 팀원 전원이 알림을 받는다는 점이 일반 협업툴과 갈리는 부분입니다.');
  }

  // ==============================================  5. 갈림길
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '의사결정');
    title(s, '직접 만들 것인가, 있는 것을 쓸 것인가');

    const cols = [
      ['FiTool', '자체 개발', NAVY, WHITE, ICE, [
        '요구사항을 100% 그대로 구현 가능',
        '구글 시트 + 스크립트 + 자동 실행 구성',
        '개발 2~3일, 이후 오류 시 직접 수리',
        '모바일 앱·화면은 따로 없음'
      ]],
      ['FiPackage', '기존 도구 활용', WHITE, NAVY, BODY, [
        '오늘 바로 시작, 개발 0일',
        '모바일 앱·간트차트·이력 관리 무료 제공',
        '고장나면 회사가 고쳐 줌',
        '전원 알림·아침 요약은 완벽히 못 맞춤'
      ]]
    ];
    for (let i = 0; i < 2; i++) {
      const [ic, head, fill, headColor, textColor, items] = cols[i];
      const x = 0.65 + i * 6.13;
      card(s, x, 1.62, 5.9, 4.2, fill);
      await iconDot(s, x + 0.4, 1.98, 0.7, i === 0 ? MID : ICE, ic, i === 0 ? AMBER : NAVY);
      s.addText(head, { x: x + 1.28, y: 2.08, w: 4.2, h: 0.45, valign: 'middle', fontFace: KO, fontSize: 21, bold: true, color: headColor, margin: 0 });
      items.forEach((t, j) => {
        s.addText(t, {
          x: x + 0.4, y: 2.95 + j * 0.68, w: 5.1, h: 0.6, fontFace: KO, fontSize: 13, color: textColor,
          bullet: { code: '2022' }, lineSpacing: 18, margin: 0
        });
      });
    }
    card(s, 0.65, 6.08, 12.03, 0.92, WHITE);
    s.addText([
      { text: '선택 : ', options: { bold: true, color: NAVY } },
      { text: '요구사항에서 한 발 양보하고, 이미 만들어진 도구를 쓴다. ', options: { color: BODY } },
      { text: '오늘 시작할 수 있다는 것이 완벽함보다 중요합니다.', options: { color: MUTED, italic: true } }
    ], { x: 1.0, y: 6.08, w: 11.3, h: 0.92, valign: 'middle', fontFace: KO, fontSize: 13.5, margin: 0 });
    s.addNotes('완벽하게 맞는 도구를 몇 일 걸려 만드는 것보다, 80% 맞는 도구로 오늘 시작하는 편이 낫다고 판단했습니다.');
  }

  // ==============================================  6. 기존 툴의 한계
  {
    const s = pres.addSlide();
    darkBg(s);
    kicker(s, '양보해야 하는 부분');
    title(s, '기존 도구가 못 해 주는 세 가지', WHITE);

    const gaps = [
      ['01', '일정 도달 시 팀원 “전원”에게 알림', '모든 도구가 담당자와 참조자에게만 알림을 보내도록 설계되어 있습니다. 참조자에 전원을 넣으면 비슷해지지만, 등록할 때 사람이 챙겨야 합니다.'],
      ['02', '아침 7시, 전원의 현황을 전원에게', '데일리 요약 기능이 있는 도구도 “내 업무 요약”만 보내 줍니다. 팀 전체 현황을 전원에게 뿌리는 기능은 표준으로 없습니다.'],
      ['03', '방치 감지', '마감 전까지는 담당자가 며칠을 손대지 않아도 아무 신호가 없습니다. 사실 “까먹는 사람 관리”에는 마감 알림보다 이쪽이 더 중요합니다.']
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.95 + i * 1.42;
      s.addShape(pres.ShapeType.roundRect, { x: 0.65, y, w: 12.03, h: 1.26, rectRadius: 0.09, fill: { color: DEEP } });
      s.addText(gaps[i][0], { x: 1.0, y: y + 0.32, w: 0.85, h: 0.62, fontFace: 'Arial', fontSize: 30, bold: true, color: AMBER, margin: 0 });
      s.addText(gaps[i][1], { x: 2.0, y: y + 0.2, w: 4.3, h: 0.85, valign: 'middle', fontFace: KO, fontSize: 15.5, bold: true, color: WHITE, lineSpacing: 21, margin: 0 });
      s.addText(gaps[i][2], { x: 6.5, y: y + 0.22, w: 5.85, h: 0.85, valign: 'middle', fontFace: KO, fontSize: 11.5, color: ICE, lineSpacing: 16, margin: 0 });
    }
    s.addText('이유는 단순합니다. 시중 도구는 “내가 내 일을 잘 챙기도록 돕는” 물건이지, “안 챙기는 사람을 팀 전체가 보게 만드는” 물건이 아니기 때문입니다.', {
      x: 0.65, y: 6.42, w: 12.03, h: 0.5, fontFace: KO, fontSize: 12.5, color: MUTED, italic: true, lineSpacing: 18, margin: 0
    });
    s.addNotes('이 세 가지는 어떤 상용 도구도 기본 제공하지 않습니다. 운영 규칙으로 메우거나, 나중에 스크립트로 보완해야 합니다.');
  }

  // ==============================================  7. 도구 비교
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '후보 비교');
    title(s, '다섯 가지 후보를 놓고 따져보면');

    const head = ['도구', '업무 · 4단계 관리', '알림', '진입 장벽', '판정'];
    const rows = [
      ['두레이 (Dooray)', '상위 업무 + 하위 업무로 4단계 그대로 구현', '담당자·참조자 마감 알림, 모바일 앱 푸시', '한국어 · 낮음', '채택'],
      ['플로우 (flow)', '업무 관리 · 간트차트 지원', '알림톡 등 발송 채널 보유', '한국어 · 낮음', '무료 범위 불투명'],
      ['카카오워크', '할 일 수준으로 단순', '카카오톡과 거의 같은 사용감', '한국어 · 가장 낮음', '마일스톤 관리 부족'],
      ['ClickUp', '기능 매칭은 가장 좋음', '원하는 시각에 데일리 요약 발송', '영어 · 높음', '3인 전원 학습 부담'],
      ['Notion', '자유로운 기록에 강함', '마감 알림 · 자동화가 약함', '한국어 · 중간', '까먹음 방지에 부적합']
    ];
    const tbl = [head.map(t => ({
      text: t, options: { fill: { color: NAVY }, color: WHITE, bold: true, fontSize: 12, fontFace: KO, valign: 'middle', align: 'left' }
    }))];
    rows.forEach((r, i) => {
      const pick = i === 0;
      tbl.push(r.map((t, j) => ({
        text: t,
        options: {
          fill: { color: pick ? ICE : WHITE },
          color: pick ? NAVY : (j === 4 ? MUTED : BODY),
          bold: pick && (j === 0 || j === 4),
          fontSize: 11, fontFace: KO, valign: 'middle', align: 'left'
        }
      })));
    });
    s.addTable(tbl, {
      x: 0.6, y: 1.72, w: 12.13, colW: [2.2, 3.35, 3.25, 1.83, 1.5],
      rowH: [0.5, 0.78, 0.68, 0.68, 0.68, 0.68],
      border: { type: 'solid', color: LINE, pt: 1 }, margin: 0.09
    });
    s.addText('두레이는 3인 팀 기준 무료로 쓸 수 있고, 한국어 화면과 모바일 앱을 함께 제공합니다.', {
      x: 0.6, y: 6.25, w: 12.13, h: 0.4, fontFace: KO, fontSize: 12.5, color: BODY, margin: 0
    });
    s.addNotes('ClickUp이 기능만 보면 가장 잘 맞지만 영어 화면이라 3명 모두 쓰기에 부담이 큽니다. 도구는 결국 안 쓰면 소용이 없습니다.');
  }

  // ==============================================  8. 결론
  {
    const s = pres.addSlide();
    lightBg(s);
    s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 5.55, h: 7.5, fill: { color: NAVY } });
    s.addText('결론', { x: 0.72, y: 2.15, w: 4.2, h: 0.35, fontFace: KO, fontSize: 13, bold: true, color: AMBER, charSpacing: 2, margin: 0 });
    s.addText('NHN 두레이\n(Dooray)', {
      x: 0.72, y: 2.6, w: 4.4, h: 1.7, fontFace: KO, fontSize: 34, bold: true, color: WHITE, lineSpacing: 44, margin: 0
    });
    s.addText('무료 · 한국어 · 모바일 알림\n3인 팀에 가장 적합', {
      x: 0.72, y: 4.42, w: 4.4, h: 0.9, fontFace: KO, fontSize: 14.5, color: ICE, lineSpacing: 23, margin: 0
    });

    const why = [
      ['FiGift', '무료 범위가 넉넉하다', '소규모 팀은 무료로 사용 가능하며, 인원이 늘어도 당분간 여유가 있습니다.'],
      ['FiSmartphone', '한국어 화면 + 모바일 푸시', '카카오톡 알림은 아니지만, 폰 푸시 알림이 사실상 같은 역할을 합니다.'],
      ['FiUsers', '담당자 + 참조자 구조', '모든 업무에 팀원 전원을 참조자로 넣는 규칙만 지키면 “전원 알림”이 됩니다.'],
      ['FiCalendar', '마감일 알림이 기본 내장', '업무별 시작일·마감일과 완료율 표시를 기본으로 제공합니다.']
    ];
    s.addText('이 도구를 고른 네 가지 이유', {
      x: 6.15, y: 0.95, w: 6.5, h: 0.45, fontFace: KO, fontSize: 22, bold: true, color: NAVY, margin: 0
    });
    for (let i = 0; i < 4; i++) {
      const y = 1.72 + i * 1.4;
      card(s, 6.15, y, 6.5, 1.22);
      await iconDot(s, 6.45, y + 0.3, 0.62, ICE, why[i][0], NAVY);
      s.addText(why[i][1], { x: 7.25, y: y + 0.2, w: 5.2, h: 0.32, fontFace: KO, fontSize: 15, bold: true, color: NAVY, margin: 0 });
      s.addText(why[i][2], { x: 7.25, y: y + 0.55, w: 5.2, h: 0.55, fontFace: KO, fontSize: 11.5, color: BODY, lineSpacing: 16, margin: 0 });
    }
    s.addNotes('두레이를 선택한 이유는 기능이 가장 뛰어나서가 아니라, 3명이 실제로 계속 쓸 가능성이 가장 높기 때문입니다.');
  }

  // ==============================================  9. 앱? 웹?
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '자주 나오는 첫 질문');
    title(s, '두레이는 앱인가요, 웹인가요?');
    s.addShape(pres.ShapeType.roundRect, { x: 0.65, y: 1.62, w: 2.55, h: 0.48, rectRadius: 0.24, fill: { color: AMBER } });
    s.addText('셋 다 됩니다', { x: 0.65, y: 1.62, w: 2.55, h: 0.48, align: 'center', valign: 'middle', fontFace: KO, fontSize: 14, bold: true, color: NAVY, margin: 0 });
    s.addText('어느 쪽으로 들어가도 똑같은 내용이 보입니다. 한 곳에서 적으면 나머지에도 그대로 반영됩니다.', {
      x: 3.45, y: 1.62, w: 9.2, h: 0.48, valign: 'middle', fontFace: KO, fontSize: 13, color: BODY, margin: 0
    });

    const forms = [
      ['FiGlobe', '웹 브라우저', '설치 불필요', 'dooray.com에 접속해서 로그인만 하면 끝입니다. 크롬·엣지 어느 것이든 됩니다.'],
      ['FiMonitor', 'PC 설치용 앱', '선택 사항', '브라우저 대신 별도 창으로 띄우고 싶을 때 씁니다. 안 깔아도 아무 문제 없습니다.'],
      ['FiSmartphone', '스마트폰 앱', '설치 권장', '안드로이드·아이폰 모두 지원. 알림을 놓치지 않으려면 이것만은 꼭 설치합니다.']
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.63 + i * 4.14;
      const hot = i === 2;
      card(s, x, 2.4, 3.8, 3.05, hot ? NAVY : WHITE);
      await iconDot(s, x + 0.42, 2.78, 0.72, hot ? MID : ICE, forms[i][0], hot ? AMBER : NAVY);
      s.addText(forms[i][1], { x: x + 0.42, y: 3.68, w: 3.0, h: 0.36, fontFace: KO, fontSize: 17, bold: true, color: hot ? WHITE : NAVY, margin: 0 });
      s.addText(forms[i][2], { x: x + 0.42, y: 4.06, w: 3.0, h: 0.28, fontFace: KO, fontSize: 11.5, bold: true, color: hot ? AMBER : MUTED, margin: 0 });
      s.addText(forms[i][3], { x: x + 0.42, y: 4.42, w: 2.98, h: 0.85, fontFace: KO, fontSize: 12, color: hot ? ICE : BODY, lineSpacing: 17, margin: 0 });
    }
    card(s, 0.65, 5.72, 12.03, 1.05, WHITE);
    await iconDot(s, 1.0, 5.94, 0.6, AMBER, 'FiThumbsUp', NAVY);
    s.addText([
      { text: '권장 조합 : ', options: { bold: true, color: NAVY } },
      { text: 'PC에서는 브라우저로 기록하고 편집, 폰에는 앱을 깔아 알림만 받습니다. 알림을 놓치지 않는 것이 도입 목적이므로 폰 앱 설치는 사실상 필수입니다.', options: { color: BODY } }
    ], { x: 1.78, y: 5.72, w: 10.6, h: 1.05, valign: 'middle', fontFace: KO, fontSize: 13, lineSpacing: 19, margin: 0 });
    s.addNotes('설치가 부담이라 느끼는 분에게는 브라우저만으로도 전부 쓸 수 있다는 점을 강조하세요. 다만 폰 앱은 알림 때문에 꼭 필요합니다.');
  }

  // ==============================================  10. 한 줄 설명 + 용어
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '처음 쓰는 사람을 위한 설명');
    title(s, '두레이가 대체 뭔가요?');

    card(s, 0.65, 1.62, 12.03, 1.45, NAVY);
    await iconDot(s, 1.05, 2.02, 0.66, MID, 'FiMessageCircle', AMBER);
    s.addText('“우리 팀 전용 게시판인데, 글마다 마감일이 붙어 있고,\n마감이 다가오면 폰으로 알림이 오는 서비스”', {
      x: 1.95, y: 1.62, w: 10.4, h: 1.45, valign: 'middle', fontFace: KO, fontSize: 17, bold: true, color: WHITE, lineSpacing: 27, margin: 0
    });

    s.addText('알아야 할 단어는 딱 세 개뿐입니다.', {
      x: 0.65, y: 3.28, w: 11.9, h: 0.34, fontFace: KO, fontSize: 14, color: MUTED, margin: 0
    });

    const terms = [
      ['FiFolder', '프로젝트', '우리 팀 게시판', '하나만 만들면 됩니다. 팀 전체가 이 안에서 모든 업무를 봅니다.'],
      ['FiFileText', '업무', '게시판의 글 하나 = 내가 맡은 일 하나', '“7월 정산 보고서”처럼 일 단위로 하나씩 만듭니다.'],
      ['FiList', '하위 업무', '그 일의 단계별 체크리스트', '시작 → 중간점검 1 → 중간점검 2 → 완료, 네 개를 만듭니다.']
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.63 + i * 4.14;
      card(s, x, 3.75, 3.8, 2.85);
      await iconDot(s, x + 0.42, 4.08, 0.66, ICE, terms[i][0], NAVY);
      s.addText(terms[i][1], { x: x + 1.22, y: 4.14, w: 2.2, h: 0.42, valign: 'middle', fontFace: KO, fontSize: 19, bold: true, color: NAVY, margin: 0 });
      s.addText('우리말로 하면', { x: x + 0.42, y: 4.92, w: 3.0, h: 0.26, fontFace: KO, fontSize: 10.5, bold: true, color: AMBER, charSpacing: 1, margin: 0 });
      s.addText(terms[i][2], { x: x + 0.42, y: 5.2, w: 2.98, h: 0.6, fontFace: KO, fontSize: 13.5, bold: true, color: BODY, lineSpacing: 19, margin: 0 });
      s.addText(terms[i][3], { x: x + 0.42, y: 5.85, w: 2.98, h: 0.62, fontFace: KO, fontSize: 11, color: MUTED, lineSpacing: 15, margin: 0 });
    }
    s.addNotes('용어를 세 개로 줄여서 설명하는 것이 중요합니다. 처음 쓰는 사람은 화면의 모든 메뉴를 이해할 필요가 없습니다.');
  }

  // ==============================================  11. 초기 설정
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '1단계 · 최초 1회');
    title(s, '처음 딱 한 번만 하는 설정');
    s.addShape(pres.ShapeType.roundRect, { x: 9.05, y: 0.82, w: 3.6, h: 0.55, rectRadius: 0.27, fill: { color: NAVY } });
    s.addText('대표 1명이 · 약 30분', { x: 9.05, y: 0.82, w: 3.6, h: 0.55, align: 'center', valign: 'middle', fontFace: KO, fontSize: 13, bold: true, color: AMBER, margin: 0 });

    const steps = [
      ['가입하고 팀 공간 만들기', 'dooray.com에서 무료로 가입한 뒤, 우리 팀이 쓸 공간을 하나 만듭니다.'],
      ['나머지 2명 초대하기', '팀원의 이메일 주소로 초대를 보냅니다. 받은 사람은 메일 속 링크만 누르면 가입이 끝납니다.'],
      ['프로젝트 1개 만들기', '이름은 “팀 업무” 정도면 충분합니다. 여러 개 만들지 말고 하나로 시작하세요.'],
      ['3명 모두 폰 앱 설치', '앱을 깔고 로그인한 뒤 알림 허용을 켭니다. 이 단계를 빠뜨리면 도입 효과가 절반이 됩니다.']
    ];
    const cx = [2.07, 5.09, 8.11, 11.13], d = 0.88;
    s.addShape(pres.ShapeType.rect, { x: cx[0], y: 2.16 + d / 2 - 0.015, w: cx[3] - cx[0], h: 0.03, fill: { color: LINE } });
    for (let i = 0; i < 4; i++) {
      const x = cx[i] - d / 2;
      s.addShape(pres.ShapeType.ellipse, { x, y: 2.16, w: d, h: d, fill: { color: i === 3 ? AMBER : NAVY }, shadow: sh() });
      s.addText(String(i + 1), { x, y: 2.16, w: d, h: d, align: 'center', valign: 'middle', fontFace: 'Arial', fontSize: 26, bold: true, color: i === 3 ? NAVY : WHITE, margin: 0 });
      card(s, cx[i] - 1.42, 3.38, 2.84, 2.5);
      s.addText(steps[i][0], { x: cx[i] - 1.16, y: 3.62, w: 2.32, h: 0.7, fontFace: KO, fontSize: 14.5, bold: true, color: NAVY, lineSpacing: 20, margin: 0 });
      s.addText(steps[i][1], { x: cx[i] - 1.16, y: 4.38, w: 2.32, h: 1.32, fontFace: KO, fontSize: 11.5, color: BODY, lineSpacing: 17, margin: 0 });
    }
    s.addText('이후에는 이 설정을 다시 할 일이 없습니다. 팀원이 바뀌면 2번(초대)만 다시 하면 됩니다.', {
      x: 0.65, y: 6.28, w: 11.9, h: 0.4, fontFace: KO, fontSize: 12.5, color: MUTED, italic: true, margin: 0
    });
    s.addNotes('설정은 대표 한 명만 하면 되고 30분이면 끝납니다. 나머지 두 명은 초대 메일 링크를 누르고 폰 앱만 깔면 됩니다.');
  }

  // ==============================================  12. 업무 등록
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '2단계 · 일을 새로 맡았을 때');
    title(s, '업무 등록하기 (1건당 3분)');

    const how = [
      ['[업무 추가]를 누르고 제목 입력', '예 : “7월 정산 보고서”'],
      ['담당자는 본인, 참조자는 팀원 전원', '참조자로 들어가 있어야 서로의 일정 알림을 다 같이 받습니다. 우리 팀 규칙의 핵심입니다.'],
      ['하위 업무 4개에 각각 날짜 지정', '시작 · 중간점검 1 · 중간점검 2 · 완료 순서로 만들고 마감일을 넣습니다.']
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.72 + i * 1.62;
      card(s, 0.65, y, 5.85, 1.44);
      s.addShape(pres.ShapeType.ellipse, { x: 0.98, y: y + 0.45, w: 0.54, h: 0.54, fill: { color: NAVY } });
      s.addText(String(i + 1), { x: 0.98, y: y + 0.45, w: 0.54, h: 0.54, align: 'center', valign: 'middle', fontFace: 'Arial', fontSize: 17, bold: true, color: AMBER, margin: 0 });
      s.addText(how[i][0], { x: 1.74, y: y + 0.24, w: 4.5, h: 0.34, fontFace: KO, fontSize: 14.5, bold: true, color: NAVY, margin: 0 });
      s.addText(how[i][1], { x: 1.74, y: y + 0.62, w: 4.5, h: 0.68, fontFace: KO, fontSize: 11.5, color: BODY, lineSpacing: 16, margin: 0 });
    }

    // mock task card
    card(s, 6.95, 1.72, 5.73, 4.84, WHITE);
    s.addText('실제로는 이렇게 보입니다', { x: 7.3, y: 1.95, w: 5.0, h: 0.3, fontFace: KO, fontSize: 11, bold: true, color: AMBER, charSpacing: 1, margin: 0 });
    s.addText('7월 정산 보고서', { x: 7.3, y: 2.3, w: 5.0, h: 0.4, fontFace: KO, fontSize: 20, bold: true, color: NAVY, margin: 0 });
    s.addText('담당자  김○○      참조자  이○○, 박○○', { x: 7.3, y: 2.76, w: 5.0, h: 0.3, fontFace: KO, fontSize: 11.5, color: MUTED, margin: 0 });
    s.addShape(pres.ShapeType.rect, { x: 7.3, y: 3.16, w: 5.03, h: 0.02, fill: { color: LINE } });

    const subs = [['시작', '8 / 1', true], ['중간점검 1', '8 / 5', true], ['중간점검 2', '8 / 8', false], ['완료', '8 / 12', false]];
    for (let i = 0; i < 4; i++) {
      const y = 3.36 + i * 0.72;
      s.addShape(pres.ShapeType.roundRect, { x: 7.3, y, w: 5.03, h: 0.6, rectRadius: 0.08, fill: { color: subs[i][2] ? ICE : BG } });
      await iconDot(s, 7.46, y + 0.11, 0.38, subs[i][2] ? NAVY : LINE, subs[i][2] ? 'FiCheck' : 'FiSquare', subs[i][2] ? AMBER : MUTED);
      s.addText(subs[i][0], { x: 8.0, y, w: 2.9, h: 0.6, valign: 'middle', fontFace: KO, fontSize: 13.5, bold: subs[i][2], color: subs[i][2] ? NAVY : BODY, margin: 0 });
      s.addText(subs[i][1], { x: 10.9, y, w: 1.25, h: 0.6, align: 'right', valign: 'middle', fontFace: 'Arial', fontSize: 13, bold: true, color: subs[i][2] ? NAVY : MUTED, margin: 0 });
    }
    s.addText('체크한 두 단계는 이미 통과, 남은 두 단계는 날짜가 되면 전원에게 알림이 갑니다.', {
      x: 0.65, y: 6.72, w: 12.03, h: 0.36, fontFace: KO, fontSize: 12, color: MUTED, italic: true, margin: 0
    });
    s.addNotes('참조자에 팀원 전원을 넣는 것이 가장 중요합니다. 이걸 빠뜨리면 알림이 담당자에게만 가서 도입 목적이 사라집니다.');
  }

  // ==============================================  13. 매일 하는 것
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '3단계 · 매일');
    title(s, '매일 하는 것은 이게 전부입니다');

    card(s, 0.65, 1.75, 4.0, 4.5, NAVY);
    s.addText([
      { text: '1', options: { fontFace: 'Arial', fontSize: 72, bold: true, color: AMBER } },
      { text: '분', options: { fontFace: KO, fontSize: 34, bold: true, color: AMBER } }
    ], { x: 0.95, y: 2.55, w: 3.4, h: 1.3, align: 'center', valign: 'middle', margin: 0 });
    s.addText('하루에 드는 시간', { x: 0.95, y: 3.95, w: 3.4, h: 0.35, align: 'center', fontFace: KO, fontSize: 16, bold: true, color: WHITE, margin: 0 });
    s.addText('입력이 번거로우면\n이런 도구는 반드시 죽습니다.\n그래서 할 일을 최소로 줄였습니다.', {
      x: 0.95, y: 4.6, w: 3.4, h: 1.1, align: 'center', fontFace: KO, fontSize: 11.5, color: ICE, lineSpacing: 18, margin: 0
    });

    const daily = [
      ['FiSun', '아침에 확인한다', '폰 알림을 보거나 프로젝트 화면을 열어, 오늘 날짜가 된 단계가 있는지 봅니다.'],
      ['FiCheckCircle', '끝낸 단계는 바로 체크한다', '해당 하위 업무의 체크박스를 누릅니다. 이 체크가 팀 전체에 대한 보고를 대신합니다.'],
      ['FiMessageSquare', '밀리면 댓글 한 줄', '“원천 데이터가 늦어져 중간점검 1을 8/7로 미룹니다” 정도면 충분합니다.']
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.75 + i * 1.55;
      card(s, 4.95, y, 7.73, 1.38);
      await iconDot(s, 5.28, y + 0.36, 0.66, ICE, daily[i][0], NAVY);
      s.addText(daily[i][1], { x: 6.16, y: y + 0.24, w: 6.2, h: 0.34, fontFace: KO, fontSize: 16, bold: true, color: NAVY, margin: 0 });
      s.addText(daily[i][2], { x: 6.16, y: y + 0.62, w: 6.2, h: 0.6, fontFace: KO, fontSize: 12, color: BODY, lineSpacing: 17, margin: 0 });
    }
    s.addText('체크를 미루면 팀원 모두의 화면에 “아직 안 됨”으로 남습니다. 그게 이 도구의 압력입니다.', {
      x: 0.65, y: 6.5, w: 12.03, h: 0.4, fontFace: KO, fontSize: 12.5, color: MUTED, italic: true, margin: 0
    });
    s.addNotes('하루 1분이면 충분하다는 점을 강조하세요. 부담이 크다고 느끼는 순간 아무도 쓰지 않게 됩니다.');
  }

  // ==============================================  14. 팀 규칙
  {
    const s = pres.addSlide();
    darkBg(s);
    kicker(s, '운영 규칙');
    title(s, '이 세 줄만 지키면 굴러갑니다', WHITE);

    const rules = [
      ['01', '기록에 없는 일은\n없는 일이다', '맡은 일은 예외 없이 업무로 등록합니다. 머릿속에만 있는 일은 관리 대상이 아닙니다.'],
      ['02', '참조자는\n항상 전원', '업무를 만들 때 팀원 모두를 참조자로 넣습니다. 서로가 서로의 리마인더가 됩니다.'],
      ['03', '체크는 본인이,\n끝낸 그날에', '단계를 마친 날 바로 완료 처리합니다. 몰아서 하면 기록이 사실과 달라집니다.']
    ];
    for (let i = 0; i < 3; i++) {
      const x = 0.63 + i * 4.14;
      s.addShape(pres.ShapeType.roundRect, { x, y: 1.95, w: 3.8, h: 4.2, rectRadius: 0.10, fill: { color: DEEP } });
      s.addText(rules[i][0], { x: x + 0.42, y: 2.25, w: 2.0, h: 0.95, fontFace: 'Arial', fontSize: 50, bold: true, color: AMBER, margin: 0 });
      s.addText(rules[i][1], { x: x + 0.42, y: 3.35, w: 3.0, h: 1.1, fontFace: KO, fontSize: 20, bold: true, color: WHITE, lineSpacing: 28, margin: 0 });
      s.addText(rules[i][2], { x: x + 0.42, y: 4.62, w: 2.98, h: 1.2, fontFace: KO, fontSize: 12, color: ICE, lineSpacing: 18, margin: 0 });
    }
    s.addText('규칙은 짧아야 지켜집니다. 이 세 줄을 프로젝트 설명란에 그대로 적어 두세요.', {
      x: 0.65, y: 6.42, w: 12.03, h: 0.4, fontFace: KO, fontSize: 12.5, color: MUTED, italic: true, margin: 0
    });
    s.addNotes('규칙을 늘리지 마세요. 세 줄이 넘어가면 아무도 기억하지 못합니다.');
  }

  // ==============================================  15. 빈틈과 보완
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '미리 알고 시작하기');
    title(s, '그래도 남는 빈틈, 그리고 메우는 법');

    const pairs = [
      ['방치 감지가 없다', '마감 전까지는 담당자가 며칠을 손대지 않아도 아무 알림이 없습니다.',
       '주 1회 정례 점검', '월요일 아침 10분, 프로젝트 화면을 함께 보며 지난주에 움직이지 않은 업무를 짚습니다.'],
      ['참조자 등록은 사람이 한다', '전원을 참조자로 넣는 것을 시스템이 강제하지는 않습니다.',
       '업무 템플릿 활용', '참조자가 미리 채워진 템플릿으로 업무를 만들면 빠뜨릴 일이 줄어듭니다.']
    ];
    for (let i = 0; i < 2; i++) {
      const y = 1.72 + i * 2.3;
      card(s, 0.65, y, 5.35, 2.05, WHITE);
      await iconDot(s, 1.0, y + 0.28, 0.58, AMBER, 'FiAlertTriangle', NAVY);
      s.addText('빈틈', { x: 1.75, y: y + 0.42, w: 2.0, h: 0.3, valign: 'middle', fontFace: KO, fontSize: 11, bold: true, color: AMBER, charSpacing: 1, margin: 0 });
      s.addText(pairs[i][0], { x: 1.0, y: y + 0.96, w: 4.6, h: 0.34, fontFace: KO, fontSize: 15.5, bold: true, color: NAVY, margin: 0 });
      s.addText(pairs[i][1], { x: 1.0, y: y + 1.34, w: 4.6, h: 0.58, fontFace: KO, fontSize: 11.5, color: BODY, lineSpacing: 16, margin: 0 });
    }
    // arrows + solution cards (separate loop to keep option objects fresh)
    for (let i = 0; i < 2; i++) {
      const y = 1.72 + i * 2.3;
      await iconDot(s, 6.2, y + 0.83, 0.42, BG, 'FiArrowRight', NAVY);
      card(s, 6.88, y, 5.8, 2.05, NAVY);
      await iconDot(s, 7.23, y + 0.28, 0.58, MID, 'FiCheckCircle', AMBER);
      s.addText('보완책', { x: 7.98, y: y + 0.42, w: 2.0, h: 0.3, valign: 'middle', fontFace: KO, fontSize: 11, bold: true, color: AMBER, charSpacing: 1, margin: 0 });
      s.addText(pairs[i][2], { x: 7.23, y: y + 0.96, w: 5.1, h: 0.34, fontFace: KO, fontSize: 15.5, bold: true, color: WHITE, margin: 0 });
      s.addText(pairs[i][3], { x: 7.23, y: y + 1.34, w: 5.1, h: 0.58, fontFace: KO, fontSize: 11.5, color: ICE, lineSpacing: 16, margin: 0 });
    }
    card(s, 0.65, 6.32, 12.03, 0.82, WHITE);
    s.addText([
      { text: '나중을 위한 여지 : ', options: { bold: true, color: NAVY } },
      { text: '아침 7시 전체 요약과 방치 감지가 정말 아쉬워지면, 그때 두레이의 자료를 읽어 알림만 보내 주는 스크립트를 붙이면 됩니다. (개발 1~2일)', options: { color: BODY } }
    ], { x: 1.0, y: 6.32, w: 11.35, h: 0.82, valign: 'middle', fontFace: KO, fontSize: 12.5, margin: 0 });
    s.addNotes('빈틈을 숨기지 말고 미리 알리는 편이 낫습니다. 나중에 스크립트로 보완할 수 있는 경로도 열려 있습니다.');
  }

  // ==============================================  16. 다음 단계
  {
    const s = pres.addSlide();
    lightBg(s);
    kicker(s, '다음 단계');
    title(s, '무엇부터 하면 되는가');

    const road = [
      ['이번 주', '두레이 가입 · 팀원 초대 · 프로젝트 1개 생성 · 3명 폰 앱 설치'],
      ['다음 주', '진행 중인 업무를 전부 등록하고 4단계 일정을 채워 넣기'],
      ['한 달 후', '실제로 지켜지는지 점검하고, 알림 빈도와 규칙을 팀에 맞게 조정']
    ];
    for (let i = 0; i < 3; i++) {
      const y = 1.72 + i * 1.42;
      card(s, 0.65, y, 7.2, 1.24);
      s.addShape(pres.ShapeType.roundRect, { x: 0.95, y: y + 0.34, w: 1.32, h: 0.56, rectRadius: 0.09, fill: { color: i === 0 ? AMBER : NAVY } });
      s.addText(road[i][0], { x: 0.95, y: y + 0.34, w: 1.32, h: 0.56, align: 'center', valign: 'middle', fontFace: KO, fontSize: 12.5, bold: true, color: i === 0 ? NAVY : WHITE, margin: 0 });
      s.addText(road[i][1], { x: 2.45, y: y + 0.18, w: 5.15, h: 0.9, valign: 'middle', fontFace: KO, fontSize: 12.5, color: BODY, lineSpacing: 18, margin: 0 });
    }

    card(s, 8.15, 1.72, 4.53, 3.94, NAVY);
    s.addText('오늘 정해야 할 것', { x: 8.5, y: 2.05, w: 3.9, h: 0.4, fontFace: KO, fontSize: 18, bold: true, color: WHITE, margin: 0 });
    const decide = ['두레이로 확정할지 여부', '3명의 가입용 이메일 주소', '주간 정례 점검 요일과 시간', '업무 등록을 언제까지 마칠지'];
    for (let i = 0; i < decide.length; i++) {
      const y = 2.68 + i * 0.7;
      await iconDot(s, 8.5, y, 0.36, MID, 'FiSquare', AMBER);
      s.addText(decide[i], { x: 9.02, y: y - 0.06, w: 3.45, h: 0.48, valign: 'middle', fontFace: KO, fontSize: 12.5, color: ICE, lineSpacing: 17, margin: 0 });
    }

    card(s, 0.65, 6.18, 12.03, 0.95, WHITE);
    s.addText('도구는 완벽해서 쓰는 것이 아니라, 계속 쓰기 때문에 효과가 생깁니다.', {
      x: 1.0, y: 6.18, w: 11.35, h: 0.95, valign: 'middle', fontFace: KO, fontSize: 14.5, bold: true, color: NAVY, margin: 0
    });
    s.addNotes('오늘 결정할 것은 네 가지뿐입니다. 확정되면 바로 이번 주에 가입과 초대를 진행합니다.');
  }

  await pres.writeFile({ fileName: '/tmp/claude-0/-home-user-upbit/44a0889b-21f8-5b06-85db-dd3881dc30dd/scratchpad/team-task-planner.pptx' });
  console.log('DONE');
}

main().catch(e => { console.error(e); process.exit(1); });
