
export function roundStat(value){
  if (value === undefined || value === null) return 0;
  return Math.ceil(value);
}
