import { Card, CardContent } from "@/components/ui/card";
import type { StockHealthSnapshot } from "@/lib/analytics";

interface StockHealthCardsProps {
  health: StockHealthSnapshot;
}

export function StockHealthCards({ health }: StockHealthCardsProps) {
  const cards = [
    { label: "Total items", value: health.totalItems },
    { label: "Low stock", value: health.lowStockCount },
    { label: "Out of stock", value: health.outOfStockCount },
    { label: "At / below reorder", value: health.atOrBelowReorderCount },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="p-4">
            <p className="text-sm text-slate-500">{card.label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">
              {card.value}
            </p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
