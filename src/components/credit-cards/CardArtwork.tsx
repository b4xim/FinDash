"use client";

// ============================================================
// CardArtwork — displays a credit card's physical artwork image.
// Falls back to a bank-colored div with a credit card icon if
// the image asset is missing or fails to load.
//
// Props:
//   cardName — must match a key in CREDIT_CARD_CONFIGS
//   size     — "sm" (40×25), "md" (64×40), "lg" (96×60)
// ============================================================

import { useState } from "react";
import Image from "next/image";
import { CreditCard } from "lucide-react";
import { getCardConfig } from "@/lib/creditCardConfig";

type CardSize = "sm" | "md" | "lg";

const SIZE_DIMS: Record<CardSize, { w: number; h: number; iconSize: number; className: string }> = {
  sm: { w: 48,  h: 30,  iconSize: 12, className: "w-12 h-[30px]" },
  md: { w: 72,  h: 44,  iconSize: 16, className: "w-[72px] h-11" },
  lg: { w: 112, h: 70,  iconSize: 22, className: "w-28 h-[70px]" },
};

interface CardArtworkProps {
  cardName: string;
  size?: CardSize;
  className?: string;
}

export default function CardArtwork({ cardName, size = "md", className = "" }: CardArtworkProps) {
  const [imgError, setImgError] = useState(false);
  const config = getCardConfig(cardName);
  const dims = SIZE_DIMS[size];

  const bankColor = config?.bankColor ?? "#4A5270";
  const imagePath = config?.imagePath ?? "";
  const hasImage  = !!imagePath && !imgError;

  if (hasImage) {
    return (
      <div
        className={`${dims.className} rounded-lg overflow-hidden flex-shrink-0 relative ${className}`}
        style={{ boxShadow: `0 2px 8px ${bankColor}33` }}
      >
        <Image
          src={imagePath}
          alt={`${cardName} card`}
          fill
          className="object-cover"
          onError={() => setImgError(true)}
          sizes={`${dims.w}px`}
        />
      </div>
    );
  }

  // Fallback: bank-colored gradient background + CreditCard icon
  return (
    <div
      className={`${dims.className} rounded-lg flex items-center justify-center flex-shrink-0 ${className}`}
      style={{
        background: `linear-gradient(135deg, ${bankColor}DD, ${bankColor}88)`,
        boxShadow: `0 2px 8px ${bankColor}33`,
      }}
    >
      <CreditCard
        size={dims.iconSize}
        className="text-white/90"
        strokeWidth={1.5}
      />
    </div>
  );
}
