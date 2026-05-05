import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { authFetch } from "@/lib/authFetch";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type AuthMediaImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
};

function shouldFetchAsBlob(rawSrc: string): boolean {
  if (rawSrc.startsWith("/objects/")) return true;
  if (rawSrc.startsWith("/storage/")) return true;
  if (rawSrc.startsWith("/api/storage/")) return true;
  try {
    const url = new URL(rawSrc);
    return url.pathname.startsWith("/api/storage/");
  } catch {
    return false;
  }
}

export function AuthMediaImage({ src, ...imgProps }: AuthMediaImageProps) {
  const resolvedSrc = resolveMediaUrl(src);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
    setBlobSrc(null);

    if (!resolvedSrc || !shouldFetchAsBlob(src ?? resolvedSrc)) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await authFetch(resolvedSrc);
        if (!response.ok || cancelled) return;
        const blob = await response.blob();
        if (cancelled) return;
        const nextBlobSrc = URL.createObjectURL(blob);
        blobRef.current = nextBlobSrc;
        setBlobSrc(nextBlobSrc);
      } catch {
        // Keep the fallback direct src below; public images may still load directly.
      }
    })();

    return () => {
      cancelled = true;
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [resolvedSrc, src]);

  if (!resolvedSrc) return null;

  return <img {...imgProps} src={blobSrc ?? resolvedSrc} />;
}

export { shouldFetchAsBlob as shouldFetchMediaAsBlob };
