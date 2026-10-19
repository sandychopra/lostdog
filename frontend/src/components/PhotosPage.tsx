import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Download, Pencil } from "lucide-react";
import { Role } from "shared/constants/role.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import { downloadFromApi } from "../lib/download";
import { catOptionLabel, useCatOptions } from "../lib/useCatOptions";
import type { CatOption } from "./CatMultiSelect";
import AuthenticatedImage from "./AuthenticatedImage";
import ErrorAlert from "./ErrorAlert";
import Navbar from "./Navbar";
import PhotoTagEditor from "./PhotoTagEditor";
import { formatReportDate, type ShiftReportPhoto } from "./ShiftReportsTable";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Checkbox } from "./ui/checkbox";
import { Card } from "./ui/card";

const PAGE_SIZE = 48;

interface BrowsePhoto extends ShiftReportPhoto {
  shiftReport: { id: number; date: string; shiftType: string };
}

function PhotoTile({
  photo,
  canEditTags,
  canDownload,
  catOptions,
}: {
  photo: BrowsePhoto;
  canEditTags: boolean;
  canDownload: boolean;
  catOptions: CatOption[];
}) {
  const [editing, setEditing] = useState(false);
  const [downloadError, setDownloadError] = useState(false);

  return (
    <Card size="sm" className="gap-0 p-2 text-xs">
      <AuthenticatedImage
        photoId={photo.id}
        alt="Shift report photo"
        className="h-40 w-full rounded object-cover"
      />
      <div className="mt-1 space-y-0.5">
        <Link to={`/shift-reports/${photo.shiftReport.id}`} className="text-blue hover:underline">
          {formatReportDate(photo.shiftReport.date)} · {photo.shiftReport.shiftType}
        </Link>
        <p className="text-muted-foreground">by {photo.uploadedBy.name}</p>
        <div className="flex items-center justify-between gap-1">
          <span className="truncate">
            {photo.tags.length > 0 ? photo.tags.map((t) => t.cat.name).join(", ") : "Unassigned"}
          </span>
          <span className="flex shrink-0 gap-2">
            {canEditTags && (
              <button
                type="button"
                className="text-blue"
                onClick={() => setEditing((v) => !v)}
                aria-label="Edit tags"
              >
                <Pencil className="h-3 w-3" />
              </button>
            )}
            {canDownload && (
              <button
                type="button"
                className="text-blue"
                onClick={() =>
                  downloadFromApi(
                    `/api/photos/${photo.id}/download`,
                    `photo-${photo.id}.jpg`,
                  ).catch(() => setDownloadError(true))
                }
                aria-label="Download original"
              >
                <Download className="h-3 w-3" />
              </button>
            )}
          </span>
        </div>
        {downloadError && <p className="text-destructive">Download failed</p>}
      </div>
      {editing && (
        <PhotoTagEditor
          photoId={photo.id}
          initialCatIds={photo.tags.map((t) => t.catId)}
          catOptions={catOptions}
          onSaved={() => setEditing(false)}
        />
      )}
    </Card>
  );
}

export default function PhotosPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;

  const [catId, setCatId] = useState("");
  const [unassigned, setUnassigned] = useState(false);
  const [limit, setLimit] = useState(PAGE_SIZE);
  const [zipError, setZipError] = useState(false);

  const { data: cats } = useCatOptions();

  const filterParams = unassigned ? { unassigned: true } : catId ? { catId: Number(catId) } : {};

  const {
    data: photos,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["photos", filterParams, limit],
    queryFn: async () => {
      const { data } = await api.get<{ photos: BrowsePhoto[] }>("/api/photos", {
        params: { ...filterParams, limit },
      });
      return data.photos;
    },
  });

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-8">
        <h1 className="mb-6 text-2xl font-semibold tracking-tight">Photos</h1>

        <div className="mb-6 flex flex-wrap items-end gap-3">
          <div className="space-y-1">
            <Label htmlFor="photoCat">Cat</Label>
            <NativeSelect
              id="photoCat"
              className="w-fit"
              value={catId}
              disabled={unassigned}
              onChange={(e) => {
                setCatId(e.target.value);
                setLimit(PAGE_SIZE);
              }}
            >
              <NativeSelectOption value="">All cats</NativeSelectOption>
              {cats?.map((cat) => (
                <NativeSelectOption key={cat.id} value={cat.id}>
                  {catOptionLabel(cat)}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <label className="flex h-10 items-center gap-2 text-sm">
            <Checkbox
              checked={unassigned}
              onCheckedChange={(checked) => {
                setUnassigned(checked === true);
                setLimit(PAGE_SIZE);
              }}
            />
            Unassigned only
          </label>
          {isAdmin && (
            <Button
              variant="secondary"
              disabled={!photos || photos.length === 0}
              onClick={() => {
                setZipError(false);
                downloadFromApi(
                  "/api/photos/download-zip" +
                    (unassigned ? "?unassigned=true" : catId ? `?catId=${catId}` : ""),
                  "photos.zip",
                ).catch(() => setZipError(true));
              }}
            >
              <Download className="mr-1 h-4 w-4" />
              Download all (zip)
            </Button>
          )}
        </div>
        {zipError && <ErrorAlert message="Couldn't download the zip" />}

        {error ? (
          <ErrorAlert message="Failed to fetch photos" />
        ) : isLoading ? (
          <Skeleton className="h-48 w-full" />
        ) : photos && photos.length > 0 ? (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((photo) => (
                <PhotoTile
                  key={photo.id}
                  photo={photo}
                  canDownload={isAdmin}
                  canEditTags={isAdmin || photo.uploadedBy.id === session?.user.id}
                  catOptions={cats ?? []}
                />
              ))}
            </div>
            {photos.length >= limit && (
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE_SIZE)}>
                  Load more
                </Button>
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No photos match.</p>
        )}
      </main>
    </>
  );
}
