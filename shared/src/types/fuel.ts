export interface FuelData {
  totalQuantityWeight: number; // pounds
  totalQuantityGallons: number; // gallons
  totalCapacityGallons: number; // gallons
  fuelPercentage: number; // 0-100
  tanks: FuelTank[];
}

export interface FuelTank {
  name: string;
  quantityGallons: number;
  capacityGallons: number;
}
