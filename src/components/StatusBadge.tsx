import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { MEETING_STATUS_COLORS, MEETING_STAGE_COLORS, CUSTOMER_STATUS_COLORS, YAMM_STATUS_COLORS, PRIORITY_COLORS } from '@/lib/constants';
import type { MeetingStatus, MeetingStage, CustomerStatus, YammStatus, Priority } from '@/types';

type StatusType = 'meeting' | 'stage' | 'customer' | 'yamm' | 'priority';

const colorMaps = {
  meeting: MEETING_STATUS_COLORS,
  stage: MEETING_STAGE_COLORS,
  customer: CUSTOMER_STATUS_COLORS,
  yamm: YAMM_STATUS_COLORS,
  priority: PRIORITY_COLORS,
};


interface StatusBadgeProps {
  type: StatusType;
  value: string;
  className?: string;
}

export function StatusBadge({ type, value, className }: StatusBadgeProps) {
  const colors = colorMaps[type] as Record<string, string>;
  const colorClass = colors?.[value] || 'bg-muted text-muted-foreground';

  return (
    <Badge variant="outline" className={cn('font-medium text-xs border', colorClass, className)}>
      {value}
    </Badge>
  );
}
