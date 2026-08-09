"use client";

import Image from "next/image";
import { useState } from "react";

import {
  normalizeRiotRankedTier,
  riotProfileIconUrl,
  riotRankedEmblemPath,
} from "@/lib/riot-assets";

export function RiotProfileIcon({
  profileIconId,
  gameName,
  size = 56,
}: {
  profileIconId: number | null;
  gameName: string;
  size?: number;
}) {
  const src = riotProfileIconUrl(profileIconId);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src && failedSrc !== src);

  return (
    <span
      className="riot-profile-icon"
      role="img"
      aria-label={`${gameName} 프로필 아이콘`}
      style={{ width: size, height: size }}
    >
      <span aria-hidden="true">{gameName.trim().slice(0, 1) || "?"}</span>
      {showImage && src ? (
        <Image
          src={src}
          alt=""
          width={size}
          height={size}
          sizes={`${size}px`}
          onError={() => setFailedSrc(src)}
        />
      ) : null}
    </span>
  );
}

export function RiotRankEmblem({
  tier,
  size = 144,
}: {
  tier: string | null | undefined;
  size?: number;
}) {
  const normalizedTier = normalizeRiotRankedTier(tier);
  const src = riotRankedEmblemPath(normalizedTier);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const showImage = Boolean(src && failedSrc !== src);
  const label = normalizedTier ?? "UNRANKED";

  return (
    <figure className="riot-rank-emblem">
      <div
        className="riot-rank-emblem-art"
        role="img"
        aria-label={
          normalizedTier ? `${normalizedTier} 티어 엠블럼` : "랭크 배치 전"
        }
        style={{ width: size, height: size }}
      >
        {showImage && src ? (
          <Image
            src={src}
            alt=""
            width={size}
            height={size}
            sizes={`${size}px`}
            onError={() => setFailedSrc(src)}
          />
        ) : (
          <span aria-hidden="true">—</span>
        )}
      </div>
      <figcaption>{label}</figcaption>
    </figure>
  );
}
