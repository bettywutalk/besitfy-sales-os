import type { MeetingStatus, MeetingStage, CustomerStatus, YammStatus, Priority } from '@/types';

export const MEETING_STATUS_COLORS: Record<MeetingStatus, string> = {
  '尚未開發': 'bg-muted text-muted-foreground',
  '追蹤中': 'bg-warning/15 text-warning border-warning/30',
  '已約到會議': 'bg-success/15 text-success border-success/30',
  '不用約（既有客戶）': 'bg-accent text-accent-foreground border-accent/30',
  '不用約（non-ICP）': 'bg-muted text-muted-foreground border-muted/30',
};

export const MEETING_STAGE_COLORS: Record<MeetingStage, string> = {
  '還沒接觸': 'bg-muted text-muted-foreground',
  '已接觸，尚需嘗試': 'bg-warning/15 text-warning border-warning/30',
  '已接觸，等窗口回覆': 'bg-primary/15 text-primary border-primary/30',
  '約失敗': 'bg-destructive/15 text-destructive border-destructive/30',
  '約成功': 'bg-success/15 text-success border-success/30',
  '無需約': 'bg-muted text-muted-foreground border-muted/30',
};

export const CUSTOMER_STATUS_COLORS: Record<CustomerStatus, string> = {
  'Active Customer': 'bg-success/15 text-success border-success/30',
  'Churn': 'bg-destructive/15 text-destructive border-destructive/30',
  'Close Lost': 'bg-muted text-muted-foreground',
  'Close Lost - reactivate': 'bg-warning/15 text-warning border-warning/30',
  'New': 'bg-primary/15 text-primary border-primary/30',
  'non-ICP': 'bg-muted text-muted-foreground',
};

export const YAMM_STATUS_COLORS: Record<YammStatus, string> = {
  '未發': 'bg-muted text-muted-foreground',
  'EMAIL_SENT': 'bg-primary/15 text-primary border-primary/30',
  'EMAIL_OPENED': 'bg-info/15 text-info border-info/30',
  'RESPONDED': 'bg-success/15 text-success border-success/30',
  'BOUNCED': 'bg-destructive/15 text-destructive border-destructive/30',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  'High': 'bg-destructive/15 text-destructive border-destructive/30',
  'Medium': 'bg-warning/15 text-warning border-warning/30',
  'Low': 'bg-muted text-muted-foreground',
};

export const COUNTRY_OPTIONS = ['TW', 'HK', 'CN', 'SG', 'JP', 'KR', 'US', 'Other'] as const;
