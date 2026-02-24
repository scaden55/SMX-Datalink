// ─── Company Data ────────────────────────────────────────────
// Fictional and real-world shipper/consignee pools by cargo category.

interface Company {
  name: string;
  city: string;
  country: string;
  type: string;
}

interface CompanyPool {
  shippers: Company[];
  consignees: Company[];
}

export const FICTIONAL_COMPANIES: Record<string, CompanyPool> = {
  general_freight: {
    shippers: [
      { name: 'GlobalTrans Logistics', city: 'Chicago', country: 'US', type: 'freight-forwarder' },
      { name: 'Apex Cargo Solutions', city: 'Frankfurt', country: 'DE', type: 'freight-forwarder' },
      { name: 'Pacific Bridge Shipping', city: 'Hong Kong', country: 'HK', type: 'freight-forwarder' },
      { name: 'NorthStar Express', city: 'Toronto', country: 'CA', type: 'freight-forwarder' },
      { name: 'Meridian Freight Corp', city: 'Dubai', country: 'AE', type: 'freight-forwarder' },
    ],
    consignees: [
      { name: 'Metro Distribution Hub', city: 'Los Angeles', country: 'US', type: 'warehouse' },
      { name: 'EuroLink Warehousing', city: 'Rotterdam', country: 'NL', type: 'warehouse' },
      { name: 'Orient Express Depot', city: 'Singapore', country: 'SG', type: 'warehouse' },
      { name: 'Skybridge Fulfillment', city: 'London', country: 'GB', type: 'warehouse' },
      { name: 'Continental Cargo Depot', city: 'São Paulo', country: 'BR', type: 'warehouse' },
    ],
  },
  pharmaceuticals: {
    shippers: [
      { name: 'MedVault Pharma', city: 'Basel', country: 'CH', type: 'manufacturer' },
      { name: 'BioCore Therapeutics', city: 'Boston', country: 'US', type: 'manufacturer' },
      { name: 'NovaGen Labs', city: 'Seoul', country: 'KR', type: 'manufacturer' },
      { name: 'Helix BioSciences', city: 'Munich', country: 'DE', type: 'manufacturer' },
      { name: 'PharmaStar International', city: 'Mumbai', country: 'IN', type: 'manufacturer' },
    ],
    consignees: [
      { name: 'ColdChain Medical Supply', city: 'New York', country: 'US', type: 'distributor' },
      { name: 'EuroPharma Distribution', city: 'Paris', country: 'FR', type: 'distributor' },
      { name: 'AsiaHealth Logistics', city: 'Tokyo', country: 'JP', type: 'distributor' },
      { name: 'Lifeline Medical Center', city: 'Sydney', country: 'AU', type: 'hospital' },
      { name: 'Nordic Health Hub', city: 'Stockholm', country: 'SE', type: 'distributor' },
    ],
  },
  seafood: {
    shippers: [
      { name: 'Ocean Harvest Co', city: 'Reykjavik', country: 'IS', type: 'producer' },
      { name: 'Pacific Pearl Fisheries', city: 'Vancouver', country: 'CA', type: 'producer' },
      { name: 'Nordic Catch AS', city: 'Bergen', country: 'NO', type: 'producer' },
      { name: 'Coral Sea Trading', city: 'Auckland', country: 'NZ', type: 'producer' },
      { name: 'Atlantic Fresh Ltd', city: 'Halifax', country: 'CA', type: 'producer' },
    ],
    consignees: [
      { name: 'Tokyo Fish Market Corp', city: 'Tokyo', country: 'JP', type: 'market' },
      { name: 'FreshCatch Distribution', city: 'Miami', country: 'US', type: 'distributor' },
      { name: 'EuroFresh Imports', city: 'Madrid', country: 'ES', type: 'distributor' },
      { name: 'GourmetSea Shanghai', city: 'Shanghai', country: 'CN', type: 'market' },
      { name: 'SeaFood Express UK', city: 'London', country: 'GB', type: 'distributor' },
    ],
  },
  electronics: {
    shippers: [
      { name: 'TechVault Manufacturing', city: 'Shenzhen', country: 'CN', type: 'manufacturer' },
      { name: 'SiliconBridge Corp', city: 'Taipei', country: 'TW', type: 'manufacturer' },
      { name: 'NanoTech Solutions', city: 'San Jose', country: 'US', type: 'manufacturer' },
      { name: 'Quantum Devices Ltd', city: 'Tokyo', country: 'JP', type: 'manufacturer' },
      { name: 'EuraTech GmbH', city: 'Dresden', country: 'DE', type: 'manufacturer' },
    ],
    consignees: [
      { name: 'DigiStore Warehouse', city: 'Memphis', country: 'US', type: 'warehouse' },
      { name: 'TechHub Distribution', city: 'London', country: 'GB', type: 'distributor' },
      { name: 'SmartDev Retail', city: 'Dubai', country: 'AE', type: 'retailer' },
      { name: 'Pixel Solutions', city: 'Sydney', country: 'AU', type: 'distributor' },
      { name: 'CircuitCity Depot', city: 'Amsterdam', country: 'NL', type: 'warehouse' },
    ],
  },
  industrial_machinery: {
    shippers: [
      { name: 'HeavyForge Industries', city: 'Pittsburgh', country: 'US', type: 'manufacturer' },
      { name: 'TitanWorks GmbH', city: 'Essen', country: 'DE', type: 'manufacturer' },
      { name: 'SteelMaster Corp', city: 'Osaka', country: 'JP', type: 'manufacturer' },
      { name: 'Atlas Machinery Ltd', city: 'Birmingham', country: 'GB', type: 'manufacturer' },
      { name: 'IronBridge Industrial', city: 'Shanghai', country: 'CN', type: 'manufacturer' },
    ],
    consignees: [
      { name: 'MegaBuild Construction', city: 'Riyadh', country: 'SA', type: 'construction' },
      { name: 'Pacific Mining Corp', city: 'Perth', country: 'AU', type: 'mining' },
      { name: 'Continental Motors', city: 'Detroit', country: 'US', type: 'manufacturer' },
      { name: 'Euro Engineering AG', city: 'Zurich', country: 'CH', type: 'engineering' },
      { name: 'BorealWorks Canada', city: 'Calgary', country: 'CA', type: 'construction' },
    ],
  },
  automotive: {
    shippers: [
      { name: 'AutoParts Direct', city: 'Stuttgart', country: 'DE', type: 'manufacturer' },
      { name: 'DriveLink Components', city: 'Nagoya', country: 'JP', type: 'manufacturer' },
      { name: 'MotorCore Supply', city: 'Detroit', country: 'US', type: 'manufacturer' },
      { name: 'VeloTech Parts', city: 'Torino', country: 'IT', type: 'manufacturer' },
      { name: 'ShinAuto Co', city: 'Seoul', country: 'KR', type: 'manufacturer' },
    ],
    consignees: [
      { name: 'AutoZone Distribution', city: 'Dallas', country: 'US', type: 'distributor' },
      { name: 'EuroCar Parts Ltd', city: 'Manchester', country: 'GB', type: 'distributor' },
      { name: 'MexiMotor SA', city: 'Monterrey', country: 'MX', type: 'assembly' },
      { name: 'AusParts Warehouse', city: 'Melbourne', country: 'AU', type: 'warehouse' },
      { name: 'AfriDrive Logistics', city: 'Johannesburg', country: 'ZA', type: 'distributor' },
    ],
  },
  textiles: {
    shippers: [
      { name: 'SilkRoad Textiles', city: 'Hangzhou', country: 'CN', type: 'manufacturer' },
      { name: 'BanglaStitch Corp', city: 'Dhaka', country: 'BD', type: 'manufacturer' },
      { name: 'VietFabric Ltd', city: 'Ho Chi Minh City', country: 'VN', type: 'manufacturer' },
      { name: 'TurkWeave AS', city: 'Istanbul', country: 'TR', type: 'manufacturer' },
      { name: 'IndoThread Mills', city: 'Jakarta', country: 'ID', type: 'manufacturer' },
    ],
    consignees: [
      { name: 'FashionForward NYC', city: 'New York', country: 'US', type: 'retailer' },
      { name: 'Milano Mode SRL', city: 'Milan', country: 'IT', type: 'retailer' },
      { name: 'ParisChic Boutique', city: 'Paris', country: 'FR', type: 'retailer' },
      { name: 'LondonThread', city: 'London', country: 'GB', type: 'distributor' },
      { name: 'TokyoStyle Inc', city: 'Tokyo', country: 'JP', type: 'retailer' },
    ],
  },
  dangerous_goods: {
    shippers: [
      { name: 'ChemSafe Transport', city: 'Houston', country: 'US', type: 'chemical' },
      { name: 'HazChem Solutions', city: 'Ludwigshafen', country: 'DE', type: 'chemical' },
      { name: 'PyroChem Ltd', city: 'Manchester', country: 'GB', type: 'chemical' },
      { name: 'AsiaChem Corp', city: 'Singapore', country: 'SG', type: 'chemical' },
      { name: 'SafeHaul Logistics', city: 'Rotterdam', country: 'NL', type: 'freight-forwarder' },
    ],
    consignees: [
      { name: 'IndustraChem Inc', city: 'Newark', country: 'US', type: 'chemical' },
      { name: 'EuroChem GmbH', city: 'Basel', country: 'CH', type: 'chemical' },
      { name: 'PacificChem Ltd', city: 'Melbourne', country: 'AU', type: 'chemical' },
      { name: 'NordHaz AS', city: 'Gothenburg', country: 'SE', type: 'chemical' },
      { name: 'GulfChem Industries', city: 'Abu Dhabi', country: 'AE', type: 'chemical' },
    ],
  },
  live_animals: {
    shippers: [
      { name: 'WildCare Transport', city: 'Nairobi', country: 'KE', type: 'animal-transport' },
      { name: 'AquaLife Exports', city: 'Honolulu', country: 'US', type: 'aquarium' },
      { name: 'PedigreeAir', city: 'Dublin', country: 'IE', type: 'animal-transport' },
      { name: 'ZooLogistics GmbH', city: 'Berlin', country: 'DE', type: 'animal-transport' },
      { name: 'EquineExpress', city: 'Lexington', country: 'US', type: 'equine' },
    ],
    consignees: [
      { name: 'National Zoo Association', city: 'Washington DC', country: 'US', type: 'zoo' },
      { name: 'European Wildlife Park', city: 'Amsterdam', country: 'NL', type: 'zoo' },
      { name: 'Royal Stables Dubai', city: 'Dubai', country: 'AE', type: 'equine' },
      { name: 'BioResearch Institute', city: 'Cambridge', country: 'GB', type: 'research' },
      { name: 'Pacific Aquarium', city: 'Tokyo', country: 'JP', type: 'aquarium' },
    ],
  },
  ecommerce: {
    shippers: [
      { name: 'QuickShip Fulfillment', city: 'Shenzhen', country: 'CN', type: 'fulfillment' },
      { name: 'ePack Logistics', city: 'Louisville', country: 'US', type: 'fulfillment' },
      { name: 'SwiftBox Europe', city: 'Leipzig', country: 'DE', type: 'fulfillment' },
      { name: 'ClickShip Asia', city: 'Bangkok', country: 'TH', type: 'fulfillment' },
      { name: 'FlashDrop Inc', city: 'Mumbai', country: 'IN', type: 'fulfillment' },
    ],
    consignees: [
      { name: 'LastMile Hub US', city: 'Dallas', country: 'US', type: 'distribution' },
      { name: 'ParcelPoint UK', city: 'Coventry', country: 'GB', type: 'distribution' },
      { name: 'ExpressSort DE', city: 'Hamburg', country: 'DE', type: 'distribution' },
      { name: 'RapidDeliver AU', city: 'Sydney', country: 'AU', type: 'distribution' },
      { name: 'InstaDrop JP', city: 'Osaka', country: 'JP', type: 'distribution' },
    ],
  },
};

export const REAL_WORLD_COMPANIES: Record<string, CompanyPool> = {
  general_freight: {
    shippers: [
      { name: 'DHL Global Forwarding', city: 'Bonn', country: 'DE', type: 'freight-forwarder' },
      { name: 'Kuehne+Nagel', city: 'Schindellegi', country: 'CH', type: 'freight-forwarder' },
      { name: 'DB Schenker', city: 'Essen', country: 'DE', type: 'freight-forwarder' },
    ],
    consignees: [
      { name: 'FedEx Supply Chain', city: 'Memphis', country: 'US', type: 'warehouse' },
      { name: 'UPS Supply Chain', city: 'Louisville', country: 'US', type: 'warehouse' },
      { name: 'Maersk Logistics', city: 'Copenhagen', country: 'DK', type: 'warehouse' },
    ],
  },
  pharmaceuticals: {
    shippers: [
      { name: 'Pfizer Inc', city: 'New York', country: 'US', type: 'manufacturer' },
      { name: 'Novartis AG', city: 'Basel', country: 'CH', type: 'manufacturer' },
      { name: 'Roche Holding', city: 'Basel', country: 'CH', type: 'manufacturer' },
    ],
    consignees: [
      { name: 'McKesson Corp', city: 'San Francisco', country: 'US', type: 'distributor' },
      { name: 'AmerisourceBergen', city: 'Conshohocken', country: 'US', type: 'distributor' },
      { name: 'Alliance Healthcare', city: 'Chesterfield', country: 'GB', type: 'distributor' },
    ],
  },
  seafood: {
    shippers: [
      { name: 'Mowi ASA', city: 'Bergen', country: 'NO', type: 'producer' },
      { name: 'Thai Union Group', city: 'Bangkok', country: 'TH', type: 'producer' },
      { name: 'Nippon Suisan', city: 'Tokyo', country: 'JP', type: 'producer' },
    ],
    consignees: [
      { name: 'Sysco Corporation', city: 'Houston', country: 'US', type: 'distributor' },
      { name: 'Tsukiji Market', city: 'Tokyo', country: 'JP', type: 'market' },
      { name: 'Bidfood', city: 'London', country: 'GB', type: 'distributor' },
    ],
  },
  electronics: {
    shippers: [
      { name: 'Foxconn Technology', city: 'Taipei', country: 'TW', type: 'manufacturer' },
      { name: 'Samsung Electronics', city: 'Suwon', country: 'KR', type: 'manufacturer' },
      { name: 'TSMC', city: 'Hsinchu', country: 'TW', type: 'manufacturer' },
    ],
    consignees: [
      { name: 'Apple Inc', city: 'Cupertino', country: 'US', type: 'manufacturer' },
      { name: 'Dell Technologies', city: 'Round Rock', country: 'US', type: 'manufacturer' },
      { name: 'MediaMarkt', city: 'Ingolstadt', country: 'DE', type: 'retailer' },
    ],
  },
  industrial_machinery: {
    shippers: [
      { name: 'Caterpillar Inc', city: 'Peoria', country: 'US', type: 'manufacturer' },
      { name: 'Siemens AG', city: 'Munich', country: 'DE', type: 'manufacturer' },
      { name: 'Komatsu Ltd', city: 'Tokyo', country: 'JP', type: 'manufacturer' },
    ],
    consignees: [
      { name: 'AECOM', city: 'Los Angeles', country: 'US', type: 'construction' },
      { name: 'BHP Group', city: 'Melbourne', country: 'AU', type: 'mining' },
      { name: 'Saudi Aramco', city: 'Dhahran', country: 'SA', type: 'energy' },
    ],
  },
  automotive: {
    shippers: [
      { name: 'Bosch', city: 'Stuttgart', country: 'DE', type: 'manufacturer' },
      { name: 'Denso Corporation', city: 'Kariya', country: 'JP', type: 'manufacturer' },
      { name: 'Continental AG', city: 'Hanover', country: 'DE', type: 'manufacturer' },
    ],
    consignees: [
      { name: 'Toyota Motor Corp', city: 'Toyota City', country: 'JP', type: 'assembly' },
      { name: 'BMW Group', city: 'Munich', country: 'DE', type: 'assembly' },
      { name: 'General Motors', city: 'Detroit', country: 'US', type: 'assembly' },
    ],
  },
  textiles: {
    shippers: [
      { name: 'Li & Fung Ltd', city: 'Hong Kong', country: 'HK', type: 'manufacturer' },
      { name: 'Esquel Group', city: 'Hong Kong', country: 'HK', type: 'manufacturer' },
      { name: 'Crystal International', city: 'Hong Kong', country: 'HK', type: 'manufacturer' },
    ],
    consignees: [
      { name: 'Inditex (Zara)', city: 'Arteixo', country: 'ES', type: 'retailer' },
      { name: 'H&M Group', city: 'Stockholm', country: 'SE', type: 'retailer' },
      { name: 'Nike Inc', city: 'Beaverton', country: 'US', type: 'retailer' },
    ],
  },
  dangerous_goods: {
    shippers: [
      { name: 'BASF SE', city: 'Ludwigshafen', country: 'DE', type: 'chemical' },
      { name: 'Dow Chemical', city: 'Midland', country: 'US', type: 'chemical' },
      { name: 'SABIC', city: 'Riyadh', country: 'SA', type: 'chemical' },
    ],
    consignees: [
      { name: 'DuPont', city: 'Wilmington', country: 'US', type: 'chemical' },
      { name: 'Evonik Industries', city: 'Essen', country: 'DE', type: 'chemical' },
      { name: 'Shin-Etsu Chemical', city: 'Tokyo', country: 'JP', type: 'chemical' },
    ],
  },
  live_animals: {
    shippers: [
      { name: 'Interzoo GmbH', city: 'Nuremberg', country: 'DE', type: 'animal-transport' },
      { name: 'IATA LAR Certified', city: 'Montreal', country: 'CA', type: 'animal-transport' },
      { name: 'Chapman Freeborn', city: 'London', country: 'GB', type: 'animal-transport' },
    ],
    consignees: [
      { name: 'San Diego Zoo', city: 'San Diego', country: 'US', type: 'zoo' },
      { name: 'Singapore Zoo', city: 'Singapore', country: 'SG', type: 'zoo' },
      { name: 'Dubai Godolphin Stables', city: 'Dubai', country: 'AE', type: 'equine' },
    ],
  },
  ecommerce: {
    shippers: [
      { name: 'Amazon.com', city: 'Seattle', country: 'US', type: 'fulfillment' },
      { name: 'Alibaba Group', city: 'Hangzhou', country: 'CN', type: 'fulfillment' },
      { name: 'Shopify Fulfillment', city: 'Ottawa', country: 'CA', type: 'fulfillment' },
    ],
    consignees: [
      { name: 'Amazon Fulfillment', city: 'Various', country: 'US', type: 'distribution' },
      { name: 'JD.com Logistics', city: 'Beijing', country: 'CN', type: 'distribution' },
      { name: 'Zalando SE', city: 'Berlin', country: 'DE', type: 'distribution' },
    ],
  },
};

const AIRLINE_PREFIXES = ['125', '020', '057', '176', '205', '074', '160', '618', '014', '235'];

/** Get a random company (shipper or consignee) for a category. */
export function getRandomCompany(
  categoryCode: string,
  role: 'shipper' | 'consignee',
  useRealWorld: boolean,
): Company {
  // 35% chance to use real-world if enabled
  const pool = useRealWorld && Math.random() < 0.35
    ? REAL_WORLD_COMPANIES[categoryCode]
    : FICTIONAL_COMPANIES[categoryCode];

  if (!pool) {
    return { name: 'Unknown Company', city: 'Unknown', country: 'XX', type: 'unknown' };
  }

  const list = role === 'shipper' ? pool.shippers : pool.consignees;
  return list[Math.floor(Math.random() * list.length)];
}

/** Generate a realistic AWB (Air Waybill) number. */
export function generateAWBNumber(): string {
  const prefix = AIRLINE_PREFIXES[Math.floor(Math.random() * AIRLINE_PREFIXES.length)];
  const serial = String(Math.floor(Math.random() * 100000000)).padStart(8, '0');
  return `${prefix}-${serial}`;
}
