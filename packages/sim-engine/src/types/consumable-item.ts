/** A daily consumable (chemical, media, etc.) used by a unit */
export interface ConsumableItem {
  item: string;
  daily: number;
  unit: string;
  citation: string;
}
