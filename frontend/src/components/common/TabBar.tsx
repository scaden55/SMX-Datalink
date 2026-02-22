interface Tab<T extends string> {
  id: T;
  label: string;
}

interface TabBarProps<T extends string> {
  tabs: Tab<T>[];
  active: T;
  onChange: (id: T) => void;
}

export function TabBar<T extends string>({ tabs, active, onChange }: TabBarProps<T>) {
  return (
    <div className="flex border-b border-acars-border">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`whitespace-nowrap px-3 py-2 text-[11px] uppercase tracking-[0.08em] font-medium font-sans transition-colors ${
            active === tab.id ? 'tab-active' : 'tab-inactive'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
