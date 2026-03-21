import type { AcarsMessagePayload } from '@acars/shared';
import { AcarsChat } from '@/components/dispatch/AcarsChat';

interface AcarsTabProps {
  bidId: number;
  messages: AcarsMessagePayload[];
}

export default function AcarsTab({ bidId, messages }: AcarsTabProps) {
  return <AcarsChat bidId={bidId} messages={messages} />;
}
