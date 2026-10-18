export function calculateConcentration(compoundMg, diluentMl) {
  const mg = Number(compoundMg);
  const ml = Number(diluentMl);
  if (!Number.isFinite(mg) || !Number.isFinite(ml) || mg < 0 || ml <= 0) return null;
  return mg / ml;
}

export function calculateDiluentVolume(compoundMg, targetMgMl) {
  const mg = Number(compoundMg);
  const concentration = Number(targetMgMl);
  if (!Number.isFinite(mg) || !Number.isFinite(concentration) || mg < 0 || concentration <= 0) return null;
  return mg / concentration;
}
