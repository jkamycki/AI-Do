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
  if (rawSrc.startsWith("/api/website/media/")) return true;
  if (/^\/api\/website\/public\/[^/]+\/media\//.test(rawSrc)) return true;
  try {
    const url = new URL(rawSrc);
    return url.pathname.startsWith("/api/storage/")
      || url.pathname.startsWith("/api/website/media/")
      || /^\/api\/website\/public\/[^/]+\/media\//.test(url.pathname);
  } catch {
    return false;
  }
}

function objectMediaTail(rawSrc: string | null | undefined): string | null {
  if (!rawSrc || /^(blob:|data:)/i.test(rawSrc)) return null;
  const objectPrefix = "/objects/";
  const storagePrefix = "/storage/objects/";
  const apiStoragePrefix = "/api/storage/objects/";
  const websiteMediaPrefix = "/api/website/media/";
  const pathFrom = (value: string) => {
    try {
      return new URL(value).pathname;
    } catch {
      return value;
    }
  };
  const path = pathFrom(rawSrc);
  if (path.startsWith(apiStoragePrefix)) return path.slice(apiStoragePrefix.length).split(/[?#]/)[0] || null;
  if (path.startsWith(storagePrefix)) return path.slice(storagePrefix.length).split(/[?#]/)[0] || null;
  if (path.startsWith(websiteMediaPrefix)) return path.slice(websiteMediaPrefix.length).split(/[?#]/)[0] || null;
  if (path.startsWith(objectPrefix)) return path.slice(objectPrefix.length).split(/[?#]/)[0] || null;
  const publicMediaMatch = path.match(/\/api\/website\/public\/[^/]+\/media\/(.+)$/);
  if (publicMediaMatch) return publicMediaMatch[1].split(/[?#]/)[0] || null;
  return null;
}

function encodeMediaTail(tail: string): string {
  return tail
    .split("/")
    .filter(Boolean)
    .map((part) => {
      try {
        return encodeURIComponent(decodeURIComponent(part));
      } catch {
        return encodeURIComponent(part);
      }
    })
    .join("/");
}

function authMediaCandidates(rawSrc: string | null | undefined, resolvedSrc: string): string[] {
  const candidates = [resolvedSrc];
  const tail = objectMediaTail(rawSrc) ?? objectMediaTail(resolvedSrc);
  if (tail) {
    const websiteMedia = resolveMediaUrl(`/api/website/media/${encodeMediaTail(tail)}`);
    if (websiteMedia && !candidates.includes(websiteMedia)) candidates.push(websiteMedia);
  }
  return candidates;
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
      const candidates = authMediaCandidates(src, resolvedSrc);
      for (let attempt = 0; attempt < 4 && !cancelled; attempt += 1) {
        let shouldRetry = false;
        for (const candidate of candidates) {
          try {
            const response = await authFetch(candidate);
            if (response.ok && !cancelled) {
              const blob = await response.blob();
              if (cancelled) return;
              const nextBlobSrc = URL.createObjectURL(blob);
              blobRef.current = nextBlobSrc;
              setBlobSrc(nextBlobSrc);
              return;
            }
            shouldRetry ||= response.status === 401 || response.status === 403;
          } catch {
            shouldRetry = true;
          }
        }
        if (!shouldRetry || attempt === 3 || cancelled) return;
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
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
