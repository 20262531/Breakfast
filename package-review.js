// The API receives a closed vocabulary. Original report text stays in the browser.
const words = new Set(('room rooms only breakfast breakfasts abf bf included inclusive include includes excluding excluded exclude without with no not free complimentary charge charged chargeable paid pay extra add added request requested pending confirm confirmed cancel cancelled change changed from to previous current now was is upgraded upgrade downgrades downgraded optional book booked booking rate package plan per pax person adult child all some one two daily on arrival departure today tomorrow originally instead if unless or and plus supplement separate separately inc incl excl applicable applicablefor applicableto ro rb r o b hb fb ai bb รวมอาหารเช้า ไม่รวมอาหารเช้า อาหารเช้า รวม ไม่รวม จ่ายเพิ่ม ยกเลิก เปลี่ยน รอยืนยัน').split(' '));
const parts = /[a-z0-9]+|[ก-๙]+|[+/,;:()!?*.-]/giu;
const connectors = /^[+/,;:()!?*.-]$/;
const subject = /\b(?:ro|rb|r +[ob]|room only|breakfasts?|abf|bf)\b|อาหารเช้า/i;
const numberTag = /^\d{1,2}(ro|rb|hb|fb|ai)$/i;
const contexts = new Set(['Cashiering', 'Reservation', 'General', 'Rate Code', 'FO mapping', 'Other rooms with the same rate']);
const labels = new Set(['RO', 'RB', 'REVIEW']);

export function minimizePackageComment(line) {
  if (typeof line !== 'string') return '';
  const tokens = line.toLowerCase().replace(/roomonly/g,' room only ').replace(/breakfast(included|excluded)/g,' breakfast $1 ').replace(/(without|with|no)breakfast/g,' $1 breakfast ').replace(/(package|plan|rate)(rb|ro)\b/g,'$1 $2').match(parts) || [];
  const minimized = [];
  for (const token of tokens) {
    const normalized = token.match(numberTag)?.[1] || token;
    if (words.has(normalized) || connectors.test(normalized)) minimized.push(normalized);
    else if (minimized.at(-1) !== '…') minimized.push('…');
  }
  const text = minimized.join(' ').trim();
  return text.length <= 320 && subject.test(text) ? text : '';
}

export function hasConditionalPackageComment(text) {
  const uncertain = /\b(?:not|no)\s+(?:\d{1,2}\s*)?r\s*[ob]\b|\b(?:request(?:ed)?|pending|cancel(?:led)?|chang(?:e|ed)|upgrad(?:e|ed)|downgrad(?:e|ed)|if|unless)\b|ยกเลิก|เปลี่ยน|รอยืนยัน/i;
  return uncertain.test(text);
}

function sanitized(value) {
  return typeof value === 'string' && value.length <= 320
    && value.split(' ').every(token => words.has(token) || connectors.test(token) || token === '…')
    && subject.test(value);
}

export function sameRateEvidence(rooms, reports) {
  const comparisons = new Map();
  for (const report of reports) {
    const confirmed = new Map();
    for (const record of report.records) {
      const room = rooms[record.room];
      if (!record.rate || !room || !['RO', 'RB'].includes(room.pkg) || room.rates.length !== 1
        || !record.evidence.some(evidence => evidence.pkg === room.pkg)) continue;
      const byRoom = confirmed.get(record.rate) || new Map();
      byRoom.set(record.room, room.pkg);
      confirmed.set(record.rate, byRoom);
    }
    for (const record of report.records) {
      if (rooms[record.room]?.pkg !== 'REVIEW' || !record.rate) continue;
      const counts = { RO: 0, RB: 0 };
      for (const [room, pkg] of confirmed.get(record.rate) || []) {
        if (room !== record.room) counts[pkg]++;
      }
      if (!counts.RO && !counts.RB) continue;
      const key = JSON.stringify([record.rate, report.source]);
      const byRate = comparisons.get(record.room) || new Map();
      byRate.set(key, { rate: record.rate, counts });
      comparisons.set(record.room, byRate);
    }
  }
  return new Map([...comparisons].map(([room, rates]) => [room, [...rates.values()]]));
}

export function buildReviewBatch(rooms, comparisons = new Map()) {
  const roomKeys = [];
  const entries = [];
  for (const room of Object.values(rooms)) {

    const signals = [];
    for (const rate of room.rates || []) {
      if (/^[A-Z0-9*._ +/-]{1,64}$/i.test(rate)) signals.push({source:'Printed rate',text:rate});
    }
    for (const entry of room.evidence || []) {
      if (entry.kind === 'Rate Code' || entry.kind === 'รหัสที่ผู้ดูแลกำหนด') {
        signals.push({ source: entry.kind === 'Rate Code' ? 'Rate Code' : 'FO mapping', text: entry.pkg.toLowerCase() });
      }
    }
    for (const entry of room.packageComments || []) {
      if ((entry.kind==='Comment code' && /^[A-Z0-9*-]{3,31}$/.test(entry.text)) || sanitized(entry.text)) signals.push({ source: entry.kind, text: entry.text });
    }
    for (const { counts } of comparisons.get(room.room) || []) {
      for (const pkg of ['RO', 'RB']) {
        if (counts[pkg]) signals.push({ source: 'Other rooms with the same rate', text: pkg.toLowerCase() });
      }
    }
    const unique = [...new Map(signals.map(signal => [JSON.stringify(signal), signal])).values()];

    const locked = (room.issues || []).some(issue => !issue.startsWith('ยังไม่มีหลักฐาน RO/RB') && issue !== 'หมายเหตุสิทธิ์มีเงื่อนไขหรือระบุการเปลี่ยนแปลง');
    roomKeys.push(room.room);
    entries.push({ id: roomKeys.length - 1, signals: unique.slice(0, 20), locked: locked || unique.length > 20 });
  }
  return { roomKeys, entries };
}

export function validateReviewBatch(entries) {
  return Array.isArray(entries) && entries.length > 0 && entries.length <= 16
    && new Set(entries.map(entry => entry?.id)).size === entries.length
    && entries.every(entry => entry && Number.isInteger(entry.id) && entry.id >= 0 && entry.id < 1500
      && typeof entry.locked === 'boolean'
      && Array.isArray(entry.signals) && entry.signals.length <= 20
      && entry.signals.every(signal => signal && (['Printed rate','Comment code'].includes(signal.source) ? typeof signal.text === 'string' && /^[A-Z0-9*._ +/-]{1,64}$/i.test(signal.text) : contexts.has(signal.source) && sanitized(signal.text))));
}

export function validatedSuggestions(entries, results) {
  const suggestions = new Map();
  if (!Array.isArray(results)) return suggestions;
  for (const entry of entries) {
    const matches = results.filter(row => row?.id === entry.id);
    if (entry.locked || matches.length !== 1) continue;
    const { pkg, evidence } = matches[0];
    if (!labels.has(pkg) || pkg === 'REVIEW' || !Number.isInteger(evidence) || !entry.signals[evidence] || entry.signals[evidence].source === 'Other rooms with the same rate') continue;
    suggestions.set(entry.id, { id: entry.id, pkg, evidence });
  }
  return suggestions;
}
