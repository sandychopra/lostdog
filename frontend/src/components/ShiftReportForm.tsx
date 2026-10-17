import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createShiftReportSchema,
  updateShiftReportSchema,
  draftShiftReportSchema,
  type CreateShiftReportInput,
  type DraftShiftReportInput,
} from "shared/schemas/shiftReports.ts";
import { ShiftType } from "shared/constants/shiftType.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { SplitShiftPosition } from "shared/constants/splitShiftPosition.ts";
import { ShiftReportStatus } from "shared/constants/shiftReportStatus.ts";
import { api } from "../lib/api";
import { shiftReportResolver } from "../lib/shiftReportForm";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import CatEntryFields from "./CatEntryFields";
import GroupCatEntryFields from "./GroupCatEntryFields";
import CatNoteGroupList, { type CatNoteGroupListHandle } from "./CatNoteGroupList";
import KennelStatusList from "./KennelStatusList";
import PhotoUploadSection, {
  type QueuedPhoto,
  type UploadedPhotoSummary,
} from "./PhotoUploadSection";
import CollapsibleSection from "./CollapsibleSection";
import ShiftReportFormOutline, { type SectionKey } from "./ShiftReportFormOutline";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";
import type { ShiftReport } from "./ShiftReportsTable";

// Autosave cadence: save shortly after the volunteer stops typing, with a
// slower interval as a safety net during long continuous editing. Switching
// apps/tabs (visibilitychange) saves immediately — see the effect below.
const AUTOSAVE_IDLE_MS = 10_000;
const AUTOSAVE_MAX_INTERVAL_MS = 60_000;

function toDateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function mapReportToDefaultValues(report: ShiftReport): DraftShiftReportInput {
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
            peePoopNotes: entry.peePoopNotes ?? "",
            dryFoodAmount: entry.dryFoodAmount ?? undefined,
            wetFoodAmount: entry.wetFoodAmount ?? undefined,
            foodNotes: entry.foodNotes ?? "",
            medicalNotes: entry.medicalNotes ?? "",
          }
        : {
            id: entry.id,
            entryType: CatEntryType.Group,
            groupId: entry.groupId!,
            fecalScore: entry.fecalScore ?? undefined,
            pee: entry.pee,
            peePoopNotes: entry.peePoopNotes ?? "",
            dryFoodAmount: entry.dryFoodAmount ?? undefined,
            foodNotes: entry.foodNotes ?? "",
            catDetails: entry.groupDetails.map((detail) => ({
              catId: detail.catId,
              wetFoodAmount: detail.wetFoodAmount ?? undefined,
              foodNotes: detail.foodNotes ?? "",
              medicalNotes: detail.medicalNotes ?? "",
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

async function uploadPhoto(args: { file: File; shiftReportId: number; catIds: number[] }) {
  const formData = new FormData();
  formData.append("photo", args.file);
  formData.append("shiftReportId", String(args.shiftReportId));
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
  const [photoQueue, setPhotoQueue] = useState<QueuedPhoto[]>([]);
  // Photos already uploaded to this report. Seeded from the prop, then grown
  // as queued photos finish uploading, since `report` doesn't re-fetch.
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhotoSummary[]>(
    report?.photos ?? [],
  );

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

  const form = useForm<DraftShiftReportInput, unknown, DraftShiftReportInput>({
    // Always lenient — this only governs live inline field errors as the
    // volunteer types. The hard Draft/Submit distinction is enforced
    // explicitly in handleSubmitClick, not via the bound resolver, so saving
    // a draft never blocks on an incomplete group entry/meet-and-greet/play
    // group.
    resolver: shiftReportResolver,
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
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "error">("idle");
  // Unsaved changes exist. A ref (not RHF's isDirty) so edits made while a
  // save is in flight aren't wiped by a post-save reset.
  const dirtyRef = useRef(false);
  const autosavingRef = useRef(false);
  const autosaveRef = useRef<() => Promise<void>>(async () => {});

  const catEntries = useFieldArray({ control, name: "catEntries" });

  // Keyed by useFieldArray's stable field.id (not array index, which shifts on
  // add/remove). Entries default collapsed when editing an existing report, so
  // a volunteer sees an overview first; a brand-new report starts empty, and a
  // freshly-added entry is never added to this set, so both open expanded.
  const [collapsedEntryIds, setCollapsedEntryIds] = useState<Set<string>>(() =>
    report ? new Set(catEntries.fields.map((f) => f.id)) : new Set(),
  );

  function toggleEntryCollapsed(id: string) {
    setCollapsedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    // Collapsing an entry is a natural "done with this cat" moment.
    void autosaveRef.current();
  }

  // Computed once at mount, same as collapsedEntryIds above: editing an
  // existing report starts every section collapsed, so a volunteer sees an
  // overview first; a brand-new report starts each section expanded as it's
  // filled in, since there's nothing to collapse yet.
  const [collapsedSections, setCollapsedSections] = useState<Record<SectionKey, boolean>>(() => ({
    // Kennel Status is never meaningfully "empty" (every kennel is always
    // auto-populated), so it always starts collapsed regardless of report.
    kennelStatus: true,
    catEntries: !!report,
    playGroups: !!report,
    meetAndGreets: !!report,
    photos: !!report,
    notes: !!report,
  }));

  function toggleSection(key: SectionKey) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const playGroupsRef = useRef<CatNoteGroupListHandle>(null);
  const meetAndGreetsRef = useRef<CatNoteGroupListHandle>(null);

  function collapseAllSections() {
    setCollapsedSections({
      kennelStatus: true,
      catEntries: true,
      playGroups: true,
      meetAndGreets: true,
      photos: true,
      notes: true,
    });
    setCollapsedEntryIds(new Set(catEntries.fields.map((f) => f.id)));
    playGroupsRef.current?.collapseAll();
    meetAndGreetsRef.current?.collapseAll();
  }

  function expandAllSections() {
    setCollapsedSections({
      kennelStatus: false,
      catEntries: false,
      playGroups: false,
      meetAndGreets: false,
      photos: false,
      notes: false,
    });
    setCollapsedEntryIds(new Set());
    playGroupsRef.current?.expandAll();
    meetAndGreetsRef.current?.expandAll();
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

  async function sendReport(payload: CreateShiftReportInput & { status: ShiftReportStatus }) {
    const existingId = createdReport?.id ?? report?.id;
    const { data } = existingId
      ? await api.put(`/api/shift-reports/${existingId}`, payload)
      : await api.post("/api/shift-reports", payload);
    return data.shiftReport as ShiftReport;
  }

  const mutation = useMutation({ mutationFn: sendReport });

  // Uploads the queued photos, then drops the ones that succeeded from the
  // queue — otherwise every later save (autosave included) would upload them
  // again. Failed uploads stay queued to retry on the next save.
  async function syncQueuedPhotos(saved: ShiftReport) {
    const batch = photoQueue;
    if (batch.length === 0) return;
    const results = await Promise.allSettled(
      batch.map((photo) =>
        uploadPhoto({ file: photo.file, shiftReportId: saved.id, catIds: photo.catIds }),
      ),
    );
    const done = new Set<QueuedPhoto>();
    const added: UploadedPhotoSummary[] = [];
    results.forEach((result, i) => {
      if (result.status !== "fulfilled") return;
      done.add(batch[i]!);
      added.push(result.value.data.photo as UploadedPhotoSummary);
    });
    setPhotoQueue((prev) => prev.filter((photo) => !done.has(photo)));
    setUploadedPhotos((prev) => [...prev, ...added]);
  }

  function invalidateShiftReportQueries() {
    queryClient.invalidateQueries({ queryKey: ["shiftReports"] });
    queryClient.invalidateQueries({ queryKey: ["cats"] });
    queryClient.invalidateQueries({ queryKey: ["kennels"] });
  }

  async function handleSaveDraft(data: CreateShiftReportInput) {
    const wasNew = createdReport === undefined && report === undefined;
    dirtyRef.current = false;
    let saved: ShiftReport;
    try {
      saved = await mutation.mutateAsync({ ...data, status: ShiftReportStatus.Draft });
    } catch (error) {
      dirtyRef.current = true;
      throw error;
    }
    await syncQueuedPhotos(saved);
    setAutosaveStatus("idle");
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
    await syncQueuedPhotos(saved);
    invalidateShiftReportQueries();
    onSuccess(saved.id);
  }

  const isAlreadySubmitted =
    (createdReport?.status ?? report?.status) === ShiftReportStatus.Submitted;

  // Silent background draft save: no error banner (a failure just shows a
  // quiet status and retries on the next trigger), and no-op when there is
  // nothing new, another save is running, or the report is already submitted.
  async function autosave() {
    if (autosavingRef.current || mutation.isPending || isAlreadySubmitted) return;
    if (!dirtyRef.current) return;
    const parsed = draftShiftReportSchema.safeParse(form.getValues());
    if (!parsed.success) return;
    autosavingRef.current = true;
    setAutosaveStatus("saving");
    dirtyRef.current = false;
    try {
      const wasNew = createdReport === undefined && report === undefined;
      const saved = await sendReport({ ...parsed.data, status: ShiftReportStatus.Draft });
      await syncQueuedPhotos(saved);
      setCreatedReport(saved);
      setLastSavedAt(new Date());
      setAutosaveStatus("idle");
      invalidateShiftReportQueries();
      if (wasNew) {
        queryClient.setQueryData(["shiftReports", String(saved.id)], saved);
        onDraftCreated?.(saved.id);
      }
    } catch {
      dirtyRef.current = true;
      setAutosaveStatus("error");
    } finally {
      autosavingRef.current = false;
    }
  }

  useEffect(() => {
    autosaveRef.current = autosave;
  });

  useEffect(() => {
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = form.subscribe({
      formState: { values: true },
      callback: () => {
        dirtyRef.current = true;
        clearTimeout(idleTimer);
        idleTimer = setTimeout(() => void autosaveRef.current(), AUTOSAVE_IDLE_MS);
      },
    });
    const interval = setInterval(() => void autosaveRef.current(), AUTOSAVE_MAX_INTERVAL_MS);
    // Switching apps/tabs is when a mobile browser may discard the page, so
    // save right away rather than waiting for the idle timer.
    const flush = () => {
      if (document.visibilityState === "hidden") void autosaveRef.current();
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => {
      unsubscribe();
      clearTimeout(idleTimer);
      clearInterval(interval);
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", flush);
    };
  }, [form]);

  // Newly queued photos count as unsaved work too.
  useEffect(() => {
    if (photoQueue.length === 0) return;
    dirtyRef.current = true;
    const timer = setTimeout(() => void autosaveRef.current(), AUTOSAVE_IDLE_MS);
    return () => clearTimeout(timer);
  }, [photoQueue]);

  // Only warn on leaving if the last autosave failed, i.e. work is at risk.
  useEffect(() => {
    if (autosaveStatus !== "error") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [autosaveStatus]);

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
    if (autosavingRef.current) return;
    form.handleSubmit((data) => handleSaveDraft(data))();
  }

  function addIndividualEntry(catId: number) {
    catEntries.append({
      entryType: CatEntryType.Individual,
      catId,
      pee: false,
      peePoopNotes: "",
      foodNotes: "",
      medicalNotes: "",
    });
  }

  function addGroupEntry(groupId: number) {
    const group = (kennels ?? []).flatMap((k) => k.groups).find((g) => g.id === groupId);
    catEntries.append({
      entryType: CatEntryType.Group,
      groupId,
      pee: false,
      peePoopNotes: "",
      foodNotes: "",
      catDetails: (group?.cats ?? []).map((c) => ({
        catId: c.id,
        foodNotes: "",
        medicalNotes: "",
      })),
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
    if (collapsedSections.catEntries) toggleSection("catEntries");
  }

  return (
    <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" size="sm" onClick={expandAllSections}>
          Expand all
        </Button>
        <Button type="button" variant="secondary" size="sm" onClick={collapseAllSections}>
          Collapse all
        </Button>
      </div>
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
            label: "Food & Medical",
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
            count: uploadedPhotos.length + photoQueue.length,
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
          <NativeSelect id="shiftType" {...register("shiftType")}>
            <NativeSelectOption value={ShiftType.Morning}>Morning</NativeSelectOption>
            <NativeSelectOption value={ShiftType.MidDay}>Mid-day</NativeSelectOption>
            <NativeSelectOption value={ShiftType.Evening}>Evening</NativeSelectOption>
          </NativeSelect>
        </div>
        <div className="space-y-2">
          <Label htmlFor="date">Date</Label>
          <Input id="date" type="date" {...register("date")} />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Controller
          control={control}
          name="isSplitShift"
          render={({ field }) => (
            <Checkbox
              id="isSplitShift"
              ref={field.ref}
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              onBlur={field.onBlur}
              disabled={shiftType === ShiftType.MidDay}
            />
          )}
        />
        <Label htmlFor="isSplitShift">Split shift (Morning/Evening only)</Label>
      </div>

      {isSplitShift && (
        <div className="space-y-2">
          <Label htmlFor="splitShiftPosition">Which half of the shift?</Label>
          <NativeSelect id="splitShiftPosition" {...register("splitShiftPosition")}>
            <NativeSelectOption value="">Select</NativeSelectOption>
            <NativeSelectOption value={SplitShiftPosition.First}>First shift</NativeSelectOption>
            <NativeSelectOption value={SplitShiftPosition.Second}>Second shift</NativeSelectOption>
          </NativeSelect>
          <ErrorMessage message={formState.errors.splitShiftPosition?.message} />
        </div>
      )}

      <KennelStatusList
        form={form}
        kennelOptions={kennels ?? []}
        collapsed={collapsedSections.kennelStatus}
        onToggleCollapsed={() => toggleSection("kennelStatus")}
      />

      <CollapsibleSection
        title="Food & Medical"
        count={catEntries.fields.length}
        collapsed={collapsedSections.catEntries}
        onToggleCollapsed={() => toggleSection("catEntries")}
        anchorId="section-cat-entries"
        headerExtra={
          <div className="flex gap-2">
            {catEntries.fields.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCollapsedEntryIds(new Set())}
                >
                  Expand all
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setCollapsedEntryIds(new Set(catEntries.fields.map((f) => f.id)))}
                >
                  Collapse all
                </Button>
              </>
            )}
            <NativeSelect
              aria-label="Add a cat"
              size="sm"
              className="w-56"
              value={pickerValue}
              onChange={(e) => handlePickerChange(e.target.value)}
            >
              <NativeSelectOption value="">Add a cat…</NativeSelectOption>
              {pickerOptions.map((option) => (
                <NativeSelectOption key={option.value} value={option.value}>
                  {option.label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        }
      >
        {catEntries.fields.map((field, index) => {
          const entryType = form.getValues(`catEntries.${index}.entryType`);
          const collapsed = collapsedEntryIds.has(field.id);
          const onToggleCollapsed = () => toggleEntryCollapsed(field.id);
          return entryType === CatEntryType.Individual ? (
            <CatEntryFields
              key={field.id}
              form={form}
              index={index}
              cats={cats ?? []}
              onRemove={() => catEntries.remove(index)}
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
              collapsed={collapsed}
              onToggleCollapsed={onToggleCollapsed}
            />
          );
        })}
      </CollapsibleSection>

      <CatNoteGroupList
        ref={playGroupsRef}
        form={form}
        name="playGroups"
        title="Play Groups"
        addLabel="Add Play Group"
        catOptions={catOptions}
        collapsed={collapsedSections.playGroups}
        onToggleCollapsed={() => toggleSection("playGroups")}
        isEdit={isEdit}
      />

      <CatNoteGroupList
        ref={meetAndGreetsRef}
        form={form}
        name="meetAndGreets"
        title="Meet & Greets"
        addLabel="Add Meet & Greet"
        catOptions={catOptions}
        collapsed={collapsedSections.meetAndGreets}
        onToggleCollapsed={() => toggleSection("meetAndGreets")}
        isEdit={isEdit}
      />

      <CollapsibleSection
        title="Photos"
        count={uploadedPhotos.length + photoQueue.length}
        collapsed={collapsedSections.photos}
        onToggleCollapsed={() => toggleSection("photos")}
        anchorId="section-photos"
      >
        <PhotoUploadSection
          queued={photoQueue}
          onQueuedChange={setPhotoQueue}
          uploaded={uploadedPhotos}
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
          <Textarea id="cleaningNotes" className="min-h-16" {...register("cleaningNotes")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="suppliesNotes">Supplies Notes</Label>
          <Textarea id="suppliesNotes" className="min-h-16" {...register("suppliesNotes")} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="otherNotes">Other Notes</Label>
          <Textarea id="otherNotes" className="min-h-16" {...register("otherNotes")} />
        </div>
      </CollapsibleSection>

      {submitAttemptError && <ErrorAlert message={submitAttemptError} />}
      {mutation.error !== null && (
        <ErrorAlert error={mutation.error} fallback="Failed to save shift report" />
      )}

      <div className="flex items-center justify-end gap-3">
        {autosaveStatus === "saving" ? (
          <span className="text-sm text-muted-foreground">Autosaving...</span>
        ) : autosaveStatus === "error" ? (
          <span className="text-sm text-destructive">Autosave failed — will retry</span>
        ) : (
          lastSavedAt && (
            <span className="text-sm text-muted-foreground">
              Saved as draft · {lastSavedAt.toLocaleTimeString()}
            </span>
          )
        )}
        {!isAlreadySubmitted && (
          <Button
            type="button"
            variant="secondary"
            disabled={mutation.isPending || autosaveStatus === "saving"}
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
