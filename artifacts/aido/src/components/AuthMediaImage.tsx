import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { authFetch } from "@/lib/authFetch";
import { resolveMediaUrl } from "@/lib/mediaUrl";

type AuthMediaImageProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src: string | null | undefined;
};

const authMediaBlobCache = new Map<string, string>();
const authMediaBlobInflight = new Map<string, Promise<string | null>>();

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
  const candidates: string[] = [];
  const rawPath = rawSrc
    ? (() => {
        try {
          return new URL(rawSrc).pathname;
        } catch {
          return rawSrc;
        }
      })()
    : "";
  const resolvedPath = (() => {
    try {
      return new URL(resolvedSrc).pathname;
    } catch {
      return resolvedSrc;
    }
  })();
  if (
    /^\/api\/website\/public\/[^/]+\/media\//.test(rawPath) ||
    /^\/api\/website\/public\/[^/]+\/media\//.test(resolvedPath)
  ) {
    candidates.push(resolvedSrc);
    return candidates;
  }
  const tail = objectMediaTail(rawSrc) ?? objectMediaTail(resolvedSrc);
  if (tail) {
    const websiteMedia = resolveMediaUrl(`/api/website/media/${encodeMediaTail(tail)}`);
    if (websiteMedia && !candidates.includes(websiteMedia)) candidates.push(websiteMedia);
  }
  if (!candidates.includes(resolvedSrc)) candidates.push(resolvedSrc);
  return candidates;
}

export function preloadAuthMediaImage(src: string | null | undefined): Promise<string | null> {
  const resolvedSrc = resolveMediaUrl(src);
  if (!resolvedSrc) return Promise.resolve(null);
  const fetchAsBlob = shouldFetchAsBlob(src ?? resolvedSrc);
  if (!fetchAsBlob) {
    if (typeof window !== "undefined") {
      const image = new Image();
      image.decoding = "async";
      image.src = resolvedSrc;
    }
    return Promise.resolve(resolvedSrc);
  }

  const candidates = authMediaCandidates(src, resolvedSrc);
  const cached = [resolvedSrc, ...(src ? [src] : []), ...candidates]
    .map((key) => authMediaBlobCache.get(key))
    .find(Boolean);
  if (cached) return Promise.resolve(cached);

  const cacheKey = candidates[0] ?? resolvedSrc;
  let loadPromise = authMediaBlobInflight.get(cacheKey);
  if (!loadPromise) {
    loadPromise = (async () => {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        let shouldRetry = false;
        for (const candidate of candidates) {
          try {
            const response = await authFetch(candidate);
            if (response.ok) {
              const blob = await response.blob();
              const nextBlobSrc = URL.createObjectURL(blob);
              authMediaBlobCache.set(resolvedSrc, nextBlobSrc);
              if (src) authMediaBlobCache.set(src, nextBlobSrc);
              for (const cacheCandidate of candidates) {
                authMediaBlobCache.set(cacheCandidate, nextBlobSrc);
              }
              return nextBlobSrc;
            }
            shouldRetry ||= response.status === 401 || response.status === 403;
          } catch {
            shouldRetry = true;
          }
        }
        if (!shouldRetry || attempt === 3) return null;
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
      return null;
    })().finally(() => {
      authMediaBlobInflight.delete(cacheKey);
    });
    authMediaBlobInflight.set(cacheKey, loadPromise);
  }
  return loadPromise;
}

export function AuthMediaImage({ src, ...imgProps }: AuthMediaImageProps) {
  const resolvedSrc = resolveMediaUrl(src);
  const fetchAsBlob = !!resolvedSrc && shouldFetchAsBlob(src ?? resolvedSrc);
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const blobRef = useRef<string | null>(null);

  useEffect(() => {
    if (blobRef.current && !authMediaBlobCache.has(resolvedSrc ?? "")) {
      URL.revokeObjectURL(blobRef.current);
      blobRef.current = null;
    }
    setBlobSrc(null);

    if (!resolvedSrc || !fetchAsBlob) return;

    const candidates = authMediaCandidates(src, resolvedSrc);
    const cached = [resolvedSrc, ...(src ? [src] : []), ...candidates]
      .map((key) => authMediaBlobCache.get(key))
      .find(Boolean);
    if (cached) {
      blobRef.current = cached;
      setBlobSrc(cached);
      return;
    }

    let cancelled = false;
    const cacheKey = candidates[0] ?? resolvedSrc;
    let loadPromise = authMediaBlobInflight.get(cacheKey);
    if (!loadPromise) {
      loadPromise = (async () => {
      for (let attempt = 0; attempt < 4 && !cancelled; attempt += 1) {
        let shouldRetry = false;
        for (const candidate of candidates) {
          try {
            const response = await authFetch(candidate);
            if (response.ok) {
              const blob = await response.blob();
              const nextBlobSrc = URL.createObjectURL(blob);
              authMediaBlobCache.set(resolvedSrc, nextBlobSrc);
              if (src) authMediaBlobCache.set(src, nextBlobSrc);
              for (const cacheCandidate of candidates) {
                authMediaBlobCache.set(cacheCandidate, nextBlobSrc);
              }
              return nextBlobSrc;
            }
            shouldRetry ||= response.status === 401 || response.status === 403;
          } catch {
            shouldRetry = true;
          }
        }
        if (!shouldRetry || attempt === 3 || cancelled) return null;
        await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
      }
      return null;
      })().finally(() => {
        authMediaBlobInflight.delete(cacheKey);
      });
      authMediaBlobInflight.set(cacheKey, loadPromise);
    }
    loadPromise.then((nextBlobSrc) => {
      if (!nextBlobSrc || cancelled) return;
      blobRef.current = nextBlobSrc;
      setBlobSrc(nextBlobSrc);
    });

    return () => {
      cancelled = true;
      if (blobRef.current && !authMediaBlobCache.has(resolvedSrc)) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [fetchAsBlob, resolvedSrc, src]);

  if (!resolvedSrc) return null;

  return <img {...imgProps} src={blobSrc ?? (fetchAsBlob ? undefined : resolvedSrc)} />;
}

export { shouldFetchAsBlob as shouldFetchMediaAsBlob };
