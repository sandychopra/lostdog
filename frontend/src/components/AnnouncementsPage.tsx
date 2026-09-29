import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnnouncementType } from "shared/constants/announcementType.ts";
import { SignAction } from "shared/constants/signAction.ts";
import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import { TaskState } from "shared/constants/taskState.ts";
import { Role } from "shared/constants/role.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SortableTableHead,
} from "./ui/table";
import { Skeleton } from "./ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import AnnouncementForm from "./AnnouncementForm";
import Navbar from "./Navbar";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface AnnouncementCat {
  id: number;
  name: string;
  status: string;
  pickupAt: string | null;
  pickedUpAt: string | null;
  kennel: { id: number; number: number } | null;
}

interface ChecklistActionItem {
  id: number;
  order: number;
  actionType: ChecklistActionType;
  description: string | null;
  completed: boolean;
  completedAt: string | null;
  completedBy: { id: string; name: string } | null;
  kennel: { id: number; number: number } | null;
  cat: { id: number; name: string } | null;
  group: { id: number; cats: { id: number; name: string }[] } | null;
}

interface AnnouncementSignTask {
  id: number;
  action: SignAction;
  state: TaskState;
  completedAt: string | null;
  completedBy: { id: string; name: string } | null;
  cat: { id: number; name: string };
  kennel: { id: number; number: number };
}

interface AnnouncementKennelMoveRequest {
  id: number;
  state: TaskState;
  completedAt: string | null;
  completedBy: { id: string; name: string } | null;
  cat: { id: number; name: string } | null;
  group: { id: number; cats: { id: number; name: string }[] } | null;
  fromKennel: { id: number; number: number };
  toKennel: { id: number; number: number };
}

interface Announcement {
  id: number;
  type: AnnouncementType;
  title: string | null;
  message: string | null;
  cat: AnnouncementCat | null;
  kennel: { id: number; number: number } | null;
  checklist: { id: number; actions: ChecklistActionItem[] } | null;
  signTasks: AnnouncementSignTask[];
  kennelMoveRequests: AnnouncementKennelMoveRequest[];
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: { id: string; name: string } | null;
  createdBy: { id: string; name: string } | null;
  comment: string | null;
  commentedAt: string | null;
  commentedBy: { id: string; name: string } | null;
  createdAt: string;
}

const ANNOUNCEMENT_TYPE_LABELS: Record<AnnouncementType, string> = {
  [AnnouncementType.NewArrival]: "New Arrival",
  [AnnouncementType.PendingAdoption]: "Pending Adoption",
  [AnnouncementType.Adopted]: "Adopted",
  [AnnouncementType.BackAvailable]: "Back Available",
  [AnnouncementType.ReturnedToRcc]: "Returned to RCC",
  [AnnouncementType.KennelMoveRequested]: "Kennel Move Requested",
  [AnnouncementType.KennelNeedsReset]: "Kennel Needs Reset",
  [AnnouncementType.Manual]: "Announcement",
};

const SIGN_ACTION_LABELS: Record<SignAction, string> = {
  [SignAction.PostPending]: "Post Adoption Pending sign",
  [SignAction.PostAdopted]: "Post Adopted sign",
  [SignAction.RemovePending]: "Remove Adoption Pending sign",
  [SignAction.RemoveAdopted]: "Remove Adopted sign",
};

type SubActionKind =
  "signTask" | "confirmPickup" | "kennelMove" | "checklistAction" | "kennelReset";

interface SubAction {
  kind: SubActionKind;
  id: number;
  label: string;
  status: "open" | "done" | "cancelled";
  completedByName?: string;
  completedAt?: string | null;
  enabled: boolean;
}

function groupOrCatLabel(entry: {
  cat: { name: string } | null;
  group: { cats: { name: string }[] } | null;
}): string {
  return entry.cat?.name ?? entry.group!.cats.map((c) => c.name).join("/");
}

function getSubActions(announcement: Announcement): SubAction[] {
  // Any Manual announcement carrying a checklist (an ad-hoc post with tasks)
  // renders the same ordered-task UI.
  if (announcement.checklist) {
    const actions = [...announcement.checklist.actions].sort((a, b) => a.order - b.order);
    const firstIncompleteIndex = actions.findIndex((a) => !a.completed);
    return actions.map((action, index) => ({
      kind: "checklistAction",
      id: action.id,
      label:
        action.actionType === ChecklistActionType.ResetKennel
          ? `Reset kennel ${action.kennel!.number}`
          : action.actionType === ChecklistActionType.MoveCat
            ? `Move ${groupOrCatLabel(action)} → kennel ${action.kennel!.number}`
            : action.description!,
      status: action.completed ? "done" : "open",
      completedByName: action.completedBy?.name,
      completedAt: action.completedAt,
      enabled: !action.completed && index === firstIncompleteIndex,
    }));
  }

  switch (announcement.type) {
    case AnnouncementType.PendingAdoption:
    case AnnouncementType.Adopted: {
      const actions: SubAction[] = [];
      const task = announcement.signTasks[0];
      if (task) {
        actions.push({
          kind: "signTask",
          id: task.id,
          label: `${SIGN_ACTION_LABELS[task.action]} — kennel ${task.kennel.number}`,
          status:
            task.state === TaskState.Open
              ? "open"
              : task.state === TaskState.Done
                ? "done"
                : "cancelled",
          completedByName: task.completedBy?.name,
          completedAt: task.completedAt,
          enabled: true,
        });
      }
      const cat = announcement.cat;
      if (cat && cat.status === "Adopted" && cat.pickupAt !== null && cat.pickedUpAt === null) {
        actions.push({
          kind: "confirmPickup",
          id: cat.id,
          label: `Confirm pickup — scheduled ${new Date(cat.pickupAt).toLocaleString()}`,
          status: "open",
          enabled: true,
        });
      }
      return actions;
    }
    case AnnouncementType.BackAvailable:
    case AnnouncementType.ReturnedToRcc: {
      const task = announcement.signTasks[0];
      if (!task) return [];
      return [
        {
          kind: "signTask",
          id: task.id,
          label: `${SIGN_ACTION_LABELS[task.action]} — kennel ${task.kennel.number}`,
          status:
            task.state === TaskState.Open
              ? "open"
              : task.state === TaskState.Done
                ? "done"
                : "cancelled",
          completedByName: task.completedBy?.name,
          completedAt: task.completedAt,
          enabled: true,
        },
      ];
    }
    case AnnouncementType.KennelMoveRequested: {
      const request = announcement.kennelMoveRequests[0];
      if (!request) return [];
      return [
        {
          kind: "kennelMove",
          id: request.id,
          label: `Move ${groupOrCatLabel(request)} — kennel ${request.fromKennel.number} → kennel ${request.toKennel.number}`,
          status:
            request.state === TaskState.Open
              ? "open"
              : request.state === TaskState.Done
                ? "done"
                : "cancelled",
          completedByName: request.completedBy?.name,
          completedAt: request.completedAt,
          enabled: true,
        },
      ];
    }
    case AnnouncementType.KennelNeedsReset: {
      if (!announcement.kennel) return [];
      return [
        {
          kind: "kennelReset",
          id: announcement.kennel.id,
          label: `Reset kennel #${announcement.kennel.number}`,
          status: announcement.resolved ? "done" : "open",
          completedByName: announcement.resolvedBy?.name,
          completedAt: announcement.resolvedAt,
          enabled: true,
        },
      ];
    }
    default:
      return [];
  }
}

function statusBadge(announcement: Announcement): {
  label: string;
  variant: "secondary" | "warning";
} {
  if (announcement.resolved) return { label: "Resolved", variant: "secondary" };
  if (getSubActions(announcement).length === 0)
    return { label: "Informational", variant: "secondary" };
  return { label: "Open", variant: "warning" };
}

type SortColumn = "type" | "cat" | "kennel" | "created" | "closed" | "status";

function sortValue(announcement: Announcement, column: SortColumn): string | number {
  switch (column) {
    case "type":
      return ANNOUNCEMENT_TYPE_LABELS[announcement.type];
    case "cat":
      return announcement.cat?.name ?? "";
    case "kennel":
      return announcement.cat?.kennel?.number ?? announcement.kennel?.number ?? -1;
    case "created":
      return new Date(announcement.createdAt).getTime();
    case "closed":
      // Unresolved rows sort as if closed at the epoch — oldest, either end.
      return announcement.resolvedAt ? new Date(announcement.resolvedAt).getTime() : 0;
    case "status":
      return statusBadge(announcement).label;
  }
}

function isoDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultDateRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to);
  from.setDate(from.getDate() - 7);
  return { from: isoDateOnly(from), to: isoDateOnly(to) };
}

interface EditingAnnouncement {
  id: number;
  title: string | null;
  message: string | null;
}

type DialogState = { mode: "create" } | { mode: "edit"; announcement: EditingAnnouncement } | null;

export default function AnnouncementsPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;
  const queryClient = useQueryClient();

  const initialRange = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [activeOnly, setActiveOnly] = useState(true);
  const [sort, setSort] = useState<{ column: SortColumn; direction: "asc" | "desc" }>({
    column: "created",
    direction: "desc",
  });
  const [commentEditingId, setCommentEditingId] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deletingAnnouncement, setDeletingAnnouncement] = useState<{
    id: number;
    title: string | null;
  } | null>(null);

  const {
    data: announcements,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["announcements", activeOnly, dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<{ announcements: Announcement[] }>("/api/announcements", {
        params: {
          ...(activeOnly ? { activeOnly: "true" } : {}),
          ...(dateFrom ? { from: `${dateFrom}T00:00:00.000` } : {}),
          ...(dateTo ? { to: `${dateTo}T23:59:59.999` } : {}),
        },
      });
      return data.announcements;
    },
  });

  const sorted = useMemo(() => {
    if (!announcements) return [];
    const list = [...announcements];
    list.sort((a, b) => {
      const av = sortValue(a, sort.column);
      const bv = sortValue(b, sort.column);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return list;
  }, [announcements, sort]);

  function toggleSort(column: SortColumn) {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    );
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["announcements"] });
  };

  const completeSignTask = useMutation({
    mutationFn: (id: number) => api.patch(`/api/sign-tasks/${id}/complete`),
    onSuccess: invalidateAll,
  });
  const confirmPickup = useMutation({
    mutationFn: (catId: number) => api.patch(`/api/cats/${catId}/confirm-pickup`),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["cats"] });
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
    },
  });
  const completeKennelMove = useMutation({
    mutationFn: (id: number) => api.patch(`/api/kennel-move-requests/${id}/complete`),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
    },
  });
  const completeChecklistAction = useMutation({
    mutationFn: (id: number) => api.patch(`/api/kennel-prep-checklists/actions/${id}/complete`),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["cats"] });
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
    },
  });
  const completeKennelReset = useMutation({
    mutationFn: (kennelId: number) => api.patch(`/api/kennels/${kennelId}/complete-reset`),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
    },
  });
  const resolveManual = useMutation({
    mutationFn: (id: number) => api.patch(`/api/announcements/${id}/resolve`),
    onSuccess: invalidateAll,
  });
  const deleteManual = useMutation({
    mutationFn: (id: number) => api.delete(`/api/announcements/${id}`),
    onSuccess: () => {
      invalidateAll();
      setDeletingAnnouncement(null);
    },
  });
  const saveComment = useMutation({
    mutationFn: (args: { id: number; comment: string }) =>
      api.patch(`/api/announcements/${args.id}/comment`, { comment: args.comment }),
    onSuccess: () => {
      invalidateAll();
      setCommentEditingId(null);
    },
  });

  function isBusy(kind: SubActionKind, id: number): boolean {
    switch (kind) {
      case "signTask":
        return completeSignTask.isPending && completeSignTask.variables === id;
      case "confirmPickup":
        return confirmPickup.isPending && confirmPickup.variables === id;
      case "kennelMove":
        return completeKennelMove.isPending && completeKennelMove.variables === id;
      case "checklistAction":
        return completeChecklistAction.isPending && completeChecklistAction.variables === id;
      case "kennelReset":
        return completeKennelReset.isPending && completeKennelReset.variables === id;
    }
  }

  function triggerComplete(action: SubAction) {
    switch (action.kind) {
      case "signTask":
        completeSignTask.mutate(action.id);
        break;
      case "confirmPickup":
        confirmPickup.mutate(action.id);
        break;
      case "kennelMove":
        completeKennelMove.mutate(action.id);
        break;
      case "checklistAction":
        completeChecklistAction.mutate(action.id);
        break;
      case "kennelReset":
        completeKennelReset.mutate(action.id);
        break;
    }
  }

  const close = () => setDialog(null);

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Announcements</h1>
          {isAdmin && (
            <Button onClick={() => setDialog({ mode: "create" })}>
              <Plus className="mr-1 h-4 w-4" />
              New Announcement
            </Button>
          )}
        </div>

        <div className="mb-6 flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="dateFrom">From</Label>
            <input
              id="dateFrom"
              type="date"
              className="flex h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="dateTo">To</Label>
            <input
              id="dateTo"
              type="date"
              className="flex h-10 rounded-md border border-input bg-white px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
          <label className="flex h-10 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={activeOnly}
              onChange={(e) => setActiveOnly(e.target.checked)}
            />
            Active only
          </label>
        </div>

        {error ? (
          <ErrorAlert message="Failed to fetch announcements" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <SortableTableHead
                  active={sort.column === "type"}
                  direction={sort.direction}
                  onSort={() => toggleSort("type")}
                >
                  Type
                </SortableTableHead>
                <SortableTableHead
                  active={sort.column === "cat"}
                  direction={sort.direction}
                  onSort={() => toggleSort("cat")}
                >
                  Cat
                </SortableTableHead>
                <SortableTableHead
                  active={sort.column === "kennel"}
                  direction={sort.direction}
                  onSort={() => toggleSort("kennel")}
                >
                  Kennel
                </SortableTableHead>
                <TableHead>Action</TableHead>
                <TableHead>Done</TableHead>
                <SortableTableHead
                  active={sort.column === "created"}
                  direction={sort.direction}
                  onSort={() => toggleSort("created")}
                >
                  Created
                </SortableTableHead>
                <SortableTableHead
                  active={sort.column === "closed"}
                  direction={sort.direction}
                  onSort={() => toggleSort("closed")}
                >
                  Closed
                </SortableTableHead>
                <SortableTableHead
                  active={sort.column === "status"}
                  direction={sort.direction}
                  onSort={() => toggleSort("status")}
                >
                  Status
                </SortableTableHead>
                <TableHead>Comment</TableHead>
                {isAdmin && <TableHead>Admin</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading
                ? Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: isAdmin ? 10 : 9 }).map((_, j) => (
                        <TableCell key={j}>
                          <Skeleton className="h-4 w-20" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                : sorted.map((announcement) => {
                    const subActions = getSubActions(announcement);
                    const status = statusBadge(announcement);
                    const kennelNumber =
                      announcement.cat?.kennel?.number ?? announcement.kennel?.number ?? null;
                    const isCommenting = commentEditingId === announcement.id;

                    return (
                      <TableRow key={announcement.id}>
                        <TableCell>
                          {announcement.type === AnnouncementType.Manual
                            ? (announcement.title ?? "Announcement")
                            : ANNOUNCEMENT_TYPE_LABELS[announcement.type]}
                        </TableCell>
                        <TableCell>{announcement.cat?.name ?? "—"}</TableCell>
                        <TableCell>{kennelNumber ?? "—"}</TableCell>
                        <TableCell>
                          {announcement.type === AnnouncementType.Manual &&
                            announcement.message && (
                              <p className="text-muted-foreground">{announcement.message}</p>
                            )}
                          {subActions.length === 0 ? (
                            announcement.type !== AnnouncementType.Manual && "—"
                          ) : (
                            <div className="flex flex-col gap-1">
                              {subActions.map((action) => (
                                <div key={`${action.kind}-${action.id}`} className="text-sm">
                                  {action.label}
                                  {action.status === "done" && action.completedByName && (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      — {action.completedByName},{" "}
                                      {action.completedAt
                                        ? new Date(action.completedAt).toLocaleString()
                                        : "—"}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {subActions.length === 0 ? (
                            "—"
                          ) : (
                            <div className="flex flex-col gap-1">
                              {subActions.map((action) => (
                                <div
                                  key={`${action.kind}-${action.id}`}
                                  className="flex h-5 items-center"
                                >
                                  {action.status === "cancelled" ? (
                                    <Badge variant="secondary" title="No longer applicable">
                                      N/A
                                    </Badge>
                                  ) : (
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 disabled:cursor-not-allowed"
                                      checked={action.status === "done"}
                                      disabled={
                                        action.status === "done" ||
                                        !action.enabled ||
                                        isBusy(action.kind, action.id)
                                      }
                                      title={
                                        !action.enabled && action.status === "open"
                                          ? "Complete earlier steps first"
                                          : undefined
                                      }
                                      onChange={() => {
                                        if (action.status === "open" && action.enabled) {
                                          triggerComplete(action);
                                        }
                                      }}
                                    />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>{new Date(announcement.createdAt).toLocaleString()}</TableCell>
                        <TableCell>
                          {announcement.resolvedAt ? (
                            <>
                              {new Date(announcement.resolvedAt).toLocaleString()}
                              {announcement.resolvedBy && (
                                <span className="text-muted-foreground">
                                  {" "}
                                  — {announcement.resolvedBy.name}
                                </span>
                              )}
                            </>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                          {announcement.type === AnnouncementType.Manual &&
                            !announcement.resolved &&
                            isAdmin && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-1"
                                disabled={resolveManual.isPending}
                                onClick={() => resolveManual.mutate(announcement.id)}
                              >
                                Mark resolved
                              </Button>
                            )}
                        </TableCell>
                        <TableCell className="min-w-48">
                          {isCommenting ? (
                            <div className="space-y-1">
                              <textarea
                                className="flex min-h-16 w-full rounded-md border border-input bg-white px-2 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                value={commentDraft}
                                onChange={(e) => setCommentDraft(e.target.value)}
                              />
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  disabled={saveComment.isPending}
                                  onClick={() =>
                                    saveComment.mutate({
                                      id: announcement.id,
                                      comment: commentDraft,
                                    })
                                  }
                                >
                                  Save
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setCommentEditingId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1 text-sm">
                              {announcement.comment && (
                                <p>
                                  {announcement.comment}
                                  {announcement.commentedBy && (
                                    <span className="text-muted-foreground">
                                      {" "}
                                      — {announcement.commentedBy.name}
                                      {announcement.commentedAt
                                        ? `, ${new Date(announcement.commentedAt).toLocaleString()}`
                                        : ""}
                                    </span>
                                  )}
                                </p>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setCommentEditingId(announcement.id);
                                  setCommentDraft(announcement.comment ?? "");
                                }}
                              >
                                {announcement.comment ? "Edit comment" : "Add comment"}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            {announcement.type === AnnouncementType.Manual && (
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Edit announcement"
                                  onClick={() =>
                                    setDialog({
                                      mode: "edit",
                                      announcement: {
                                        id: announcement.id,
                                        title: announcement.title,
                                        message: announcement.message,
                                      },
                                    })
                                  }
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Delete announcement"
                                  onClick={() =>
                                    setDeletingAnnouncement({
                                      id: announcement.id,
                                      title: announcement.title,
                                    })
                                  }
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })}
              {!isLoading && sorted.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 10 : 9}
                    className="text-center text-muted-foreground"
                  >
                    No announcements to show.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}

        <Dialog
          open={dialog !== null}
          onOpenChange={(open) => {
            if (!open) close();
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {dialog?.mode === "edit" ? "Edit Announcement" : "New Announcement"}
              </DialogTitle>
            </DialogHeader>
            <AnnouncementForm
              key={dialog?.mode === "edit" ? dialog.announcement.id : "create"}
              announcement={dialog?.mode === "edit" ? dialog.announcement : undefined}
              onSuccess={close}
            />
          </DialogContent>
        </Dialog>

        <AlertDialog
          open={deletingAnnouncement !== null}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingAnnouncement(null);
              deleteManual.reset();
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete &ldquo;
                {deletingAnnouncement?.title ?? "this announcement"}
                &rdquo;? This can&apos;t be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteManual.isError && <ErrorAlert message="Failed to delete announcement" />}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingAnnouncement && deleteManual.mutate(deletingAnnouncement.id)}
              >
                Confirm
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </>
  );
}
