"use client";

import { useState } from "react";
import { gradientFor } from "@/lib/images";
import { cn } from "@/lib/utils";

/** Image that degrades to a branded gradient if the photo can't load. */
export function SafeImage({
  src,
  alt,
  className,
  seed,
  priority,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  seed?: string;
  priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const bg = gradientFor(seed ?? alt);
  if (!src || failed) {
    return <div role="img" aria-label={alt} className={cn("h-full w-full", className)} style={{ background: bg }} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote photography with graceful fallback
    <img
      src={src}
      alt={alt}
      className={cn("h-full w-full object-cover", className)}
      style={{ background: bg }}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      onError={() => setFailed(true)}
    />
  );
}
