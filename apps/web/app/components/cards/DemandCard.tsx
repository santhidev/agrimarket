import Link from "next/link";
import { Clock, MapPin } from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import { Badge } from "@/app/components/ui/Badge";
import { Button } from "@/app/components/ui/Button";

export type Demand = {
  id: string;
  product: string;
  image: string;
  status: "OPEN" | "MATCHED" | "COMPLETED" | "EXPIRED" | "CANCELLED";
  grade: string;
  quantity: string;
  priceLabel: string;
  deadlineLabel: string;
  offerCount: number;
  distanceLabel: string;
};

export function DemandCard({ demand }: { demand: Demand }) {
  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative">
        <img
          src={demand.image}
          alt={demand.product}
          className="w-full h-40 object-cover bg-green-50"
        />
        <div className="absolute top-2 left-2">
          <Badge status={demand.status} />
        </div>
        <span className="absolute top-2 left-16 inline-flex items-center px-2 py-0.5 rounded-chip text-xs font-medium bg-white/90 text-ink">
          เกรด {demand.grade}
        </span>
      </div>

      <div className="p-4 space-y-2">
        <h4 className="font-semibold text-ink">{demand.product}</h4>
        <p className="text-xs text-muted">รับซื้อ {demand.quantity}</p>

        <p className="text-lg font-bold text-accent">{demand.priceLabel}</p>

        <div className="flex items-center gap-3 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Clock size={12} /> {demand.deadlineLabel}
          </span>
          <span className="flex items-center gap-1">
            <MapPin size={12} /> {demand.distanceLabel}
          </span>
        </div>
        <span className="block text-xs text-muted">{demand.offerCount} เสนอ</span>

        <div className="flex gap-2 pt-1">
          <Button href="/demands" variant="outline" size="sm">
            ดู
          </Button>
          <Button href="/login" variant="primary" size="sm">
            เสนอขาย
          </Button>
        </div>
      </div>
    </Card>
  );
}
