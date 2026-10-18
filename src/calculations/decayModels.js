export const DEFAULT_FORMULAS = {
  Reta: { halfLifeDays: 6 },
  Tirz: { halfLifeDays: 5 }
};

export function wholeDaysBetween(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  return Math.floor((end.getTime() - start.getTime()) / 86400000);
}

export function calculateLevel(injections, compound, targetDate, formulas = DEFAULT_FORMULAS) {
  const halfLife = Number(formulas?.[compound]?.halfLifeDays);
  if (!Number.isFinite(halfLife) || halfLife <= 0 || !targetDate) return 0;
  return injections
    .filter(row => row.compound === compound && row.date && row.date <= targetDate)
    .reduce((total, row) => {
      const days = wholeDaysBetween(row.date, targetDate);
      const dose = Number(row.doseMg);
      if (days < 0 || !Number.isFinite(dose) || dose <= 0) return total;
      return total + dose * (2 ** (-days / halfLife));
    }, 0);
}

export function calculateAllLevels(injections, targetDate, formulas = DEFAULT_FORMULAS) {
  const compounds = [...new Set([...Object.keys(formulas), ...injections.map(i => i.compound)])];
  return Object.fromEntries(compounds.map(c => [c, calculateLevel(injections, c, targetDate, formulas)]));
}
