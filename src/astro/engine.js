import SwissEPH from 'sweph-wasm';
import cities from './cities.json';

let swe = null;

const PLANETS = [
  [0,'太陽'], [1,'月'], [2,'水星'], [3,'金星'], [4,'火星'],
  [5,'木星'], [6,'土星'], [7,'天王星'], [8,'海王星'], [9,'冥王星'],
  [11,'Nノード']
];
const OPTIONAL_BODIES = [
  [15,'キロン'], [12,'リリス'], [17,'セレス'],
  [18,'パラス'], [19,'ジュノー'], [20,'ヴェスタ'],
];
const OUTER_PLANETS = [
  [2,'水星'], [3,'金星'], [4,'火星'],
  [5,'木星'], [6,'土星'], [7,'天王星'], [8,'海王星'], [9,'冥王星']
];
const TRANSIT_PLANETS = [[5,'木星'], [6,'土星'], [7,'天王星'], [8,'海王星'], [9,'冥王星']];
const SIGNS = ['牡羊','牡牛','双子','蟹','獅子','乙女','天秤','蠍','射手','山羊','水瓶','魚'];
const ASPECT_SYMBOLS = { 0:'☌', 60:'⚹', 90:'□', 120:'△', 180:'☍' };
const ORB = 5;
const TRANSIT_ORB = 1;
const SYNASTRY_ORB = 3;

function fmt(deg) {
  const s = Math.floor(deg / 30);
  const d = Math.floor(deg % 30);
  const m = Math.floor((deg % 1) * 60);
  return `${SIGNS[s]}座 ${d}°${String(m).padStart(2,'0')}`;
}

function fmtShort(deg) {
  const s = Math.floor(deg / 30);
  const d = Math.floor(deg % 30);
  return `${SIGNS[s]}${d}°`;
}

function signOf(deg) {
  return Math.floor(deg / 30);
}

function getAspect(deg1, deg2, orb = ORB) {
  let diff = Math.abs(deg1 - deg2);
  if (diff > 180) diff = 360 - diff;
  for (const [angle, symbol] of Object.entries(ASPECT_SYMBOLS)) {
    const o = Math.abs(diff - Number(angle));
    if (o <= orb) return { symbol, orb: o, angle: Number(angle) };
  }
  return null;
}

function getHouse(lon, cusps) {
  for (let i = 1; i <= 12; i++) {
    const start = cusps[i];
    const end = i === 12 ? cusps[1] : cusps[i + 1];
    const houseSpan = ((end - start) % 360 + 360) % 360;
    const planetDist = ((lon - start) % 360 + 360) % 360;
    if (planetDist < houseSpan) return i;
  }
  return 1;
}

function jdToDate(jd) {
  const r = swe.swe_revjul(jd, 1);
  return `${r.month}/${r.day}`;
}

export function getCities() { return cities; }

export async function initSweph() {
  if (swe) return swe;
  swe = await SwissEPH.init();
  await swe.swe_set_ephe_path();
  return swe;
}

export function isReady() { return swe !== null; }

/**
 * 場所を解決する共通ヘルパー
 * { pref, cityName } または { lat, lng } を受け取り { lat, lng, label } を返す
 */
function resolveLocation(input) {
  if (input.lat != null && input.lng != null) {
    return { lat: input.lat, lng: input.lng, label: `緯度${input.lat}°, 経度${input.lng}°` };
  }
  const city = cities[input.pref]?.find(c => c.name === input.cityName);
  if (!city) throw new Error(`都市が見つかりません: ${input.pref} ${input.cityName}`);
  return { lat: city.lat, lng: city.lng, label: `${input.pref}${input.cityName}` };
}

/**
 * ネイタル計算
 * optionalBodies: { chiron, lilith, ceres, pallas, juno, vesta } のうち true のもの
 */
export function calcNatal({ year, month, day, hour, minute, pref, cityName, lat, lng, utcOffset, optionalBodies }) {
  const loc = resolveLocation({ pref, cityName, lat, lng });
  const offset = utcOffset != null ? utcOffset : 9;

  const utcHour = hour - offset + minute / 60;
  const jd = swe.swe_julday(year, month, day, utcHour, 1);
  const houses = swe.swe_houses(jd, loc.lat, loc.lng, 'P');

  const positions = [];
  let output = `【ネイタル】${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} ${loc.label}\nハウス: プラシーダス\n\n`;

  // メイン天体
  for (const [id, name] of PLANETS) {
    const r = swe.swe_calc_ut(jd, id, 256);
    const lon = r[0], spd = r[3];
    const house = getHouse(lon, houses.cusps);
    positions.push({ id, name, lon, spd, house });
    output += `${name} ${fmt(lon)} (${house}H)${spd < 0 ? ' R' : ''}\n`;
  }

  // オプション小惑星
  const optPositions = [];
  if (optionalBodies) {
    const bodyMap = { chiron: 15, lilith: 12, ceres: 17, pallas: 18, juno: 19, vesta: 20 };
    const activeIds = Object.entries(bodyMap).filter(([key]) => optionalBodies[key]).map(([, id]) => id);
    if (activeIds.length > 0) {
      output += `\n`;
      for (const [id, name] of OPTIONAL_BODIES) {
        if (!activeIds.includes(id)) continue;
        const r = swe.swe_calc_ut(jd, id, 256);
        const lon = r[0], spd = r[3];
        const house = getHouse(lon, houses.cusps);
        const pos = { id, name, lon, spd, house, optional: true };
        optPositions.push(pos);
        output += `${name} ${fmt(lon)} (${house}H)${spd < 0 ? ' R' : ''}\n`;
      }
    }
  }

  const asc = houses.ascmc[0];
  const mc = houses.ascmc[1];
  output += `\nASC ${fmt(asc)} / MC ${fmt(mc)}\n\n`;

  const allPositions = [...positions, ...optPositions];
  const aspects = [];
  for (let i = 0; i < allPositions.length; i++) {
    for (let j = i + 1; j < allPositions.length; j++) {
      const asp = getAspect(allPositions[i].lon, allPositions[j].lon);
      if (asp) aspects.push(`${allPositions[i].name}${asp.symbol}${allPositions[j].name}(${asp.orb.toFixed(0)}°)`);
    }
  }
  output += aspects.join(' / ');

  return { output, positions, optPositions, angles: { asc, mc }, houses, loc };
}

/**
 * 年間運行概要
 */
export function calcYearly({ year, natalPositions, natalAngles }) {
  let output = `【${year}年 天体運行概要】\n\n`;
  output += `■ ネイタル（参照用）\n`;
  output += natalPositions.map(p => `${p.name} ${fmtShort(p.lon)}(${p.house}H)`).join(' / ') + '\n';
  output += `ASC ${fmtShort(natalAngles.asc)} / MC ${fmtShort(natalAngles.mc)}\n\n`;

  const startJd = swe.swe_julday(year, 1, 1, 0, 1);
  const endJd = swe.swe_julday(year, 12, 31, 0, 1);
  output += calcYearlyRange(startJd, endJd, natalPositions, natalAngles);

  return output;
}

function calcYearlyRange(startJd, endJd, natalPositions, natalAngles) {
  let output = '';

  const retrograde = {};
  for (const [id, name] of OUTER_PLANETS) {
    retrograde[id] = { name, periods: [], inRetro: false, start: null };
  }

  const ingresses = [];
  const prevSigns = {};

  const transitAspects = {};
  for (const [tId, tName] of TRANSIT_PLANETS) {
    for (const n of natalPositions) {
      const key = `t.${tName}→n.${n.name}`;
      transitAspects[key] = { periods: [], inAspect: false, start: null, symbol: null, house: n.house };
    }
  }

  const angleTransits = {
    'ASC': { lon: natalAngles.asc, periods: [], current: {} },
    'MC': { lon: natalAngles.mc, periods: [], current: {} }
  };
  for (const [tId, tName] of TRANSIT_PLANETS) {
    angleTransits['ASC'].current[tName] = { inAspect: false, start: null, symbol: null };
    angleTransits['MC'].current[tName] = { inAspect: false, start: null, symbol: null };
  }

  for (let jd = startJd; jd <= endJd; jd += 1) {
    for (const [id, name] of OUTER_PLANETS) {
      const r = swe.swe_calc_ut(jd, id, 256);
      const lon = r[0], spd = r[3];
      const sign = signOf(lon);

      const retro = retrograde[id];
      if (spd < 0 && !retro.inRetro) { retro.inRetro = true; retro.start = jd; }
      else if (spd >= 0 && retro.inRetro) { retro.inRetro = false; retro.periods.push([retro.start, jd]); }

      if ([5,6,7,8,9].includes(id)) {
        if (prevSigns[id] !== undefined && prevSigns[id] !== sign) ingresses.push({ jd, name, sign });
        prevSigns[id] = sign;
      }
    }

    for (const [tId, tName] of TRANSIT_PLANETS) {
      const tr = swe.swe_calc_ut(jd, tId, 256);
      const tLon = tr[0];

      for (const n of natalPositions) {
        const key = `t.${tName}→n.${n.name}`;
        const asp = getAspect(tLon, n.lon, TRANSIT_ORB);
        const ta = transitAspects[key];
        if (asp && !ta.inAspect) { ta.inAspect = true; ta.start = jd; ta.symbol = asp.symbol; }
        else if (!asp && ta.inAspect) { ta.inAspect = false; ta.periods.push({ start: ta.start, end: jd, symbol: ta.symbol }); }
      }

      for (const angleName of ['ASC', 'MC']) {
        const angle = angleTransits[angleName];
        const asp = getAspect(tLon, angle.lon, TRANSIT_ORB);
        const cur = angle.current[tName];
        if (asp && !cur.inAspect) { cur.inAspect = true; cur.start = jd; cur.symbol = asp.symbol; }
        else if (!asp && cur.inAspect) { cur.inAspect = false; angle.periods.push({ planet: tName, start: cur.start, end: jd, symbol: cur.symbol }); }
      }
    }
  }

  // 未閉じ区間をクローズ
  for (const [id] of OUTER_PLANETS) { const r = retrograde[id]; if (r.inRetro) r.periods.push([r.start, endJd]); }
  for (const key of Object.keys(transitAspects)) { const ta = transitAspects[key]; if (ta.inAspect) ta.periods.push({ start: ta.start, end: endJd, symbol: ta.symbol }); }
  for (const angleName of ['ASC', 'MC']) {
    for (const [, tName] of TRANSIT_PLANETS) {
      const cur = angleTransits[angleName].current[tName];
      if (cur.inAspect) angleTransits[angleName].periods.push({ planet: tName, start: cur.start, end: endJd, symbol: cur.symbol });
    }
  }

  output += `■ 逆行期間\n`;
  for (const [id, name] of OUTER_PLANETS) {
    const r = retrograde[id];
    output += r.periods.length === 0 ? `${name}: なし\n` : `${name}: ${r.periods.map(([s, e]) => `${jdToDate(s)}-${jdToDate(e)}`).join(', ')}\n`;
  }

  output += `\n■ 星座イングレス\n`;
  if (ingresses.length === 0) output += `なし\n`;
  else for (const ing of ingresses) output += `${ing.name}: ${jdToDate(ing.jd)} ${SIGNS[ing.sign]}座入り\n`;

  output += `\n■ ASC/MCへのトランジット\n`;
  let hasAngle = false;
  for (const angleName of ['ASC', 'MC']) {
    for (const p of angleTransits[angleName].periods) { hasAngle = true; output += `t.${p.planet}${p.symbol}n.${angleName}: ${jdToDate(p.start)}-${jdToDate(p.end)}\n`; }
  }
  if (!hasAngle) output += `なし\n`;

  output += `\n■ ネイタル天体へのトランジット\n`;
  let hasTransit = false;
  for (const [, tName] of TRANSIT_PLANETS) {
    for (const n of natalPositions) {
      const key = `t.${tName}→n.${n.name}`;
      const ta = transitAspects[key];
      if (ta.periods.length > 0) { hasTransit = true; output += `t.${tName}→n.${n.name}(${ta.house}H): ${ta.periods.map(p => `${p.symbol}${jdToDate(p.start)}-${jdToDate(p.end)}`).join(', ')}\n`; }
    }
  }
  if (!hasTransit) output += `なし\n`;

  return output;
}

/**
 * トランジット（日運）
 */
export function calcTransit({ year, month, day, natalPositions, natalAngles, optionalBodies }) {
  const jd = swe.swe_julday(year, month, day, 12 - 9, 1);

  let output = `【トランジット】${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}\n\n`;
  output += `■ ネイタル（参照用）\n`;
  output += natalPositions.map(p => `${p.name} ${fmtShort(p.lon)}(${p.house}H)`).join(' / ') + '\n';
  output += `ASC ${fmtShort(natalAngles.asc)} / MC ${fmtShort(natalAngles.mc)}\n\n`;

  output += `■ トランジット天体\n`;
  const transitPos = [];
  for (const [id, name] of PLANETS) {
    const r = swe.swe_calc_ut(jd, id, 256);
    transitPos.push({ id, name, lon: r[0], spd: r[3] });
    output += `${name} ${fmt(r[0])}${r[3] < 0 ? ' R' : ''}\n`;
  }

  // 小惑星のトランジット位置
  if (optionalBodies) {
    const bodyMap = { chiron: 15, lilith: 12, ceres: 17, pallas: 18, juno: 19, vesta: 20 };
    const activeIds = Object.entries(bodyMap).filter(([key]) => optionalBodies[key]).map(([, id]) => id);
    if (activeIds.length > 0) {
      output += `\n`;
      for (const [id, name] of OPTIONAL_BODIES) {
        if (!activeIds.includes(id)) continue;
        const r = swe.swe_calc_ut(jd, id, 256);
        transitPos.push({ id, name, lon: r[0], spd: r[3] });
        output += `${name} ${fmt(r[0])}${r[3] < 0 ? ' R' : ''}\n`;
      }
    }
  }

  output += `\n■ ネイタルへのアスペクト\n`;
  const aspects = [];
  for (const t of transitPos) {
    for (const n of natalPositions) {
      const asp = getAspect(t.lon, n.lon, TRANSIT_ORB);
      if (asp) aspects.push(`t.${t.name}${asp.symbol}n.${n.name}(${n.house}H)`);
    }
    const aspAsc = getAspect(t.lon, natalAngles.asc, TRANSIT_ORB);
    if (aspAsc) aspects.push(`t.${t.name}${aspAsc.symbol}n.ASC`);
    const aspMc = getAspect(t.lon, natalAngles.mc, TRANSIT_ORB);
    if (aspMc) aspects.push(`t.${t.name}${aspMc.symbol}n.MC`);
  }
  output += aspects.length === 0 ? 'なし\n' : aspects.join(' / ');

  return output;
}

/**
 * ルナリターン（月運）
 */
export function calcLunarReturn({ year, month, pref, cityName, lat, lng, natalPositions, natalAngles, optionalBodies }) {
  const loc = resolveLocation({ pref, cityName, lat, lng });

  const natalMoon = natalPositions.find(p => p.name === '月').lon;
  let jd = swe.swe_julday(year, month, 1, 0, 1);
  const endJd = swe.swe_julday(year, month + 1, 1, 0, 1);

  const returns = [];
  let prevDiff = null;
  for (; jd < endJd; jd += 0.25) {
    const r = swe.swe_calc_ut(jd, 1, 256);
    let diff = r[0] - natalMoon;
    if (diff > 180) diff -= 360;
    if (diff < -180) diff += 360;
    if (prevDiff !== null && prevDiff < 0 && diff >= 0) {
      let lo = jd - 0.25, hi = jd;
      for (let i = 0; i < 20; i++) {
        const mid = (lo + hi) / 2;
        const rm = swe.swe_calc_ut(mid, 1, 256);
        let d = rm[0] - natalMoon;
        if (d > 180) d -= 360;
        if (d < -180) d += 360;
        if (d < 0) lo = mid; else hi = mid;
      }
      returns.push((lo + hi) / 2);
    }
    prevDiff = diff;
  }

  if (returns.length === 0) return `${year}年${month}月のルナリターンが見つかりませんでした`;

  let output = '';
  for (let i = 0; i < returns.length; i++) {
    const returnJd = returns[i];
    const jstJd = returnJd + 9 / 24;
    const dt = swe.swe_revjul(jstJd, 1);
    const h = Math.floor(dt.hour);
    const m = Math.floor((dt.hour - h) * 60);

    output += returns.length > 1 ? `【ルナリターン ${i + 1}】` : `【ルナリターン】`;
    output += `${dt.year}-${String(dt.month).padStart(2,'0')}-${String(dt.day).padStart(2,'0')} ${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')} JST\n`;
    output += `場所: ${loc.label}\nネイタル月: ${fmt(natalMoon)}\nハウス: プラシーダス\n\n`;

    const houses = swe.swe_houses(returnJd, loc.lat, loc.lng, 'P');
    output += `■ 天体\n`;
    const lrBodies = [...PLANETS];
    if (optionalBodies) {
      const bodyMap = { chiron: 15, lilith: 12, ceres: 17, pallas: 18, juno: 19, vesta: 20 };
      for (const [id, name] of OPTIONAL_BODIES) {
        if (optionalBodies[Object.entries(bodyMap).find(([, v]) => v === id)?.[0]]) lrBodies.push([id, name]);
      }
    }
    for (const [id, name] of lrBodies) {
      const r = swe.swe_calc_ut(returnJd, id, 256);
      const house = getHouse(r[0], houses.cusps);
      output += `${name} ${fmt(r[0])} (${house}H)${r[3] < 0 ? ' R' : ''}\n`;
    }
    output += `\nASC ${fmt(houses.ascmc[0])} / MC ${fmt(houses.ascmc[1])}\n`;

    output += `\n■ ネイタルへのアスペクト\n`;
    const aspects = [];
    for (const [id, name] of lrBodies) {
      const r = swe.swe_calc_ut(returnJd, id, 256);
      for (const n of natalPositions) {
        const asp = getAspect(r[0], n.lon, TRANSIT_ORB);
        if (asp) aspects.push(`LR.${name}${asp.symbol}n.${n.name}(${n.house}H)`);
      }
      const aspAsc = getAspect(r[0], natalAngles.asc, TRANSIT_ORB);
      if (aspAsc) aspects.push(`LR.${name}${aspAsc.symbol}n.ASC`);
      const aspMc = getAspect(r[0], natalAngles.mc, TRANSIT_ORB);
      if (aspMc) aspects.push(`LR.${name}${aspMc.symbol}n.MC`);
    }
    output += aspects.length === 0 ? 'なし\n' : aspects.join(' / ');

    if (i < returns.length - 1) output += `\n\n${'─'.repeat(30)}\n\n`;
  }
  return output;
}

/**
 * シナストリー（相性）
 */
export function calcSynastry({ a, b, optionalBodies }) {
  const locA = resolveLocation(a);
  const locB = resolveLocation(b);

  // 有効な小惑星IDリスト
  const activeOptIds = [];
  if (optionalBodies) {
    const bodyMap = { chiron: 15, lilith: 12, ceres: 17, pallas: 18, juno: 19, vesta: 20 };
    for (const [key, id] of Object.entries(bodyMap)) {
      if (optionalBodies[key]) activeOptIds.push(id);
    }
  }

  function calcPerson(p, loc) {
    const offset = p.utcOffset != null ? p.utcOffset : 9;
    const utcHour = p.hour - offset + p.minute / 60;
    const jd = swe.swe_julday(p.year, p.month, p.day, utcHour, 1);
    const houses = swe.swe_houses(jd, loc.lat, loc.lng, 'P');
    const positions = [];
    for (const [id, name] of PLANETS) {
      const r = swe.swe_calc_ut(jd, id, 256);
      positions.push({ id, name, lon: r[0], spd: r[3], house: getHouse(r[0], houses.cusps) });
    }
    for (const [id, name] of OPTIONAL_BODIES) {
      if (!activeOptIds.includes(id)) continue;
      const r = swe.swe_calc_ut(jd, id, 256);
      positions.push({ id, name, lon: r[0], spd: r[3], house: getHouse(r[0], houses.cusps) });
    }
    return { positions, angles: { asc: houses.ascmc[0], mc: houses.ascmc[1] } };
  }

  const personA = calcPerson(a, locA);
  const personB = calcPerson(b, locB);

  let output = `【シナストリー】\n\n`;
  output += `■ Aのネイタル（${a.year}-${String(a.month).padStart(2,'0')}-${String(a.day).padStart(2,'0')}）\n`;
  output += personA.positions.map(p => `${p.name} ${fmtShort(p.lon)}(${p.house}H)`).join(' / ') + '\n';
  output += `ASC ${fmtShort(personA.angles.asc)} / MC ${fmtShort(personA.angles.mc)}\n\n`;

  output += `■ Bのネイタル（${b.year}-${String(b.month).padStart(2,'0')}-${String(b.day).padStart(2,'0')}）\n`;
  output += personB.positions.map(p => `${p.name} ${fmtShort(p.lon)}(${p.house}H)`).join(' / ') + '\n';
  output += `ASC ${fmtShort(personB.angles.asc)} / MC ${fmtShort(personB.angles.mc)}\n\n`;

  output += `■ 相互アスペクト\n`;
  const aspects = [];
  for (const pa of personA.positions) {
    for (const pb of personB.positions) {
      const asp = getAspect(pa.lon, pb.lon, SYNASTRY_ORB);
      if (asp) aspects.push(`A.${pa.name}${asp.symbol}B.${pb.name}(${asp.orb.toFixed(1)}°)`);
    }
  }
  for (const pa of personA.positions) {
    const aspAsc = getAspect(pa.lon, personB.angles.asc, SYNASTRY_ORB);
    if (aspAsc) aspects.push(`A.${pa.name}${aspAsc.symbol}B.ASC(${aspAsc.orb.toFixed(1)}°)`);
    const aspMc = getAspect(pa.lon, personB.angles.mc, SYNASTRY_ORB);
    if (aspMc) aspects.push(`A.${pa.name}${aspMc.symbol}B.MC(${aspMc.orb.toFixed(1)}°)`);
  }
  for (const pb of personB.positions) {
    const aspAsc = getAspect(pb.lon, personA.angles.asc, SYNASTRY_ORB);
    if (aspAsc) aspects.push(`B.${pb.name}${aspAsc.symbol}A.ASC(${aspAsc.orb.toFixed(1)}°)`);
    const aspMc = getAspect(pb.lon, personA.angles.mc, SYNASTRY_ORB);
    if (aspMc) aspects.push(`B.${pb.name}${aspMc.symbol}A.MC(${aspMc.orb.toFixed(1)}°)`);
  }
  output += aspects.length === 0 ? 'なし\n' : aspects.join('\n');

  return { output, personA, personB };
}
