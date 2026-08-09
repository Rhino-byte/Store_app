import { ItemsPageClient } from "@/components/admin/ItemsPageClient";

export default function AdminItemsPage() {
  return (
    <div className="space-y-2">
      <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Items</h1>
      <p className="text-sm text-slate-500">
        Manage item details and reorder levels. Opening stock is set when an
        item is created — use Corrections to adjust live quantity.
      </p>
      <div className="pt-4">
        <ItemsPageClient />
      </div>
    </div>
  );
}
