// ─── Cargo Types ────────────────────────────────────────────

export type CargoMode = 'mixed' | 'single';

export type CargoCategoryCode =
  | 'general_freight'
  | 'pharmaceuticals'
  | 'seafood'
  | 'electronics'
  | 'industrial_machinery'
  | 'automotive'
  | 'textiles'
  | 'dangerous_goods'
  | 'live_animals'
  | 'ecommerce';

export interface CargoConfig {
  cargoMode: CargoMode;
  primaryCategory: CargoCategoryCode;
  useRealWorldCompanies: boolean;
}

export interface ULD {
  uld_id: string;
  uld_type: string;
  uld_type_name: string;
  position: string;
  section: string;
  section_name: string;
  weight: number;
  gross_weight: number;
  tare_weight: number;
  cargo_description: string;
  category: string;
  category_name: string;
  category_code: string;
  shipper: { name: string; city: string; country: string; type: string };
  consignee: { name: string; city: string; country: string; type: string };
  awb_number: string;
  temp_controlled: boolean;
  temp_requirement: string | null;
  temp_advisory: string | null;
  hazmat: boolean;
  notoc_required: boolean;
  lithium_battery: boolean;
}

export interface SectionWeight {
  name: string;
  weight: number;
  maxWeight: number;
  utilization: number;
}

export interface NotocItem {
  uld_id: string;
  position: string;
  proper_shipping_name: string;
  un_number: string;
  class: string;
  packing_group: string;
  quantity: string;
  net_weight: string;
}

export interface CargoLoad {
  manifestNumber: string;
  aircraftIcao: string;
  aircraftName: string;
  ulds: ULD[];
  sectionWeights: Record<string, SectionWeight>;
  totalWeightKg: number;
  totalWeightDisplay: number;
  totalWeightUnit: string;
  cgPosition: number;
  cgRange: { forward: number; aft: number };
  cgTarget: number;
  payloadUtilization: number;
  aircraftMaxPayloadKg: number;
  remarks: string[];
  specialCargo: ULD[];
  notocRequired: boolean;
  notocItems: NotocItem[];
  cargoMode: CargoMode;
  primaryCategory: CargoCategoryCode | null;
}

export interface CargoManifest extends CargoLoad {
  id: number;
  flightId: number;
  userId: number;
  createdAt: string;
}

export interface CargoManifestSummary {
  id: number;
  manifestNumber: string;
  totalWeightKg: number;
  uldCount: number;
  payloadUtilization: number;
  notocRequired: boolean;
  cargoMode: CargoMode;
}

export interface GenerateCargoRequest {
  flightId: number;
  aircraftIcao: string;
  payloadKg: number;
  payloadUnit: 'LBS' | 'KGS';
  cargoMode: CargoMode;
  primaryCategory?: CargoCategoryCode;
  useRealWorldCompanies?: boolean;
}
