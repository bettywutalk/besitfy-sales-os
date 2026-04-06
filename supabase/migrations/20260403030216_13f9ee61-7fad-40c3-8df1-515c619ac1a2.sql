ALTER TABLE public.accounts
ADD COLUMN meeting_stage text NOT NULL DEFAULT '還沒接觸';

COMMENT ON COLUMN public.accounts.meeting_stage IS '約會議進度階段: 還沒接觸/已接觸，尚需嘗試/已接觸，等窗口回覆/約失敗/約成功';