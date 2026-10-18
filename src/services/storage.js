const KEY = 'pep-tracker-v1';
const initial = {
  injections: [],
  supplies: [],
  preparedVials: [],
  ledger: [],
  settings: {
    intervals: { Reta: 7, Tirz: 7 },
    formulas: { Reta: { halfLifeDays: 6 }, Tirz: { halfLifeDays: 5 } },
    theme: 'dark',
    lowStockMg: 20,
    concentrationPresets: [ { name: 'Custom preset A', mgMl: 5 }, { name: 'Custom preset B', mgMl: 10 } ]
  }
};

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(initial);
    const parsed = JSON.parse(raw);
    return { ...structuredClone(initial), ...parsed, settings: { ...initial.settings, ...(parsed.settings || {}) } };
  } catch {
    return structuredClone(initial);
  }
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

export function exportJson(state) {
  const blob = new Blob([JSON.stringify({ app: 'Pep Tracker', version: 1, exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pep-tracker-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadText(text, filename, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
