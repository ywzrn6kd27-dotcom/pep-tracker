export function parseCsv(text) {
  const rows = [];
  let row = [], cell = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i], next = text[i + 1];
    if (ch === '"' && quoted && next === '"') { cell += '"'; i++; }
    else if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { row.push(cell); cell = ''; }
    else if ((ch === '\n' || ch === '\r') && !quoted) {
      if (ch === '\r' && next === '\n') i++;
      row.push(cell); if (row.some(v => v.trim())) rows.push(row);
      row = []; cell = '';
    } else cell += ch;
  }
  if (cell.length || row.length) { row.push(cell); if (row.some(v => v.trim())) rows.push(row); }
  if (!rows.length) return [];
  const headers = rows.shift().map(h => h.trim().toLowerCase().replace(/[_-]/g, ' '));
  const pick = (...names) => headers.findIndex(h => names.includes(h));
  const dateI = pick('date', 'injection date', 'shot date');
  const compoundI = pick('pep', 'compound', 'type', 'medication');
  const doseI = pick('dose (mg)', 'dose mg', 'dose', 'mg');
  const unitsI = pick('units', 'syringe units');
  return rows.map((r, index) => ({
    rowNumber: index + 2,
    date: normalizeDate(r[dateI] || ''),
    compound: normalizeCompound(r[compoundI] || ''),
    doseMg: r[doseI] === undefined || r[doseI].trim() === '' ? '' : Number(r[doseI]),
    units: r[unitsI] === undefined || r[unitsI].trim() === '' ? '' : Number(r[unitsI]),
    raw: r
  }));
}

function normalizeCompound(value) {
  const v = String(value).trim();
  if (/^reta$/i.test(v)) return 'Reta';
  if (/^tirz$/i.test(v)) return 'Tirz';
  return v;
}

function normalizeDate(value) {
  const v = String(value).trim();
  if (!v) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const year = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3]);
    return `${year}-${String(Number(m[1])).padStart(2,'0')}-${String(Number(m[2])).padStart(2,'0')}`;
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0,10);
}

export function toCsv(rows) {
  const escape = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [
    ['Date','Pep','Dose (mg)','Units'].map(escape).join(','),
    ...rows.map(r => [r.date, r.compound, r.doseMg, r.units].map(escape).join(','))
  ].join('\r\n');
}

export async function readImportFile(file) {
  if (file.name.toLowerCase().endsWith('.csv')) return parseCsv(await file.text());
  if (file.name.toLowerCase().endsWith('.xlsx') || file.name.toLowerCase().endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    return parseCsv(csv);
  }
  throw new Error('Choose a CSV or Excel (.xlsx) file.');
}
