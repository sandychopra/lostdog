import { useState } from "react";
import { useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createShiftReportSchema,
  updateShiftReportSchema,
  draftShiftReportSchema,
  type CreateShiftReportInput,
} from "shared/schemas/shiftReports.ts";
import { ShiftType } from "shared/constants/shiftType.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { SplitShiftPosition } from "shared/constants/splitShiftPosition.ts";
import { ShiftReportStatus } from "shared/constants/shiftReportStatus.ts";
import { api } from "../lib/api";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import CatEntryFields from "./CatEntryFields";
import GroupCatEntryFields from "./GroupCatEntryFields";
import CatNoteGroupList from "./CatNoteGroupList";
import KennelStatusList from "./KennelStatusList";
import PhotoUploadSection, { type QueuedPhoto } from "./PhotoUploadSection";
import CollapsibleSection from "./CollapsibleSection";
import ShiftReportFormOutline, { type SectionKey } from "./ShiftReportFormOutline";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";
import type { ShiftReport } from "./ShiftReportsTable";

const selectClassName =
  "flex h-10 w-full rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";
const textareaClassName =
  "flex min-h-16 w-full rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

function toDateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function queueKeyForEntry(fieldId: string, entryId: number | undefined): string {
  return entryId !== undefined ? `existing-${entryId}` : `new-${fieldId}`;
}

function mapReportToDefaultValues(report: ShiftReport): CreateShiftReportInput {
  return {
    shiftType: report.shiftType,
    date: toDateInputValue(report.date) as unknown as Date,
    isSplitShift: report.isSplitShift,
    splitShiftPosition: report.splitShiftPosition ?? undefined,
    cleaningNotes: report.cleaningNotes ?? "",
    suppliesNotes: report.suppliesNotes ?? "",
    kennelNotes: report.kennelNotes ?? "",
    otherNotes: report.otherNotes ?? "",
    catEntries: report.catEntries.map((entry) =>
      entry.entryType === CatEntryType.Individual
        ? {
            id: entry.id,
            entryType: CatEntryType.Individual,
            catId: entry.catId!,
            fecalScore: entry.fecalScore ?? undefined,
            pee: entry.pee,
            peePooNotes: entry.peePooNotes ?? "",
            dryFoodAmount: entry.dryFoodAmount ?? undefined,
            wetFoodAmount: entry.wetFoodAmount ?? undefined,
            wetFoodBrand: entry.wetFoodBrand ?? "",
            foodNotes: entry.foodNotes ?? "",
            snackTreat: entry.snackTreat ?? undefined,
            medicalNotes: entry.medicalNotes ?? "",
            otherNotes: entry.otherNotes ?? "",
          }
        : {
            id: entry.id,
            entryType: CatEntryType.Group,
            groupId: entry.groupId!,
            fecalScore: entry.fecalScore ?? undefined,
            pee: entry.pee,
            peePooNotes: entry.peePooNotes ?? "",
            dryFoodAmount: entry.dryFoodAmount ?? undefined,
            foodNotes: entry.foodNotes ?? "",
            otherNotes: entry.otherNotes ?? "",
            catDetails: entry.groupDetails.map((detail) => ({
              catId: detail.catId,
              wetFoodAmount: detail.wetFoodAmount ?? undefined,
              wetFoodBrand: detail.wetFoodBrand ?? "",
              snackTreat: detail.snackTreat ?? undefined,
              foodNotes: detail.foodNotes ?? "",
              medicalNotes: detail.medicalNotes ?? "",
              otherNotes: detail.otherNotes ?? "",
            })),
          },
    ),
    meetAndGreets: report.meetAndGreets.map((meetAndGreet) => ({
      id: meetAndGreet.id,
      note: meetAndGreet.note,
      catIds: meetAndGreet.cats.map((c) => c.catId),
    })),
    playGroups: report.playGroups.map((playGroup) => ({
      id: playGroup.id,
      note: playGroup.note,
      catIds: playGroup.cats.map((c) => c.catId),
    })),
    kennelsStatus: report.kennelsStatus.map((k) => ({
      kennelId: k.kennelId,
      reportedState: k.reportedState,
    })),
  };
}

async function uploadPhoto(args: {
  file: File;
  shiftReportId: number;
  catEntryId?: number;
  catIds: number[];
}) {
  const formData = new FormData();
  formData.append("photo", args.file);
  formData.append("shiftReportId", String(args.shiftReportId));
  if (args.catEntryId !== undefined) formData.append("catEntryId", String(args.catEntryId));
  if (args.catIds.length > 0) formData.append("catIds", JSON.stringify(args.catIds));
  return api.post("/api/photos", formData);
}

interface ShiftReportFormProps {
  report?: ShiftReport;
  onSuccess: (id: number) => void;
  onDraftCreated?: (id: number) => void;
}

export default function ShiftReportForm({
  report,
  onSuccess,
  onDraftCreated,
}: ShiftReportFormProps) {
  const isEdit = !!report;
  const queryClient = useQueryClient();
  const [photoQueue, setPhotoQueue] = useState<Record<string, QueuedPhoto[]>>({});

  const { data: cats } = useQuery({
    queryKey: ["cats"],
    queryFn: async () => {
      const { data } = await api.get<{ cats: Cat[] }>("/api/cats");
      return data.cats;
    },
  });

  const { data: kennels } = useQuery({
    queryKey: ["kennels"],
    queryFn: async () => {
      const { data } = await api.get<{ kennels: Kennel[] }>("/api/kennels");
      return data.kennels;
    },
  });

  const form = useForm<CreateShiftReportInput>({
    // Always lenient — this only governs live inline field errors as the
    // volunteer types. The hard Draft/Submit distinction is enforced
    // explicitly in handleSubmitClick, not via the bound resolver, so saving
    // a draft never blocks on an incomplete group entry/meet-and-greet/play
    // group.
    resolver: zodResolver(draftShiftReportSchema),
    defaultValues: report
      ? mapReportToDefaultValues(report)
      : {
          shiftType: ShiftType.Morning,
          date: toDateInputValue(new Date().toISOString()) as unknown as Date,
          isSplitShift: false,
          catEntries: [],
          meetAndGreets: [],
          playGroups: [],
          kennelsStatus: [],
        },
  });

  const { control, register, formState } = form;

  // Tracks the authoritative saved report once one exists, independent of
  // the `report` prop (which won't update after the parent's background
  // re-fetch without a full remount — see handleSaveDraft/onDraftCreated).
  const [createdReport, setCreatedReport] = useState<ShiftReport | undefined>(report);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [submitAttemptError, setSubmitAttemptError] = useState<string | null>(null);

  const catEntries = useFieldArray({ control, name: "catEntries" });

  // Keyed by useFieldArray's stable field.id (not array index, which shifts on
  // add/remove). Entries default collapsed when editing a report with enough
  // of them that the form becomes scroll-heavy; a brand-new report starts
  // empty, and a freshly-added entry is never added to this set, so both open
  // expanded.
  const [collapsedEntryIds, setCollapsedEntryIds] = useState<Set<string>>(() =>
    report && catEntries.fields.length > 3
      ? new Set(catEntries.fields.map((f) => f.id))
      : new Set(),
  );

  function toggleEntryCollapsed(id: string) {
    setCollapsedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Computed once at mount, same as collapsedEntryIds above, so a section
  // doesn't snap shut again if the volunteer empties it back out after
  // expanding it.
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionKey, boolean>>(() => ({
    // Unlike the sections below, Kennel Status is never meaningfully "empty"
    // (every kennel is always auto-populated), so it always starts collapsed
    // rather than only when its count is zero.
    kennelStatus: true,
    playGroups: (report?.playGroups.length ?? 0) === 0,
    meetAndGreets: (report?.meetAndGreets.length ?? 0) === 0,
    photos: (report?.photos.length ?? 0) === 0,
    notes: !(report?.cleaningNotes || report?.suppliesNotes || report?.otherNotes),
  }));

  function toggleSection(key: SectionKey) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const shiftType = useWatch({ control, name: "shiftType" });
  const isSplitShift = useWatch({ control, name: "isSplitShift" });
  const cleaningNotes = useWatch({ control, name: "cleaningNotes" });
  const suppliesNotes = useWatch({ control, name: "suppliesNotes" });
  const otherNotes = useWatch({ control, name: "otherNotes" });
  const notesCount = [cleaningNotes, suppliesNotes, otherNotes].filter(
    (note) => note && note.length > 0,
  ).length;

  const catOptions = (cats ?? []).map((c) => ({ id: c.id, name: c.name }));

  const uploadedByEntryId = new Map((report?.catEntries ?? []).map((e) => [e.id, e.photos]));

  const mutation = useMutation({
    mutationFn: async (payload: CreateShiftReportInput & { status: ShiftReportStatus }) => {
      const existingId = createdReport?.id ?? report?.id;
      const { data } = existingId
        ? await api.put(`/api/shift-reports/${existingId}`, payload)
        : await api.post("/api/shift-reports", payload);
      return data.shiftReport as ShiftReport;
    },
  });

  async function syncQueuedPhotos(data: CreateShiftReportInput, saved: ShiftReport) {
    const knownIds = new Set(
      data.catEntries.map((entry) => entry.id).filter((id): id is number => id !== undefined),
    );
    const submittedNewEntries = catEntries.fields
      .map((field, i) => ({ field, entry: data.catEntries[i]! }))
      .filter(({ entry }) => entry.id === undefined);
    const responseNewEntries = saved.catEntries.filter((entry) => !knownIds.has(entry.id));

    const resolvedIdByQueueKey = new Map<string, number>();
    submittedNewEntries.forEach(({ field }, i) => {
      const real = responseNewEntries[i];
      if (real) resolvedIdByQueueKey.set(`new-${field.id}`, real.id);
    });

    const uploads: Promise<unknown>[] = [];
    for (const photo of photoQueue.report ?? []) {
      uploads.push(
        uploadPhoto({ file: photo.file, shiftReportId: saved.id, catIds: photo.catIds }),
      );
    }
    for (const [key, photos] of Object.entries(photoQueue)) {
      if (key === "report" || photos.length === 0) continue;
      const catEntryId = key.startsWith("existing-")
        ? Number(key.replace("existing-", ""))
        : resolvedIdByQueueKey.get(key);
      if (catEntryId === undefined) continue;
      for (const photo of photos) {
        uploads.push(
          uploadPhoto({
            file: photo.file,
            shiftReportId: saved.id,
            catEntryId,
            catIds: photo.catIds,
          }),
        );
      }
    }
    await Promise.allSettled(uploads);
  }

  function invalidateShiftReportQueries() {
    queryClient.invalidateQueries({ queryKey: ["shiftReports"] });
    queryClient.invalidateQueries({ queryKey: ["cats"] });
    queryClient.invalidateQueries({ queryKey: ["kennels"] });
  }

  async function handleSaveDraft(data: CreateShiftReportInput) {
    const wasNew = createdReport === undefined && report === undefined;
    const saved = await mutation.mutateAsync({ ...data, status: ShiftReportStatus.Draft });
    await syncQueuedPhotos(data, saved);
    setCreatedReport(saved);
    setLastSavedAt(new Date());
    setSubmitAttemptError(null);
    invalidateShiftReportQueries();
    if (wasNew) {
      // Seed the cache for the edit-page query the URL swap below is about
      // to trigger, so it resolves from cache instead of showing a loading
      // skeleton for a report the volunteer is already looking at.
      queryClient.setQueryData(["shiftReports", String(saved.id)], saved);
      onDraftCreated?.(saved.id);
    }
  }

  async function handleSubmitReport(data: CreateShiftReportInput) {
    const saved = await mutation.mutateAsync({ ...data, status: ShiftReportStatus.Submitted });
    await syncQueuedPhotos(data, saved);
    invalidateShiftReportQueries();
    onSuccess(saved.id);
  }

  const isAlreadySubmitted =
    (createdReport?.status ?? report?.status) === ShiftReportStatus.Submitted;

  function handleSubmitClick() {
    form.handleSubmit((data) => {
      const strictSchema = isEdit ? updateShiftReportSchema : createShiftReportSchema;
      const result = strictSchema.safeParse(data);
      if (!result.success) {
        for (const issue of result.error.issues) {
          // Zod issue paths are dynamic (e.g. "catEntries.0.catDetails"), which
          // doesn't line up with RHF's statically-typed FieldPath<T> — cast
          // needed here since the path is only known at runtime.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          form.setError(issue.path.join(".") as any, { message: issue.message });
        }
        setSubmitAttemptError("Please complete the highlighted fields before submitting.");
        return;
      }
      setSubmitAttemptError(null);
      void handleSubmitReport(result.data);
    })();
  }

  function handleSaveDraftClick() {
    form.handleSubmit((data) => handleSaveDraft(data))();
  }

  function addIndividualEntry(catId: number) {
    catEntries.append({
      entryType: CatEntryType.Individual,
      catId,
      pee: false,
    });
  }

  function addGroupEntry(groupId: number) {
    const group = (kennels ?? []).flatMap((k) => k.groups).find((g) => g.id === groupId);
    catEntries.append({
      entryType: CatEntryType.Group,
      groupId,
      pee: false,
      catDetails: (group?.cats ?? []).map((c) => ({ catId: c.id })),
    });
  }

  // A single picker replaces separate "Add Individual/Group Entry" buttons —
  // which kind of entry a cat needs is roster trivia (is it currently housed
  // solo or with others), not something a volunteer should have to already
  // know. Picking a cat/group here decides the entry shape automatically.
  // Not a registered form field — just a transient "pick something to add"
  // trigger, reset after each use.
  const [pickerValue, setPickerValue] = useState("");

  const catEntryValues = useWatch({ control, name: "catEntries" }) ?? [];
  const playGroupValues = useWatch({ control, name: "playGroups" }) ?? [];
  const meetAndGreetValues = useWatch({ control, name: "meetAndGreets" }) ?? [];
  const kennelsStatusValues = useWatch({ control, name: "kennelsStatus" }) ?? [];
  const usedCatIds = new Set(
    catEntryValues
      .filter((e) => e.entryType === CatEntryType.Individual)
      .map((e) => e.catId)
      .filter((id): id is number => id !== undefined),
  );
  const usedGroupIds = new Set(
    catEntryValues
      .filter((e) => e.entryType === CatEntryType.Group)
      .map((e) => e.groupId)
      .filter((id): id is number => id !== undefined),
  );
  const pickerOptions = [
    ...(cats ?? [])
      .filter((c) => c.groupId === null && !usedCatIds.has(c.id))
      .map((c) => ({ value: `cat:${c.id}`, label: c.name })),
    ...(kennels ?? [])
      .flatMap((k) => k.groups)
      .filter((g) => g.cats.length > 0 && !usedGroupIds.has(g.id))
      .map((g) => ({ value: `group:${g.id}`, label: g.cats.map((c) => c.name).join(" / ") })),
  ].sort((a, b) => a.label.localeCompare(b.label));

  function handlePickerChange(value: string) {
    if (!value) return;
    const [kind, idStr] = value.split(":");
    const id = Number(idStr);
    if (kind === "cat") addIndividualEntry(id);
    else addGroupEntry(id);
    setPickerValue("");
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <ShiftReportFormOutline
        items={[
          {
            key: "kennelStatus",
            label: "Kennel Status",
            count: kennelsStatusValues.length,
            anchorId: "section-kennel-status",
          },
          {
            key: "catEntries",
            label: "Cat Entries",
            count: catEntries.fields.length,
            anchorId: "section-cat-entries",
          },
          {
            key: "playGroups",
            label: "Play Groups",
            count: playGroupValues.length,
            anchorId: "section-playGroups",
          },
          {
            key: "meetAndGreets",
            label: "Meet & Greets",
            count: meetAndGreetValues.length,
            anchorId: "section-meetAndGreets",
          },
          {
            key: "photos",
            label: "Photos",
            count: (report?.photos.length ?? 0) + (photoQueue.report?.length ?? 0),
            anchorId: "section-photos",
          },
          {
            key: "notes",
            label: "Overall Notes",
            count: notesCount,
            anchorId: "section-notes",
          },
        ]}
        onBeforeNavigate={(key) => setCollapsedSections((prev) => ({ ...prev, [key]: false }))}
      />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="shiftType">Shift Type</Label>
          <select id="shiftType" className={selectClassName} {...register("shiftType")}>
            <option value={ShiftType.Morning}>Morning</option>
            <option value={ShiftType.MidDay}>Mid-day</option>
            <option value={ShiftType.Evening}>Evening</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register("date")} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="isSplitShift"
          type="checkbox"
          className="h-4 w-4"
          disabled={shiftType === ShiftType.MidDay}
          {...register("isSplitShift")}
        />
        <Label htmlFor="isSplitShift">Split shift (Morning/Evening only)</Label>
      </div>

      {isSplitShift && (
        <div className="space-y-2">
          <Label htmlFor="splitShiftPosition">Which half of the shift?</Label>
          <select
            id="splitShiftPosition"
            className={selectClassName}
            {...register("splitShiftPosition")}
          >
            <option value="">Select</option>
            <option value={SplitShiftPosition.First}>First shift</option>
            <option value={SplitShiftPosition.Second}>Second shift</option>
          </select>
          <ErrorMessage message={formState.errors.splitShiftPosition?.message} />
        </div>
      )}

      <KennelStatusList
        form={form}
        kennelOptions={kennels ?? []}
        collapsed={collapsedSections.kennelStatus}
        onToggleCollapsed={() => toggleSection("kennelStatus")}
      />

      <section id="section-cat-entries" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Cat Entries</h2>
          <div className="flex gap-2">
            {catEntries.fields.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCollapsedEntryIds(new Set())}
                >
                  Expand all
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setCollapsedEntryIds(new Set(catEntries.fields.map((f) => f.id)))}
                >
                  Collapse all
                </Button>
              </>
            )}
            <select
              aria-label="Add a cat entry"
              className="flex h-9 w-56 rounded-md border border-input bg-white px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={pickerValue}
              onChange={(e) => handlePickerChange(e.target.value)}
            >
              <option value="">Add a cat entry…</option>
              {pickerOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {catEntries.fields.map((field, index) => {
          const entryType = form.getValues(`catEntries.${index}.entryType`);
          const entryId = form.getValues(`catEntries.${index}.id`);
          const key = queueKeyForEntry(field.id, entryId);
          const uploaded = entryId !== undefined ? (uploadedByEntryId.get(entryId) ?? []) : [];
          const collapsed = collapsedEntryIds.has(field.id);
          const onToggleCollapsed = () => toggleEntryCollapsed(field.id);
          return entryType === CatEntryType.Individual ? (
            <CatEntryFields
              key={field.id}
              form={form}
              index={index}
              cats={cats ?? []}
              onRemove={() => catEntries.remove(index)}
              queuedPhotos={photoQueue[key] ?? []}
              onQueuedPhotosChange={(next) => setPhotoQueue((prev) => ({ ...prev, [key]: next }))}
              uploadedPhotos={uploaded}
              collapsed={collapsed}
              onToggleCollapsed={onToggleCollapsed}
            />
          ) : (
            <GroupCatEntryFields
              key={field.id}
              form={form}
              index={index}
              cats={cats ?? []}
              kennels={kennels ?? []}
              onRemove={() => catEntries.remove(index)}
              queuedPhotos={photoQueue[key] ?? []}
              onQueuedPhotosChange={(next) => setPhotoQueue((prev) => ({ ...prev, [key]: next }))}
              uploadedPhotos={uploaded}
              collapsed={collapsed}
              onToggleCollapsed={onToggleCollapsed}
            />
          );
        })}
      </section>

      <CatNoteGroupList
        form={form}
        name="playGroups"
        title="Play Groups"
        addLabel="Add Play Group"
        catOptions={catOptions}
        collapsed={collapsedSections.playGroups}
        onToggleCollapsed={() => toggleSection("playGroups")}
      />

      <CatNoteGroupList
        form={form}
        name="meetAndGreets"
        title="Meet & Greets"
        addLabel="Add Meet & Greet"
        catOptions={catOptions}
        collapsed={collapsedSections.meetAndGreets}
        onToggleCollapsed={() => toggleSection("meetAndGreets")}
      />

      <CollapsibleSection
        title="Photos"
        count={(report?.photos.length ?? 0) + (photoQueue.report?.length ?? 0)}
        collapsed={collapsedSections.photos}
        onToggleCollapsed={() => toggleSection("photos")}
        anchorId="section-photos"
      >
        <PhotoUploadSection
          queued={photoQueue.report ?? []}
          onQueuedChange={(next) => setPhotoQueue((prev) => ({ ...prev, report: next }))}
          uploaded={report?.photos ?? []}
          catOptions={catOptions}
          showTagPicker
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Overall Notes"
        count={notesCount}
        collapsed={collapsedSections.notes}
        onToggleCollapsed={() => toggleSection("notes")}
        anchorId="section-notes"
      >
        <div className="space-y-2">
          <Label htmlFor="cleaningNotes">Cleaning Notes</Label>
          <textarea
            id="cleaningNotes"
            className={textareaClassName}
            {...register("cleaningNotes")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="suppliesNotes">Supplies Notes</Label>
          <textarea
            id="suppliesNotes"
            className={textareaClassName}
            {...register("suppliesNotes")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="otherNotes">Other Notes</Label>
          <textarea id="otherNotes" className={textareaClassName} {...register("otherNotes")} />
        </div>
      </CollapsibleSection>

      {submitAttemptError && <ErrorAlert message={submitAttemptError} />}
      {mutation.error !== null && (
        <ErrorAlert error={mutation.error} fallback="Failed to save shift report" />
      )}

      <div className="flex items-center justify-end gap-3">
        {lastSavedAt && (
          <span className="text-sm text-muted-foreground">
            Saved as draft · {lastSavedAt.toLocaleTimeString()}
          </span>
        )}
        {!isAlreadySubmitted && (
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending}
            onClick={handleSaveDraftClick}
          >
            {mutation.isPending ? "Saving..." : "Save Draft"}
          </Button>
        )}
        <Button type="button" disabled={mutation.isPending} onClick={handleSubmitClick}>
          {mutation.isPending ? "Saving..." : isAlreadySubmitted ? "Save Changes" : "Submit Report"}
        </Button>
      </div>
    </form>
  );
}
