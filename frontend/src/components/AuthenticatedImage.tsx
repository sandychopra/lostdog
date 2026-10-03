import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface AuthenticatedImageProps {
  photoId: number;
  alt: string;
  className?: string;
  onClick?: () => void;
}

// Fetches the photo as a blob through the shared axios instance (rather than a
// plain <img src="...">) so viewing doesn't depend on the frontend/backend
// ending up same-site for cookies — see implementation plan for details.
export default function AuthenticatedImage({
  photoId,
  alt,
  className,
  onClick,
}: AuthenticatedImageProps) {
  const { data: blob } = useQuery({
    queryKey: ["photoFile", photoId],
    queryFn: async () => {
      const { data } = await api.get<Blob>(`/api/photos/${photoId}/file`, {
        responseType: "blob",
      });
      return data;
    },
  });

  const objectUrl = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);

  useEffect(() => {
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [objectUrl]);

  if (!objectUrl) {
    return <div className={className ?? "h-24 w-24 animate-pulse rounded-md bg-muted"} />;
  }

  return (
    <img
      src={objectUrl}
      alt={alt}
      className={className ?? "h-24 w-24 rounded-md object-cover"}
      onClick={onClick}
    />
  );
}
