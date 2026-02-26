import { useState } from 'react';
import { Wrench } from '@phosphor-icons/react';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { FleetStatusTab } from '../../components/admin/maintenance/FleetStatusTab';
import { MaintenanceLogTab } from '../../components/admin/maintenance/MaintenanceLogTab';
import { CheckSchedulesTab } from '../../components/admin/maintenance/CheckSchedulesTab';
import { AirworthinessDirectivesTab } from '../../components/admin/maintenance/AirworthinessDirectivesTab';
import { MELDeferralsTab } from '../../components/admin/maintenance/MELDeferralsTab';

type MaintenanceTab = 'fleet-status' | 'log' | 'schedules' | 'ads' | 'mel' | 'components';

export function AdminMaintenancePage() {
  const [activeTab, setActiveTab] = useState<MaintenanceTab>('fleet-status');

  const tabs: { key: MaintenanceTab; label: string }[] = [
    { key: 'fleet-status', label: 'Fleet Status' },
    { key: 'log', label: 'Maintenance Log' },
    { key: 'schedules', label: 'Check Schedules' },
    { key: 'ads', label: 'Airworthiness Directives' },
    { key: 'mel', label: 'MEL Deferrals' },
    { key: 'components', label: 'Components' },
  ];

  return (
    <div className="h-full flex flex-col overflow-hidden p-6">
      <AdminPageHeader
        icon={Wrench}
        title="Fleet Maintenance"
        subtitle="Maintenance tracking, inspections, and airworthiness management"
      />

      {/* Tab bar — same styling as AdminFinancesPage */}
      <div className="flex-none flex items-center gap-6 mt-5 border-b border-acars-border">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`pb-2.5 text-xs font-medium transition-colors relative ${
              activeTab === tab.key
                ? 'text-blue-400'
                : 'text-acars-muted hover:text-acars-text'
            }`}
          >
            {tab.label}
            {activeTab === tab.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500 rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 flex flex-col overflow-hidden mt-4">
        {activeTab === 'fleet-status' && <FleetStatusTab />}
        {activeTab === 'log' && <MaintenanceLogTab />}
        {activeTab === 'schedules' && <CheckSchedulesTab />}
        {activeTab === 'ads' && <AirworthinessDirectivesTab />}
        {activeTab === 'mel' && <MELDeferralsTab />}
        {activeTab === 'components' && <div className="panel p-6 text-acars-muted text-sm">Components — coming soon</div>}
      </div>
    </div>
  );
}
