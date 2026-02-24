import { AirportGroundChart } from '../ground-chart/AirportGroundChart';

interface GroundChartTabProps {
  icao: string;
}

export function GroundChartTab({ icao }: GroundChartTabProps) {
  return (
    <div className="min-h-[200px] h-[400px] max-h-full w-full">
      <AirportGroundChart icao={icao} className="h-full" />
    </div>
  );
}
