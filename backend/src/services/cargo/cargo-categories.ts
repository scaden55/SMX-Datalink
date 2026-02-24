// ─── Cargo Categories ───────────────────────────────────────
// 10 cargo categories with metadata, descriptions, and weight ranges.

export interface CargoCategory {
  name: string;
  code: string;
  description: string;
  tempControlled: boolean;
  tempRange?: { min: number; max: number; unit: string };
  hazmat: boolean;
  notocRequired: boolean;
  lithiumBattery?: boolean;
  dgClasses?: string[];
  descriptions: string[];
  weightRange: { min: number; max: number };
}

export const CARGO_CATEGORIES: Record<string, CargoCategory> = {
  general_freight: {
    name: 'General Freight',
    code: 'GEN',
    description: 'Mixed general cargo shipments',
    tempControlled: false,
    hazmat: false,
    notocRequired: false,
    descriptions: [
      'Assorted consumer goods', 'Industrial supplies', 'Building materials',
      'Office equipment and supplies', 'Household furnishings', 'Sports equipment',
      'Garden supplies and tools', 'Packaging materials', 'Hardware and fasteners',
      'General merchandise',
    ],
    weightRange: { min: 200, max: 4500 },
  },
  pharmaceuticals: {
    name: 'Pharmaceuticals',
    code: 'PIL',
    description: 'Temperature-controlled pharmaceutical shipments',
    tempControlled: true,
    tempRange: { min: 2, max: 8, unit: '°C' },
    hazmat: false,
    notocRequired: false,
    descriptions: [
      'Vaccines (cold chain)', 'Injectable medications', 'Diagnostic reagents',
      'Biomedical samples', 'Pharmaceutical intermediates', 'Clinical trial materials',
      'Surgical supplies', 'Medical devices', 'Laboratory specimens',
      'Specialty pharmaceuticals',
    ],
    weightRange: { min: 100, max: 3000 },
  },
  seafood: {
    name: 'Seafood & Perishables',
    code: 'PER',
    description: 'Fresh and frozen perishable goods',
    tempControlled: true,
    tempRange: { min: -18, max: 4, unit: '°C' },
    hazmat: false,
    notocRequired: false,
    descriptions: [
      'Fresh Atlantic salmon', 'Frozen shrimp', 'Live lobster', 'Tuna steaks',
      'Fresh oysters', 'Frozen crab meat', 'Fresh flowers (cut stems)',
      'Exotic tropical fruits', 'Premium beef cuts', 'Organic produce',
    ],
    weightRange: { min: 200, max: 4000 },
  },
  electronics: {
    name: 'Electronics',
    code: 'ELE',
    description: 'Consumer and industrial electronics',
    tempControlled: false,
    hazmat: false,
    notocRequired: false,
    lithiumBattery: true,
    descriptions: [
      'Smartphones and tablets', 'Laptop computers', 'Server components',
      'Semiconductor wafers', 'Display panels (LED/OLED)', 'Networking equipment',
      'Consumer audio equipment', 'Camera systems', 'Industrial controllers',
      'Printed circuit boards',
    ],
    weightRange: { min: 100, max: 3500 },
  },
  industrial_machinery: {
    name: 'Industrial Machinery',
    code: 'MCH',
    description: 'Heavy industrial equipment and parts',
    tempControlled: false,
    hazmat: false,
    notocRequired: false,
    descriptions: [
      'CNC machine components', 'Hydraulic press parts', 'Industrial pumps',
      'Generator assemblies', 'Turbine blades', 'Mining drill bits',
      'Conveyor system parts', 'Industrial robotics arms', 'Compressor units',
      'Precision bearings and gears',
    ],
    weightRange: { min: 500, max: 5000 },
  },
  automotive: {
    name: 'Automotive Parts',
    code: 'AUT',
    description: 'Vehicle components and spare parts',
    tempControlled: false,
    hazmat: false,
    notocRequired: false,
    descriptions: [
      'Engine block assemblies', 'Transmission units', 'Body panels (stamped)',
      'Brake system components', 'Exhaust catalytic converters', 'Dashboard modules',
      'Windshield assemblies', 'Suspension springs', 'Steering column assemblies',
      'Wiring harnesses',
    ],
    weightRange: { min: 300, max: 4500 },
  },
  textiles: {
    name: 'Textiles & Garments',
    code: 'TEX',
    description: 'Clothing, fabrics, and textile products',
    tempControlled: false,
    hazmat: false,
    notocRequired: false,
    descriptions: [
      'Designer fashion garments', 'Denim rolls', 'Synthetic fabrics',
      'Wool bales', 'Silk textiles', 'Athletic sportswear', 'Leather goods',
      'Carpet rolls', 'Bedding and linens', 'Uniforms and workwear',
    ],
    weightRange: { min: 100, max: 3000 },
  },
  dangerous_goods: {
    name: 'Dangerous Goods',
    code: 'DGR',
    description: 'Hazardous materials requiring special handling',
    tempControlled: false,
    hazmat: true,
    notocRequired: true,
    dgClasses: ['1.4S', '2.1', '2.2', '3', '4.1', '5.1', '6.1', '8', '9'],
    descriptions: [
      'Flammable liquids (Class 3)', 'Compressed gases (Class 2.2)',
      'Corrosive substances (Class 8)', 'Oxidizing agents (Class 5.1)',
      'Toxic substances (Class 6.1)', 'Flammable solids (Class 4.1)',
      'Lithium ion batteries (Class 9)', 'Aerosol containers (Class 2.1)',
      'Ammunition cartridges (Class 1.4S)', 'Environmentally hazardous (Class 9)',
    ],
    weightRange: { min: 50, max: 2000 },
  },
  live_animals: {
    name: 'Live Animals',
    code: 'AVI',
    description: 'Live animal transport with climate control',
    tempControlled: true,
    tempRange: { min: 15, max: 25, unit: '°C' },
    hazmat: false,
    notocRequired: true,
    descriptions: [
      'Racing horses', 'Breeding cattle', 'Zoo animals (primate)',
      'Tropical fish (aquarium)', 'Exotic reptiles', 'Day-old chicks',
      'Laboratory animals', 'Police/military dogs', 'Endangered species (CITES)',
      'Ornamental birds',
    ],
    weightRange: { min: 200, max: 4000 },
  },
  ecommerce: {
    name: 'E-Commerce',
    code: 'ECM',
    description: 'Online retail and fulfillment shipments',
    tempControlled: false,
    hazmat: false,
    notocRequired: false,
    descriptions: [
      'Mixed consumer parcels', 'Fashion and apparel orders', 'Home goods assortment',
      'Beauty and personal care', 'Books and media', 'Pet supplies',
      'Kitchen and dining', 'Health supplements', 'Toy and game shipments',
      'Electronics accessories',
    ],
    weightRange: { min: 100, max: 3500 },
  },
};

/** Get a random description for a category. */
export function getRandomDescription(categoryCode: string): string {
  const cat = CARGO_CATEGORIES[categoryCode];
  if (!cat) return 'General cargo';
  return cat.descriptions[Math.floor(Math.random() * cat.descriptions.length)];
}

/** Get a random weight within a category's weight range. */
export function getRandomWeight(categoryCode: string): number {
  const cat = CARGO_CATEGORIES[categoryCode];
  if (!cat) return 1000;
  const { min, max } = cat.weightRange;
  return Math.round(min + Math.random() * (max - min));
}
