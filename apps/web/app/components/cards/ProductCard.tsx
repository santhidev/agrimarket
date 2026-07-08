"use client";

import { useState } from "react";
import { Heart, Leaf } from "lucide-react";
import { Card } from "@/app/components/ui/Card";

export type Product = {
  id: string;
  name: string;
  image: string;
  category: string;
  grades: string[];
  unit: string;
  followers: number;
};

export function ProductCard({ product }: { product: Product }) {
  const [liked, setLiked] = useState(false);

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
      <div className="relative bg-green-50">
        {product.image ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full aspect-square object-cover"
          />
        ) : (
          <div className="w-full aspect-square flex items-center justify-center">
            <Leaf size={40} className="text-green-200" aria-hidden="true" />
          </div>
        )}
        <span className="absolute top-2 left-2 bg-green-50/90 text-green-600 text-xs px-2 py-0.5 rounded-chip font-medium border border-green-100">
          {product.category}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setLiked((v) => !v);
          }}
          className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center"
          aria-label={liked ? "เลิกติดตาม" : "ติดตามสินค้า"}
          aria-pressed={liked}
        >
          <Heart
            size={15}
            fill={liked ? "#C62828" : "none"}
            className={liked ? "text-error" : "text-muted"}
          />
        </button>
      </div>

      <div className="p-3">
        <h4 className="font-semibold text-sm text-ink">{product.name}</h4>
        <div className="flex items-center gap-1 mt-0.5">
          {product.grades.map((g) => (
            <span
              key={g}
              className="text-xs bg-surface px-1.5 py-0.5 rounded text-muted font-medium"
            >
              {g}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-muted">{product.unit}</p>
          <p className="flex items-center gap-1 text-xs text-muted tnum">
            <Heart size={12} className="text-muted" aria-hidden="true" />
            {product.followers}
          </p>
        </div>
      </div>
    </Card>
  );
}
