import { useEffect, useRef, useState } from "react";
import { Controller, useFieldArray, useForm, useWatch, type FieldErrors } from "react-hook-form";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createShiftReportSchema,
  updateShiftReportSchema,
  draftShiftReportSchema,
  UNTOUCHED_ENTRY_MESSAGE,
  type CreateShiftReportInput,
  type DraftShiftReportInput,
} from "shared/schemas/shiftReports.ts";
import { ShiftType } from "shared/constants/shiftType.ts";
import { CatEntryType } from "shared/constants/catEntryType.ts";
import { CatStatus } from "shared/constants/catStatus.ts";
import { SplitShiftPosition } from "shared/constants/splitShiftPosition.ts";
import { ShiftReportStatus } from "shared/constants/shiftReportStatus.ts";
import { api } from "../lib/api";
import { prepareImageForUpload } from "../lib/prepareImage";
import { shiftReportResolver } from "../lib/shiftReportForm";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Textarea } from "./ui/textarea";
import { Checkbox } from "./ui/checkbox";
import ErrorAlert from "./ErrorAlert";
import ErrorMessage from "./ErrorMessage";
import CatEntryCard from "./CatEntryCard";
import CatNoteGroupList from "./CatNoteGroupList";
import MedicalNotesList from "./MedicalNotesList";
import KennelStatusList from "./KennelStatusList";
import PhotoUploadSection, {
  type QueuedPhoto,
  type UploadedPhotoSummary,
} from "./PhotoUploadSection";
import FormSection from "./FormSection";
import ShiftReportFormOutline from "./ShiftReportFormOutline";
import type { Cat } from "./CatsTable";
import type { Kennel } from "./KennelsTable";
import type { ShiftReport } from "./ShiftReportsTable";

// Autosave cadence: save shortly after the volunteer stops typing, with a
// slower interval as a safety net during long continuous editing. Switching
// apps/tabs (visibilitychange) saves immediately — see the effect below.
const AUTOSAVE_IDLE_MS = 10_000;
const AUTOSAVE_MAX_INTERVAL_MS = 60_000;

// Native <select> value for "no shift type picked yet" — there's deliberately
// no default, so a volunteer can't submit a report under the wrong shift.
const NO_SHIFT_TYPE = "";

// Cats the volunteers look after now: Available, Pending Adoption, or
// Adopted but not yet picked up. Picked Up cats are gone.
function isInCare(cat: Cat): boolean {
  return (
    cat.status === CatStatus.Available ||
    cat.status === CatStatus.PendingAdoption ||
    cat.status === CatStatus.Adopted
  );
}

function toDateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

function mapReportToDefaultValues(report: ShiftReport): DraftShiftReportInput {
  return {
    // "" selects the "Select shift…" placeholder; the schema maps it to undefined.
    shiftType: report.shiftType ?? (NO_SHIFT_TYPE as unknown as undefined),
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
            fecalScores: entry.fecalScores,
            fecalEmpty: entry.fecalEmpty,
            pee: entry.pee,
            peePoopNotes: entry.peePoopNotes ?? "",
            dryFoodAmount: entry.dryFoodAmount ?? undefined,
            wetFoodAmount: entry.wetFoodAmount ?? undefined,
            foodNotes: entry.foodNotes ?? "",
          }
        : {
            id: entry.id,
            entryType: CatEntryType.Group,
            groupId: entry.groupId!,
            fecalScores: entry.fecalScores,
            fecalEmpty: entry.fecalEmpty,
            pee: entry.pee,
            peePoopNotes: entry.peePoopNotes ?? "",
            dryFoodAmount: entry.dryFoodAmount ?? undefined,
            foodNotes: entry.foodNotes ?? "",
            catDetails: entry.groupDetails.map((detail) => ({
              catId: detail.catId,
              wetFoodAmount: detail.wetFoodAmount ?? undefined,
              foodNotes: detail.foodNotes ?? "",
            })),
          },
    ),
    meetAndGreets: report.meetAndGreets.map((meetAndGreet) => ({
      id: meetAndGreet.id,
      note: meetAndGreet.note ?? "",
      catIds: meetAndGreet.cats.map((c) => c.catId),
    })),
    playGroups: report.playGroups.map((playGroup) => ({
      id: playGroup.id,
      note: playGroup.note ?? "",
      catIds: playGroup.cats.map((c) => c.catId),
    })),
    medicalNotes: report.medicalNotes.map((m) => ({ id: m.id, catId: m.catId, note: m.note })),
    kennelsStatus: report.kennelsStatus.map((k) => ({
      kennelId: k.kennelId,
      reportedState: k.reportedState,
    })),
  };
}

async function uploadPhoto(args: {
  file: File;
  shiftReportId: number;
  catIds: number[];
  clientUploadId: string;
}) {
  const formData = new FormData();
  formData.append("clientUploadId", args.clientUploadId);
  formData.append("photo", await prepareImageForUpload(args.file));
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
          shiftType: NO_SHIFT_TYPE as unknown as undefined,
          date: toDateInputValue(new Date().toISOString()) as unknown as Date,
          isSplitShift: false,
          catEntries: [],
          meetAndGreets: [],
          playGroups: [],
          medicalNotes: [],
          kennelsStatus: [],
        },
  });

  const { control, register, formState } = form;

  // Tracks the authoritative saved report once one exists, independent of
  // the `report` prop (which won't update after the parent's background
  // re-fetch without a full remount — see handleSaveDraft/onDraftCreated).
  const [createdReport, setCreatedReport] = useState<ShiftReport | undefined>(report);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(() =>
    report ? new Date(report.updatedAt) : null,
  );
  const [submitAttemptError, setSubmitAttemptError] = useState<string | null>(null);
  const [autosaveStatus, setAutosaveStatus] = useState<"idle" | "saving" | "error">("idle");
  // Unsaved changes exist. A ref (not RHF's isDirty) so edits made while a
  // save is in flight aren't wiped by a post-save reset.
  const dirtyRef = useRef(false);
  // A new report fills itself in (cat cards, kennel statuses); that alone
  // isn't work worth saving, so a report opened and left untouched never
  // becomes a draft. This snapshot is the form as the volunteer first saw
  // it — autosave skips an unsaved report whose values still match it. It
  // only moves forward with a fill-in while nothing else has changed, so a
  // late fill-in can't swallow a real edit.
  const pristineValuesRef = useRef<string | null>(null);
  useEffect(() => {
    pristineValuesRef.current = JSON.stringify(form.getValues());
  }, [form]);
  function withoutMarkingDirty(fill: () => void) {
    const untouched = JSON.stringify(form.getValues()) === pristineValuesRef.current;
    fill();
    if (untouched) pristineValuesRef.current = JSON.stringify(form.getValues());
  }
  const autosaveRef = useRef<() => Promise<void>>(async () => {});

  const catEntries = useFieldArray({ control, name: "catEntries" });

  function handleInvalid(errors: FieldErrors<DraftShiftReportInput>) {
    const paths: (string | number)[][] = [];
    for (const [field, value] of Object.entries(errors)) {
      const indices = Array.isArray(value) ? value.flatMap((entry, i) => (entry ? [i] : [])) : [];
      if (indices.length === 0) paths.push([field]);
      else for (const i of indices) paths.push([field, i]);
    }
    setSubmitAttemptError("Please fix the highlighted fields.");
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

  // The saved report's id, as a ref so a save that starts right after the
  // first draft was created PUTs to it instead of POSTing a second report.
  const reportIdRef = useRef<number | undefined>(report?.id);

  async function sendReport(payload: CreateShiftReportInput & { status: ShiftReportStatus }) {
    const existingId = reportIdRef.current;
    const { data } = existingId
      ? await api.put(`/api/shift-reports/${existingId}`, payload)
      : await api.post("/api/shift-reports", payload);
    const saved = data.shiftReport as ShiftReport;
    reportIdRef.current = saved.id;
    return saved;
  }

  // Latest queue, read at upload time rather than captured by a render's
  // closure, so a save never re-sends a photo an earlier save just uploaded.
  const photoQueueRef = useRef(photoQueue);
  useEffect(() => {
    photoQueueRef.current = photoQueue;
  }, [photoQueue]);

  // Uploads the queued photos, dropping each from the queue as soon as it's
  // stored. Failed uploads stay queued to retry on the next save; the
  // clientUploadId makes a retry of one that actually reached the server
  // return the stored photo rather than a duplicate.
  // Uploaded ids are tracked here too: the queue state (and its ref) only
  // catches up on the next render, which may come after the next save starts.
  const uploadedClientIdsRef = useRef(new Set<string>());
  async function syncQueuedPhotos(saved: ShiftReport) {
    const batch = photoQueueRef.current.filter(
      (photo) => !uploadedClientIdsRef.current.has(photo.clientUploadId),
    );
    await Promise.allSettled(
      batch.map(async (photo) => {
        const { data } = await uploadPhoto({ ...photo, shiftReportId: saved.id });
        const uploaded = data.photo as UploadedPhotoSummary;
        uploadedClientIdsRef.current.add(photo.clientUploadId);
        setPhotoQueue((prev) => prev.filter((p) => p.clientUploadId !== photo.clientUploadId));
        setUploadedPhotos((prev) =>
          prev.some((p) => p.id === uploaded.id) ? prev : [...prev, uploaded],
        );
      }),
    );
  }

  function invalidateShiftReportQueries() {
    queryClient.invalidateQueries({ queryKey: ["shiftReports"] });
    queryClient.invalidateQueries({ queryKey: ["cats"] });
    queryClient.invalidateQueries({ queryKey: ["kennels"] });
  }

  // Every save (autosave or submit) — the report and then its queued photos
  // — runs one at a time through here. Overlapping saves were how a photo
  // could be uploaded twice.
  const inFlightRef = useRef<Promise<void> | null>(null);
  function runExclusive(task: () => Promise<void>): Promise<void> {
    const run = task().finally(() => {
      if (inFlightRef.current === run) inFlightRef.current = null;
    });
    inFlightRef.current = run;
    return run;
  }

  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [submitError, setSubmitError] = useState<unknown>(null);

  async function handleSubmitReport(data: CreateShiftReportInput) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      // Let a running autosave finish first, so the two can't race.
      await inFlightRef.current?.catch(() => {});
      await runExclusive(async () => {
        const saved = await sendReport({ ...data, status: ShiftReportStatus.Submitted });
        dirtyRef.current = false;
        await syncQueuedPhotos(saved);
        invalidateShiftReportQueries();
        onSuccess(saved.id);
      });
    } catch (error) {
      setSubmitError(error);
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  const isAlreadySubmitted =
    (createdReport?.status ?? report?.status) === ShiftReportStatus.Submitted;

  // Silent background draft save: no error banner (a failure just shows a
  // quiet status and retries on the next trigger), and no-op when there is
  // nothing new or the report is already submitted. If another save is
  // running, it tries again once that one finishes.
  const autosaveAgainRef = useRef(false);
  async function autosave() {
    if (isAlreadySubmitted || submittingRef.current) return;
    if (!dirtyRef.current) return;
    if (inFlightRef.current) {
      autosaveAgainRef.current = true;
      return;
    }
    const isPristineNewReport =
      reportIdRef.current === undefined &&
      photoQueueRef.current.length === 0 &&
      JSON.stringify(form.getValues()) === pristineValuesRef.current;
    if (isPristineNewReport) return;
    const parsed = draftShiftReportSchema.safeParse(form.getValues());
    if (!parsed.success) return;
    setAutosaveStatus("saving");
    dirtyRef.current = false;
    await runExclusive(async () => {
      try {
        const wasNew = reportIdRef.current === undefined;
        const saved = await sendReport({ ...parsed.data, status: ShiftReportStatus.Draft });
        await syncQueuedPhotos(saved);
        setCreatedReport(saved);
        setLastSavedAt(new Date());
        setAutosaveStatus("idle");
        invalidateShiftReportQueries();
        if (wasNew) {
          // Seed the cache for the edit-page query the URL swap below is
          // about to trigger, so it resolves from cache instead of showing a
          // loading skeleton for a report the volunteer is already looking at.
          queryClient.setQueryData(["shiftReports", String(saved.id)], saved);
          onDraftCreated?.(saved.id);
        }
      } catch {
        dirtyRef.current = true;
        setAutosaveStatus("error");
      }
    });
    if (autosaveAgainRef.current) {
      autosaveAgainRef.current = false;
      void autosaveRef.current();
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
        const untouched = result.error.issues.filter(
          (issue) => issue.message === UNTOUCHED_ENTRY_MESSAGE,
        ).length;
        setSubmitAttemptError(
          untouched > 0
            ? `${untouched} ${untouched === 1 ? "cat still needs" : "cats still need"} info — fill ${untouched === 1 ? "it" : "them"} in or remove the card${untouched === 1 ? "" : "s"}.`
            : "Please complete the highlighted fields before submitting.",
        );
        return;
      }
      setSubmitAttemptError(null);
      void handleSubmitReport(result.data);
    }, handleInvalid)();
  }

  function individualEntry(catId: number): DraftShiftReportInput["catEntries"][number] {
    return {
      entryType: CatEntryType.Individual,
      catId,
      fecalScores: [],
      fecalEmpty: false,
      pee: false,
      peePoopNotes: "",
      foodNotes: "",
    };
  }

  function groupEntry(groupId: number): DraftShiftReportInput["catEntries"][number] {
    const group = (kennels ?? []).flatMap((k) => k.groups).find((g) => g.id === groupId);
    return {
      entryType: CatEntryType.Group,
      groupId,
      fecalScores: [],
      fecalEmpty: false,
      pee: false,
      peePoopNotes: "",
      foodNotes: "",
      catDetails: (group?.cats ?? []).map((c) => ({
        catId: c.id,
        foodNotes: "",
      })),
    };
  }

  // A new report starts with a card for every cat in a kennel (a group gets
  // one shared card), in kennel order, so volunteers fill cards in rather than
  // hunting each cat down in the picker. Cards for cats this shift didn't
  // look after (e.g. the other half of a split shift) are removed from the
  // card's menu. Runs once, and never for an existing report.
  const prefilledRef = useRef(isEdit);
  useEffect(() => {
    if (prefilledRef.current || !cats || !kennels) return;
    prefilledRef.current = true;
    const inCareIds = new Set(cats.filter(isInCare).map((c) => c.id));
    const entries: DraftShiftReportInput["catEntries"] = [];
    for (const kennel of [...kennels].sort((a, b) => a.number - b.number)) {
      for (const cat of kennel.cats) {
        if (inCareIds.has(cat.id)) entries.push(individualEntry(cat.id));
      }
      for (const group of kennel.groups) {
        if (group.cats.some((c) => inCareIds.has(c.id))) entries.push(groupEntry(group.id));
      }
    }
    if (entries.length > 0) withoutMarkingDirty(() => catEntries.append(entries));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot pre-fill once both lists load
  }, [cats, kennels]);

  // A single picker replaces separate "Add Individual/Group Entry" buttons —
  // which kind of entry a cat needs is roster trivia (is it currently housed
  // solo or with others), not something a volunteer should have to already
  // know. Picking a cat/group here decides the entry shape automatically.
  // Not a registered form field — just a transient "pick something to add"
  // trigger, reset after each use.
  const [pickerValue, setPickerValue] = useState("");

  const catEntryValues = useWatch({ control, name: "catEntries" }) ?? [];
  const playGroupValues = useWatch({ control, name: "playGroups" }) ?? [];
  const medicalNoteValues = useWatch({ control, name: "medicalNotes" }) ?? [];
  const meetAndGreetValues = useWatch({ control, name: "meetAndGreets" }) ?? [];
  const kennelsStatusValues = useWatch({ control, name: "kennelsStatus" }) ?? [];
  // "Select all cats" in a play group: every cat in care, whether or not it
  // has a card on this report or a kennel.
  const inCareCats = (cats ?? []).filter(isInCare);
  const inCareCatIds = inCareCats.map((c) => c.id);
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
    catEntries.append(kind === "cat" ? individualEntry(id) : groupEntry(id));
    setPickerValue("");
  }

  const autosaveStatusText = isAlreadySubmitted ? null : autosaveStatus === "saving" ? (
    <span className="text-muted-foreground">Saving…</span>
  ) : autosaveStatus === "error" ? (
    <span className="text-destructive">Not saved — will retry</span>
  ) : lastSavedAt ? (
    <span className="text-muted-foreground">
      Draft saved · {lastSavedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
    </span>
  ) : (
    <span className="text-muted-foreground">Autosaves as you go</span>
  );

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
            label: "Food",
            count: catEntries.fields.length,
            anchorId: "section-cat-entries",
          },
          {
            key: "medicalNotes",
            label: "Medical Notes",
            count: medicalNoteValues.length,
            anchorId: "section-medical-notes",
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
            key: "notes",
            label: "Overall Notes",
            count: notesCount,
            anchorId: "section-notes",
          },
          {
            key: "photos",
            label: "Photos",
            count: uploadedPhotos.length + photoQueue.length,
            anchorId: "section-photos",
          },
        ]}
        status={autosaveStatusText}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="shiftType">Shift Type</Label>
          <NativeSelect
            id="shiftType"
            aria-invalid={formState.errors.shiftType ? true : undefined}
            {...register("shiftType")}
          >
            <NativeSelectOption value={NO_SHIFT_TYPE}>Select shift…</NativeSelectOption>
            <NativeSelectOption value={ShiftType.Morning}>Morning</NativeSelectOption>
            <NativeSelectOption value={ShiftType.MidDay}>Mid-day</NativeSelectOption>
            <NativeSelectOption value={ShiftType.Evening}>Evening</NativeSelectOption>
          </NativeSelect>
          <ErrorMessage message={formState.errors.shiftType?.message} />
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
        withoutMarkingDirty={withoutMarkingDirty}
        kennelOptions={kennels ?? []}
      />

      <FormSection
        title="Food"
        count={catEntries.fields.length}
        anchorId="section-cat-entries"
        headerExtra={
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <NativeSelect
              aria-label="Add a cat"
              className="w-full sm:w-56"
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
        {catEntries.fields.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No cats on this report yet — add one from &ldquo;Add a cat…&rdquo;.
          </p>
        )}
        {catEntries.fields.map((field, index) => (
          <CatEntryCard
            key={field.id}
            form={form}
            index={index}
            cats={cats ?? []}
            kennels={kennels ?? []}
            onRemove={() => catEntries.remove(index)}
            onEditDone={() => void autosaveRef.current()}
          />
        ))}
      </FormSection>

      <MedicalNotesList
        form={form}
        cats={cats ?? []}
        pickableCats={inCareCats}
        onEditDone={() => void autosaveRef.current()}
      />

      <CatNoteGroupList
        form={form}
        name="playGroups"
        title="Play Groups"
        itemLabel="Play Group"
        addLabel="Add Play Group"
        cats={cats ?? []}
        pickableCats={inCareCats}
        selectAllCatIds={inCareCatIds}
        noteLabel="General note (optional)"
        onEditDone={() => void autosaveRef.current()}
      />

      <CatNoteGroupList
        form={form}
        name="meetAndGreets"
        title="Meet & Greets"
        itemLabel="Meet & Greet"
        addLabel="Add Meet & Greet"
        cats={cats ?? []}
        pickableCats={inCareCats}
        onEditDone={() => void autosaveRef.current()}
      />

      <FormSection title="Overall Notes" count={notesCount} anchorId="section-notes">
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
      </FormSection>

      <FormSection
        title="Photos"
        count={uploadedPhotos.length + photoQueue.length}
        anchorId="section-photos"
      >
        <PhotoUploadSection
          queued={photoQueue}
          onQueuedChange={setPhotoQueue}
          uploaded={uploadedPhotos}
          onUploadedDeleted={(photoId) =>
            setUploadedPhotos((prev) => prev.filter((p) => p.id !== photoId))
          }
          onUploadedTagsSaved={(photo) =>
            setUploadedPhotos((prev) => prev.map((p) => (p.id === photo.id ? photo : p)))
          }
          catOptions={catOptions}
          showTagPicker
        />
      </FormSection>

      {submitAttemptError && <ErrorAlert message={submitAttemptError} />}
      {submitError !== null && (
        <ErrorAlert error={submitError} fallback="Failed to save shift report" />
      )}

      <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        {autosaveStatusText && (
          <span data-testid="autosave-status-bottom" className="text-sm">
            {autosaveStatusText}
          </span>
        )}
        <Button type="button" disabled={submitting} onClick={handleSubmitClick}>
          {submitting ? "Saving..." : isAlreadySubmitted ? "Save Changes" : "Submit Report"}
        </Button>
      </div>
    </form>
  );
}
