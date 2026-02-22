// ─────────────────────────────────────────────────────────────
// Regulatory Rule Engine Types
// Grounded in 14 CFR Parts 91, 110, 121 triggering conditions
// ─────────────────────────────────────────────────────────────

/** 14 CFR 110.2 flight classification */
export type FlightClassification = '121_domestic' | '121_flag' | '121_supplemental';

/** Result of classifying a flight per 14 CFR 110.2 */
export interface ClassificationResult {
  classification: FlightClassification;
  reasoning: string[];
  appliedRules: string[];
  etopsRequired: boolean;
  rvsmRequired: boolean;
}

/** ETOPS assessment per 14 CFR 121.7 / Appendix P */
export interface EtopsAssessment {
  applicable: boolean;
  reason: string;
  greatCircleNm: number | null;
  estimatedOverwaterNm: number | null;
}

/** RVSM assessment per 14 CFR 91.706 + Appendix G */
export interface RvsmAssessment {
  applicable: boolean;
  reason: string;
  plannedAltitudeFt: number;
}

/** OpSpec categories per FAA Operations Specifications structure */
export type OpSpecCategory = 'operations' | 'maintenance' | 'routes' | 'special_authority' | 'training';

/** How an OpSpec violation is enforced */
export type OpSpecEnforcement = 'hard_block' | 'soft_warning' | 'info_only' | 'override_available';

/** Operations Specification record */
export interface OpSpec {
  id: number;
  code: string;
  title: string;
  description: string;
  category: OpSpecCategory;
  enforcement: OpSpecEnforcement;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Aircraft airworthiness check per 14 CFR 21.197 logic */
export interface AircraftStatusCheck {
  aircraftId: number | null;
  registration: string | null;
  status: string | null;
  canDispatch: boolean;
  blockReason: string | null;
}

/** Individual compliance check item */
export interface ComplianceItem {
  code: string;
  title: string;
  detail: string;
  severity: 'block' | 'warning' | 'info';
  passed: boolean;
}

/** Full regulatory assessment — aggregate response */
export interface RegulatoryAssessment {
  classification: ClassificationResult;
  etops: EtopsAssessment;
  rvsm: RvsmAssessment;
  aircraftStatus: AircraftStatusCheck;
  applicableOpSpecs: OpSpec[];
  compliance: ComplianceItem[];
  ruleChips: string[];
  dispatchRelease: string | null;
}

/** Response for listing OpSpecs */
export interface OpSpecListResponse {
  opspecs: OpSpec[];
}

/** Request body for updating an OpSpec (admin) */
export interface UpdateOpSpecRequest {
  isActive?: boolean;
  enforcement?: OpSpecEnforcement;
  description?: string;
}
