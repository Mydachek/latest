
export function ensureGemSlots(gear){
  if(!gear.gemSlots && gear.gemSlots !== 0){
    gear.gemSlots = 0;
  }
  return gear.gemSlots;
}
