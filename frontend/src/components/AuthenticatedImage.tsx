import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface AuthenticatedImageProps {
  photoId: number;
  alt: string;
  className?: string;
  onClick?: () => void;
}

// The backend signs URLs for 15 minutes; refresh well before that.
const SIGNED_URL_STALE_MS = 10 * 60 * 1000;

// Every call site is a grid tile, so this always shows the thumbnail. With
// bucket storage the backend returns a short-lived signed URL the <img> loads
// directly from the bucket. With local disk (dev) it returns `url: null` and
// the image is fetched as a blob through the shared axios instance (rather
// than a plain <img src="...">) so viewing doesn't depend on the
// frontend/backend ending up same-site for cookies — see implementation plan.
export default function AuthenticatedImage({
  photoId,
  alt,
  className,
  onClick,
}: AuthenticatedImageProps) {
  const queryClient = useQueryClient();
  const resigned = useRef(false);

  const { data: signedUrl } = useQuery({
    queryKey: ["photoUrl", photoId],
    queryFn: async () => {
      const { data } = await api.get<{ url: string | null }>(`/api/photos/${photoId}/url`, {
        params: { size: "thumb" },
      });
      return data.url;
    },
    staleTime: SIGNED_URL_STALE_MS,
  });

  const { data: blob } = useQuery({
    queryKey: ["photoFile", photoId],
    queryFn: async () => {
      const { data } = await api.get<Blob>(`/api/photos/${photoId}/file`, {
        params: { size: "thumb" },
        responseType: "blob",
      });
      return data;
    },
    enabled: signedUrl === null,
  });

  const objectUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  const src = signedUrl ?? objectUrl;

  if (!src) {
    return <div className={className ?? "h-24 w-24 animate-pulse rounded-md bg-muted"} />;
  }

  // A signed URL that expired (e.g. a tab left open) fails to load; re-sign once.
  const handleError = () => {
    if (!signedUrl || resigned.current) return;
    resigned.current = true;
    void queryClient.invalidateQueries({ queryKey: ["photoUrl", photoId] });
  };

  return (
    <img
      src={src}
      alt={alt}
      className={className ?? "h-24 w-24 rounded-md object-cover"}
      onClick={onClick}
      onError={handleError}
    />
  );
}
