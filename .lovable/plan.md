## 計畫：Besitfy 組織功能擴充

### 第一步：資料庫調整
- 在 `accounts` 表新增 `metadata JSONB` 欄位，存放各組織的自定義欄位
- besitfy 的 metadata 欄位包含：`icp`, `priority`, `icp_grade`, `brand_intro`, `pr_usage`, `interaction_progress`, `metis_progress`, `pain_points`, `approve`, `start_date`, `reassign_date` 等
- 建立 `homepage_sections` 表（CMS），存放首頁的 SOP 流程、Checklist、資源連結，by org_id
- 在 `organization_members` 表新增 `region`, `industry_focus`, `supervisor_id` 欄位（夥伴清單用）

### 第二步：首頁（CMS 模式）
- 新增 `/home` 頁面，顯示：
  - Onboarding Checklist（可打勾）
  - 約會議 SOP 流程圖
  - 相關連結/Training 資源列表
- 管理員可編輯首頁內容（新增/修改/刪除 section）
- 資料存在 `homepage_sections` 表

### 第三步：夥伴管理頁面
- 新增 `/partners` 頁面
- 顯示所有夥伴（org members）的：姓名、分工選項、負責地區、負責產業、直屬主管
- 管理員可編輯分工和指派

### 第四步：Account 頁面適配
- 根據當前組織動態顯示不同欄位
- Insider One：顯示現有欄位（meeting_status, meeting_stage 等）
- besitfy：顯示 ICP、互動進度、PR 使用程度、Metis AI 進度等 metadata 欄位

### 第五步：匯入 besitfy 現有資料
- 從上傳的 xlsx 匯入 Account 和 Lead 資料到新組織
