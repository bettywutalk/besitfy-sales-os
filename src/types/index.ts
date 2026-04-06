// Enums
export type MeetingStatus = '尚未開發' | '追蹤中' | '已約到會議' | '不用約（既有客戶）' | '不用約（non-ICP）';
export type MeetingStage = '還沒接觸' | '已接觸，尚需嘗試' | '已接觸，等窗口回覆' | '約失敗' | '約成功' | '無需約';
export type CustomerStatus = 'Active Customer' | 'Churn' | 'Close Lost' | 'Close Lost - reactivate' | 'New' | 'non-ICP';
export type YammStatus = '未發' | 'EMAIL_SENT' | 'EMAIL_OPENED' | 'RESPONDED' | 'BOUNCED';
export type Priority = 'High' | 'Medium' | 'Low';
export type CallResult = '未接' | '已接' | '有效通話';
export type OrgRole = 'admin' | 'sales_manager' | 'sales_rep' | 'partner';

export const MEETING_STATUS_OPTIONS: MeetingStatus[] = ['尚未開發', '追蹤中', '已約到會議', '不用約（既有客戶）', '不用約（non-ICP）'];
export const MEETING_STAGE_OPTIONS: MeetingStage[] = ['還沒接觸', '已接觸，尚需嘗試', '已接觸，等窗口回覆', '約失敗', '約成功', '無需約'];
export const CUSTOMER_STATUS_OPTIONS: CustomerStatus[] = ['Active Customer', 'Churn', 'Close Lost', 'Close Lost - reactivate', 'New', 'non-ICP'];
export const YAMM_STATUS_OPTIONS: YammStatus[] = ['未發', 'EMAIL_SENT', 'EMAIL_OPENED', 'RESPONDED', 'BOUNCED'];
export const PRIORITY_OPTIONS: Priority[] = ['High', 'Medium', 'Low'];
export const INDUSTRY_OPTIONS = ['Ecommerce', 'SaaS', 'FinTech', 'Gaming', 'Media', 'Travel', 'Education', 'Healthcare', 'Retail', 'F&B', 'Real Estate', 'Other'] as const;
export const PRODUCT_INTEREST_OPTIONS = ['未評估', '有興趣', '考慮中', '無興趣'] as const;
export const COUNTRY_OPTIONS = ['TW', 'HK', 'CN', 'SG', 'Other'] as const;

export interface Organization {
  id: string;
  name: string;
  logo_url?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  avatar_url?: string;
  current_org_id?: string;
}

export interface OrganizationMember {
  id: string;
  org_id: string;
  user_id: string;
  role: OrgRole;
  joined_at: string;
}

export interface AiFields {
  [field: string]: 'pending' | 'verified';
}

export interface AccountMetadata {
  ai_fields?: AiFields;
  [key: string]: any;
}

export interface Account {
  id: string;
  org_id: string;
  account_name: string;
  account_name_sf?: string;
  domain_key?: string;
  country: string;
  industry: string;
  brand?: string;
  pv_k?: number;
  platform?: string;
  martech_stack?: string[];
  competitor?: string[];
  mtu?: number;
  ec_link?: string;
  meeting_status: MeetingStatus;
  meeting_stage: MeetingStage;
  customer_status: CustomerStatus;
  notes?: string;
  assigned_to?: string;
  metadata?: AccountMetadata | null;
  line_friends?: number;
  interest_pr?: string;
  notes_pr?: string;
  interest_csbot?: string;
  notes_csbot?: string;
  created_at: string;
  updated_at: string;
}

export interface Lead {
  id: string;
  org_id: string;
  account_id?: string;
  first_name: string;
  last_name: string;
  title?: string;
  is_manager: boolean;
  is_foreigner: boolean;
  email?: string;
  email_status?: string;
  phone?: string;
  linkedin_url?: string;
  pic?: string;
  priority: Priority;
  tags?: string[];
  note?: string;
  lead_source_status?: string;
  linkedin_engaged: boolean;
  linkedin_messaged_at?: string;
  yamm_status: YammStatus;
  yamm_last_sent?: string;
  bounce_note?: string;
  created_at: string;
  updated_at: string;
  // Joined from account
  account_name?: string;
  account_country?: string;
  account_industry?: string;
  account_customer_status?: CustomerStatus;
  account_meeting_status?: MeetingStatus;
}

export const CALL_RESULT_OPTIONS: CallResult[] = ['未接', '已接', '有效通話'];

export interface CallLog {
  id: string;
  org_id: string;
  lead_id: string;
  account_id?: string;
  called_by: string;
  call_result: CallResult;
  note?: string;
  called_at: string;
  created_at: string;
}

export interface Segment {
  id: string;
  org_id: string;
  name: string;
  filter_rules: FilterRule[];
  owner_user_id: string;
  is_shared: boolean;
  created_at: string;
}

export interface FilterRule {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'is_empty' | 'is_not_empty';
  value: string | string[];
  conjunction: 'AND' | 'OR';
}
