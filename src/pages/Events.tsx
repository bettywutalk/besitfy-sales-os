import { EventImport } from '@/components/EventImport';

export default function Events() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Events</h1>
        <p className="text-muted-foreground text-sm mt-1">上傳活動名單 CSV，自動匯入 Accounts 與 Leads</p>
      </div>
      <EventImport />
    </div>
  );
}
