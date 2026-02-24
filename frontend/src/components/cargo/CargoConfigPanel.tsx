import { Package } from '@phosphor-icons/react';
import { CollapsibleSection } from '../common/CollapsibleSection';
import { useCargoStore } from '../../stores/cargoStore';
import type { CargoCategoryCode } from '@acars/shared';

const CATEGORY_OPTIONS: { value: CargoCategoryCode; label: string }[] = [
  { value: 'general_freight', label: 'General Freight' },
  { value: 'pharmaceuticals', label: 'Pharmaceuticals' },
  { value: 'seafood', label: 'Seafood & Perishables' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'industrial_machinery', label: 'Industrial Machinery' },
  { value: 'automotive', label: 'Automotive Parts' },
  { value: 'textiles', label: 'Textiles & Garments' },
  { value: 'dangerous_goods', label: 'Dangerous Goods' },
  { value: 'live_animals', label: 'Live Animals' },
  { value: 'ecommerce', label: 'E-Commerce' },
];

export function CargoConfigPanel() {
  const { config, setCargoMode, setPrimaryCategory, setUseRealWorldCompanies } = useCargoStore();

  return (
    <CollapsibleSection
      title="Cargo"
      icon={<Package className="w-3.5 h-3.5" />}
      status="grey"
    >
      <div className="space-y-2">
        <div>
          <label className="planning-label">Mode</label>
          <select
            value={config.cargoMode}
            onChange={(e) => setCargoMode(e.target.value as 'mixed' | 'single')}
            className="planning-input"
          >
            <option value="mixed">Mixed Freight</option>
            <option value="single">Single Commodity</option>
          </select>
        </div>

        {config.cargoMode === 'single' && (
          <div>
            <label className="planning-label">Category</label>
            <select
              value={config.primaryCategory}
              onChange={(e) => setPrimaryCategory(e.target.value as CargoCategoryCode)}
              className="planning-input"
            >
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={config.useRealWorldCompanies}
            onChange={(e) => setUseRealWorldCompanies(e.target.checked)}
            className="accent-blue-500"
          />
          <span className="text-[10px] text-acars-muted font-sans">Include real-world company names</span>
        </label>

        <p className="text-[9px] text-acars-muted/60 font-sans">
          Cargo generates automatically with OFP
        </p>
      </div>
    </CollapsibleSection>
  );
}
