import type { Account, Lead, Organization } from '@/types';

export const mockOrganizations: Organization[] = [
  { id: '5d28a58a-20a2-4af4-b87f-8b75384b22f1', name: 'Insider One', created_at: '2024-01-01' },
  { id: 'b1000000-0000-0000-0000-000000000001', name: 'Besitfy', created_at: '2024-03-15' },
];

export const mockAccounts: Account[] = [
  {
    id: 'acc-1', org_id: 'org-1', account_name: 'PChome', account_name_sf: 'PChome Online',
    country: 'TW', industry: 'Ecommerce', brand: 'PChome 24h', pv_k: 12000,
    platform: 'Magento', martech_stack: ['GA4', 'GTM', 'Insider'], competitor: ['Emarsys'],
    meeting_status: '已約到會議', meeting_stage: '約成功', customer_status: 'Active Customer',
    notes: 'Key account in TW', assigned_to: 'user-1', created_at: '2024-01-15', updated_at: '2024-03-20',
  },
  {
    id: 'acc-2', org_id: 'org-1', account_name: 'momo購物網',
    country: 'TW', industry: 'Ecommerce', brand: 'momo', pv_k: 25000,
    platform: 'Custom', martech_stack: ['GA4', 'Braze'], competitor: ['Insider', 'CleverTap'],
    meeting_status: '追蹤中', meeting_stage: '已接觸，尚需嘗試', customer_status: 'New',
    assigned_to: 'user-2', created_at: '2024-02-10', updated_at: '2024-03-18',
  },
  {
    id: 'acc-3', org_id: 'org-1', account_name: 'Shopee SG',
    country: 'SG', industry: 'Ecommerce', brand: 'Shopee', pv_k: 80000,
    platform: 'Custom', martech_stack: ['Amplitude', 'Braze'], competitor: ['MoEngage'],
    meeting_status: '尚未開發', meeting_stage: '還沒接觸', customer_status: 'New',
    created_at: '2024-03-01', updated_at: '2024-03-15',
  },
  {
    id: 'acc-4', org_id: 'org-1', account_name: 'HSBC HK',
    country: 'HK', industry: 'FinTech', brand: 'HSBC', pv_k: 5000,
    platform: 'Custom', martech_stack: ['Adobe Analytics'], competitor: ['Salesforce'],
    meeting_status: '追蹤中', meeting_stage: '已接觸，等窗口回覆', customer_status: 'Close Lost - reactivate',
    assigned_to: 'user-1', created_at: '2024-01-20', updated_at: '2024-03-10',
  },
  {
    id: 'acc-5', org_id: 'org-1', account_name: 'Cathay United Bank',
    country: 'TW', industry: 'FinTech', brand: 'Cathay', pv_k: 3500,
    platform: 'Custom', martech_stack: ['GA4'], competitor: [],
    meeting_status: '尚未開發', meeting_stage: '還沒接觸', customer_status: 'non-ICP',
    created_at: '2024-02-28', updated_at: '2024-03-05',
  },
];

export const mockLeads: Lead[] = [
  {
    id: 'lead-1', org_id: 'org-1', account_id: 'acc-1', first_name: '志明', last_name: '王',
    title: 'VP of Marketing', is_manager: true, is_foreigner: false,
    email: 'wang.zm@pchome.com.tw', email_status: 'valid', priority: 'High',
    tags: ['decision-maker', 'martech'], linkedin_engaged: true,
    yamm_status: 'RESPONDED', created_at: '2024-01-20', updated_at: '2024-03-15',
    account_name: 'PChome', account_country: 'TW', account_industry: 'Ecommerce',
    account_customer_status: 'Active Customer', account_meeting_status: '已約到會議',
  },
  {
    id: 'lead-2', org_id: 'org-1', account_id: 'acc-1', first_name: '美華', last_name: '陳',
    title: 'Marketing Manager', is_manager: true, is_foreigner: false,
    email: 'chen.mh@pchome.com.tw', email_status: 'valid', priority: 'Medium',
    tags: ['influencer'], linkedin_engaged: false,
    yamm_status: 'EMAIL_OPENED', created_at: '2024-02-01', updated_at: '2024-03-10',
    account_name: 'PChome', account_country: 'TW', account_industry: 'Ecommerce',
    account_customer_status: 'Active Customer', account_meeting_status: '已約到會議',
  },
  {
    id: 'lead-3', org_id: 'org-1', account_id: 'acc-2', first_name: 'Jason', last_name: 'Lee',
    title: 'Head of Growth', is_manager: true, is_foreigner: true,
    email: 'jason.lee@momo.com', email_status: 'valid', priority: 'High',
    tags: ['growth', 'data-driven'], linkedin_engaged: true,
    yamm_status: 'EMAIL_SENT', created_at: '2024-02-15', updated_at: '2024-03-18',
    account_name: 'momo購物網', account_country: 'TW', account_industry: 'Ecommerce',
    account_customer_status: 'New', account_meeting_status: '追蹤中',
  },
  {
    id: 'lead-4', org_id: 'org-1', account_id: 'acc-3', first_name: 'Sarah', last_name: 'Tan',
    title: 'CTO', is_manager: true, is_foreigner: true,
    email: 'sarah.tan@shopee.sg', email_status: 'bounced', priority: 'Low',
    tags: ['tech'], linkedin_engaged: false, bounce_note: 'mailbox full',
    yamm_status: 'BOUNCED', created_at: '2024-03-05', updated_at: '2024-03-15',
    account_name: 'Shopee SG', account_country: 'SG', account_industry: 'Ecommerce',
    account_customer_status: 'New', account_meeting_status: '尚未開發',
  },
  {
    id: 'lead-5', org_id: 'org-1', account_id: 'acc-4', first_name: 'David', last_name: 'Wong',
    title: 'Digital Marketing Director', is_manager: true, is_foreigner: true,
    email: 'david.wong@hsbc.com.hk', email_status: 'valid', priority: 'Medium',
    tags: ['banking', 'digital'], linkedin_engaged: true,
    yamm_status: '未發', created_at: '2024-01-25', updated_at: '2024-03-10',
    account_name: 'HSBC HK', account_country: 'HK', account_industry: 'FinTech',
    account_customer_status: 'Close Lost - reactivate', account_meeting_status: '追蹤中',
  },
];
