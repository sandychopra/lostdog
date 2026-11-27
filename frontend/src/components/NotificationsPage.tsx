import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { NotificationType } from "shared/constants/notificationType.ts";
import { SignAction } from "shared/constants/signAction.ts";
import { ChecklistActionType } from "shared/constants/checklistActionType.ts";
import { TaskState } from "shared/constants/taskState.ts";
import { Role } from "shared/constants/role.ts";
import { DewormerStatus } from "shared/constants/dewormerStatus.ts";
import { api } from "../lib/api";
import { authClient } from "../lib/auth-client";
import ErrorAlert from "./ErrorAlert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Skeleton } from "./ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./ui/collapsible";
import { Checkbox } from "./ui/checkbox";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";
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
import NotificationForm from "./NotificationForm";
import AppLayout from "./AppLayout";
import { Card } from "./ui/card";
import CollarDot from "./CollarDot";
import KennelTile from "./KennelTile";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Megaphone, Pill, X } from "lucide-react";

interface NotificationCat {
  id: number;
  name: string;
  status: string;
  pickupAt: string | null;
  pickedUpAt: string | null;
  dewormerStatus: DewormerStatus;
  dewormerDueDate: string | null;
  needsProbiotic: boolean;
  collarColor: string | null;
  active: boolean;
  kennel: { id: number; number: number } | null;
}

interface ProbioticDose {
  loggedAt: string;
  loggedBy: string;
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

interface NotificationSignTask {
  id: number;
  action: SignAction;
  state: TaskState;
  completedAt: string | null;
  completedBy: { id: string; name: string } | null;
  cat: { id: number; name: string };
  kennel: { id: number; number: number };
}

interface NotificationKennelMoveRequest {
  id: number;
  state: TaskState;
  completedAt: string | null;
  completedBy: { id: string; name: string } | null;
  cat: { id: number; name: string } | null;
  group: { id: number; cats: { id: number; name: string }[] } | null;
  fromKennel: { id: number; number: number };
  toKennel: { id: number; number: number };
}

interface Notification {
  id: number;
  type: NotificationType;
  title: string | null;
  message: string | null;
  cat: NotificationCat | null;
  kennel: { id: number; number: number } | null;
  checklist: { id: number; actions: ChecklistActionItem[] } | null;
  signTasks: NotificationSignTask[];
  kennelMoveRequests: NotificationKennelMoveRequest[];
  doses: ProbioticDose[];
  lastProbioticGivenAt: string | null;
  resolved: boolean;
  resolvedAt: string | null;
  resolvedBy: { id: string; name: string } | null;
  dismissed: boolean;
  dismissNote: string | null;
  createdBy: { id: string; name: string } | null;
  comment: string | null;
  commentedAt: string | null;
  commentedBy: { id: string; name: string } | null;
  createdAt: string;
}

const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  [NotificationType.NewArrival]: "New Arrival",
  [NotificationType.PendingAdoption]: "Pending Adoption",
  [NotificationType.Adopted]: "Adopted",
  [NotificationType.BackAvailable]: "Back Available",
  [NotificationType.ReturnedToRcc]: "Returned to RCC",
  [NotificationType.KennelMoveRequested]: "Kennel Move Requested",
  [NotificationType.KennelNeedsReset]: "Kennel Needs Reset",
  [NotificationType.DewormerDue]: "Dewormer",
  [NotificationType.ProbioticNeeded]: "Probiotic",
  [NotificationType.PickedUp]: "Picked Up",
  [NotificationType.Manual]: "Announcement",
};

const SIGN_ACTION_LABELS: Record<SignAction, string> = {
  [SignAction.PostPending]: "Post Adoption Pending sign",
  [SignAction.PostAdopted]: "Post Adopted sign",
  [SignAction.RemovePending]: "Remove Adoption Pending sign",
  [SignAction.RemoveAdopted]: "Remove Adopted sign",
};

type SubActionKind =
  "signTask" | "confirmPickup" | "kennelMove" | "checklistAction" | "kennelReset" | "dewormerGiven";

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

// Today as YYYY-MM-DD in the viewer's time zone. dewormerDueDate is a date-only
// value (sent as UTC midnight), so comparing its YYYY-MM-DD prefix against the
// local date avoids it flipping a day early or late around midnight.
function localToday(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function dueDateKey(cat: NotificationCat): string | null {
  return cat.dewormerDueDate ? cat.dewormerDueDate.slice(0, 10) : null;
}

function formatDateOnly(key: string): string {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year!, month! - 1, day!).toLocaleDateString();
}

// A cat still Due after its due date shows as Overdue.
function isDewormerOverdue(cat: NotificationCat): boolean {
  const due = dueDateKey(cat);
  if (cat.dewormerStatus !== DewormerStatus.Due || !due) return false;
  return due < localToday();
}

// An open DewormerDue card stays hidden until its due date arrives.
function isNotYetDue(notification: Notification): boolean {
  if (notification.type !== NotificationType.DewormerDue || notification.resolved) return false;
  const due = notification.cat ? dueDateKey(notification.cat) : null;
  return due !== null && due > localToday();
}

// Same 24h-since-last-dose rule as before, now scoped to the current
// ProbioticNeeded episode (lastProbioticGivenAt is null if no dose has been
// logged since the notification — i.e. since the flag was set — per
// project-scope: overdue from the moment the flag was set in that case).
function isProbioticOverdue(notification: Notification): boolean {
  if (!notification.lastProbioticGivenAt) return true;
  return Date.now() - new Date(notification.lastProbioticGivenAt).getTime() > 24 * 60 * 60 * 1000;
}

function getSubActions(notification: Notification): SubAction[] {
  // Any Manual notification carrying a checklist (an ad-hoc post with tasks)
  // renders the same ordered-task UI.
  if (notification.checklist) {
    const actions = [...notification.checklist.actions].sort((a, b) => a.order - b.order);
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

  switch (notification.type) {
    case NotificationType.PendingAdoption:
    case NotificationType.Adopted: {
      const actions: SubAction[] = [];
      const task = notification.signTasks[0];
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
      const cat = notification.cat;
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
    case NotificationType.BackAvailable:
    case NotificationType.ReturnedToRcc:
    case NotificationType.PickedUp: {
      const task = notification.signTasks[0];
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
    case NotificationType.KennelMoveRequested: {
      const request = notification.kennelMoveRequests[0];
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
    case NotificationType.KennelNeedsReset: {
      if (!notification.kennel) return [];
      return [
        {
          kind: "kennelReset",
          id: notification.kennel.id,
          label: `Reset kennel #${notification.kennel.number}`,
          status: notification.resolved ? "done" : "open",
          completedByName: notification.resolvedBy?.name,
          completedAt: notification.resolvedAt,
          enabled: true,
        },
      ];
    }
    case NotificationType.DewormerDue: {
      if (!notification.cat) return [];
      const overdue = isDewormerOverdue(notification.cat);
      const dueKey = dueDateKey(notification.cat);
      const dueDate = dueKey ? formatDateOnly(dueKey) : null;
      return [
        {
          kind: "dewormerGiven",
          id: notification.cat.id,
          label:
            "Mark dewormer given" +
            (dueDate ? (overdue ? ` — Overdue since ${dueDate}` : ` — due ${dueDate}`) : ""),
          status: notification.resolved ? "done" : "open",
          completedByName: notification.resolvedBy?.name,
          completedAt: notification.resolvedAt,
          enabled: true,
        },
      ];
    }
    // ProbioticNeeded has no completable sub-action in the generic sense — only
    // an Admin clears the "needs probiotic" flag, from the cat's edit form, to
    // resolve it. Its status/dose-log/"Log dose" button render directly in the
    // table body below instead, since logging a dose never resolves anything.
    default:
      return [];
  }
}

function ActionRow({
  action,
  isBusy,
  onComplete,
  onUncomplete,
  error,
}: {
  action: SubAction;
  isBusy: boolean;
  onComplete: () => void;
  onUncomplete: () => void;
  error?: unknown;
}) {
  const checked = action.status === "done";
  const canUncheck = checked && (action.kind === "signTask" || action.kind === "kennelReset");

  return (
    <div className="flex items-start gap-2">
      {action.status === "cancelled" ? (
        <Badge variant="secondary" title="No longer applicable">
          N/A
        </Badge>
      ) : (
        <Checkbox
          className="mt-0.5 shrink-0"
          checked={checked}
          disabled={isBusy || (checked ? !canUncheck : !action.enabled)}
          title={
            !action.enabled && action.status === "open" ? "Complete earlier steps first" : undefined
          }
          onCheckedChange={() => {
            if (isBusy) return;
            if (checked) {
              if (canUncheck) onUncomplete();
            } else if (action.enabled) {
              onComplete();
            }
          }}
        />
      )}
      <div className="min-w-0 flex-1 text-sm whitespace-normal break-words">
        {action.label}
        {checked && action.completedByName && (
          <div className="text-xs text-muted-foreground">
            — {action.completedByName},{" "}
            {action.completedAt ? new Date(action.completedAt).toLocaleString() : "—"}
          </div>
        )}
        {error !== undefined && (
          <div className="mt-1">
            <ErrorAlert error={error} />
          </div>
        )}
      </div>
    </div>
  );
}

function ProbioticStatus({
  notification,
  collapsed,
  onToggle,
  onLogDose,
  isLoggingDose,
  logDoseError,
}: {
  notification: Notification;
  collapsed: boolean;
  onToggle: () => void;
  onLogDose: () => void;
  isLoggingDose: boolean;
  logDoseError: unknown;
}) {
  const overdue = isProbioticOverdue(notification);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button size="sm" variant="outline" disabled={isLoggingDose} onClick={onLogDose}>
          Log dose
        </Button>
        <span className="text-sm text-muted-foreground">
          {notification.lastProbioticGivenAt
            ? `Last dose ${new Date(notification.lastProbioticGivenAt).toLocaleString()}`
            : "No dose logged yet"}
          {overdue && " (more than 24 hours ago)"}
        </span>
      </div>
      {logDoseError !== undefined && (
        <div className="mt-1">
          <ErrorAlert error={logDoseError} />
        </div>
      )}
      {notification.doses.length > 0 && (
        <Collapsible open={!collapsed} onOpenChange={onToggle} className="mt-2">
          <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium">
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
            {notification.doses.length} dose{notification.doses.length === 1 ? "" : "s"} logged
          </CollapsibleTrigger>
          <CollapsibleContent asChild>
            <ul className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
              {notification.doses.map((dose, index) => (
                <li key={index}>
                  {new Date(dose.loggedAt).toLocaleString()} — {dose.loggedBy}
                </li>
              ))}
            </ul>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// Overdue dewormer or probiotic: the card's kennel tile turns gold and its
// status reads Overdue.
function isOverdue(notification: Notification): boolean {
  if (notification.resolved || !notification.cat) return false;
  if (notification.type === NotificationType.DewormerDue)
    return isDewormerOverdue(notification.cat);
  if (notification.type === NotificationType.ProbioticNeeded)
    return isProbioticOverdue(notification);
  return false;
}

function statusBadge(notification: Notification): {
  label: string;
  variant: "secondary" | "warning" | "destructive";
} {
  if (notification.dismissed) return { label: "Not relevant", variant: "secondary" };
  if (notification.resolved) return { label: "Resolved", variant: "secondary" };
  if (isOverdue(notification)) return { label: "Overdue", variant: "destructive" };
  if (notification.type === NotificationType.ProbioticNeeded)
    return { label: "Open", variant: "warning" };
  if (getSubActions(notification).length === 0)
    return { label: "Informational", variant: "secondary" };
  return { label: "Open", variant: "warning" };
}

function kennelNumberOf(notification: Notification): number | null {
  return notification.cat?.kennel?.number ?? notification.kennel?.number ?? null;
}

type StatusFilter = "open" | "done" | "notRelevant" | "all";
type Kind = "action" | "medical" | "info";
type KindFilter = Kind | "all";

const STATUS_FILTERS: [StatusFilter, string][] = [
  ["open", "Open"],
  ["done", "Done"],
  ["notRelevant", "Not relevant"],
  ["all", "All"],
];

const KIND_FILTERS: [KindFilter, string][] = [
  ["all", "All"],
  ["action", "Needs action"],
  ["medical", "Medical"],
  ["info", "Informational"],
];

const MEDICAL_TYPES: NotificationType[] = [
  NotificationType.DewormerDue,
  NotificationType.ProbioticNeeded,
];
const ACTION_TYPES: NotificationType[] = [
  NotificationType.PendingAdoption,
  NotificationType.Adopted,
  NotificationType.KennelMoveRequested,
  NotificationType.KennelNeedsReset,
];

// Medical: dewormer and probiotic. Needs action: anything with something to
// tick off (signs, pickup, moves, resets, checklists). Informational: the rest
// (arrivals, departures without a sign task, plain admin posts).
function kindOf(notification: Notification): Kind {
  if (MEDICAL_TYPES.includes(notification.type)) return "medical";
  if (
    ACTION_TYPES.includes(notification.type) ||
    notification.checklist !== null ||
    getSubActions(notification).length > 0
  ) {
    return "action";
  }
  return "info";
}

function matchesStatus(notification: Notification, filter: StatusFilter): boolean {
  switch (filter) {
    case "open":
      return !notification.resolved;
    case "done":
      return notification.resolved && !notification.dismissed;
    case "notRelevant":
      return notification.dismissed;
    case "all":
      return true;
  }
}

// A cat that has left (picked up / returned to RCC) is off the Cats page; of its
// notifications only the one saying it left is still worth showing.
function isAboutDepartedCat(notification: Notification): boolean {
  return (
    notification.cat !== null &&
    !notification.cat.active &&
    notification.type !== NotificationType.PickedUp &&
    notification.type !== NotificationType.ReturnedToRcc
  );
}

type SortColumn = "type" | "cat" | "kennel" | "created" | "status";

const SORT_COLUMNS: [SortColumn, string][] = [
  ["created", "Created"],
  ["type", "Type"],
  ["cat", "Cat"],
  ["kennel", "Kennel"],
  ["status", "Status"],
];

function sortValue(notification: Notification, column: SortColumn): string | number {
  switch (column) {
    case "type":
      return NOTIFICATION_TYPE_LABELS[notification.type];
    case "cat":
      return notification.cat?.name ?? "";
    case "kennel":
      return notification.cat?.kennel?.number ?? notification.kennel?.number ?? -1;
    case "created":
      return new Date(notification.createdAt).getTime();
    case "status":
      return statusBadge(notification).label;
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

interface EditingNotification {
  id: number;
  title: string | null;
  message: string | null;
}

type DialogState = { mode: "create" } | { mode: "edit"; notification: EditingNotification } | null;

export default function NotificationsPage() {
  const { data: session } = authClient.useSession();
  const isAdmin = session?.user.role === Role.Admin;
  const queryClient = useQueryClient();

  const initialRange = defaultDateRange();
  const [dateFrom, setDateFrom] = useState(initialRange.from);
  const [dateTo, setDateTo] = useState(initialRange.to);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("open");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [catFilter, setCatFilter] = useState<{ id: number; name: string } | null>(null);
  const [sort, setSort] = useState<{ column: SortColumn; direction: "asc" | "desc" }>({
    column: "created",
    direction: "desc",
  });
  const [commentEditingId, setCommentEditingId] = useState<number | null>(null);
  const [commentDraft, setCommentDraft] = useState("");
  const [collapsedIds, setCollapsedIds] = useState<Set<number>>(new Set());
  const [dialog, setDialog] = useState<DialogState>(null);
  const [deletingNotification, setDeletingNotification] = useState<{
    id: number;
    title: string | null;
  } | null>(null);
  const [dismissing, setDismissing] = useState<{ id: number; headline: string } | null>(null);
  const [dismissNote, setDismissNote] = useState("");

  const {
    data: notifications,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["notifications", dateFrom, dateTo],
    queryFn: async () => {
      const { data } = await api.get<{ notifications: Notification[] }>("/api/notifications", {
        params: {
          ...(dateFrom ? { from: `${dateFrom}T00:00:00.000` } : {}),
          ...(dateTo ? { to: `${dateTo}T23:59:59.999` } : {}),
        },
      });
      return data.notifications;
    },
  });

  // Status and the departed-cat rule decide what's "in view"; the Cat dropdown
  // lists the cats in that view, and Kind/Cat then narrow it further.
  const inView = useMemo(
    () =>
      (notifications ?? []).filter(
        (notification) =>
          !isNotYetDue(notification) &&
          !isAboutDepartedCat(notification) &&
          matchesStatus(notification, statusFilter),
      ),
    [notifications, statusFilter],
  );

  const catOptions = useMemo(() => {
    const byId = new Map<number, string>();
    for (const notification of inView) {
      if (notification.cat) byId.set(notification.cat.id, notification.cat.name);
    }
    if (catFilter) byId.set(catFilter.id, catFilter.name);
    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inView, catFilter]);

  const filtersActive = statusFilter !== "open" || kindFilter !== "all" || catFilter !== null;
  function clearFilters() {
    setStatusFilter("open");
    setKindFilter("all");
    setCatFilter(null);
  }

  const sorted = useMemo(() => {
    const list = inView.filter(
      (notification) =>
        (kindFilter === "all" || kindOf(notification) === kindFilter) &&
        (catFilter === null || notification.cat?.id === catFilter.id),
    );
    list.sort((a, b) => {
      const av = sortValue(a, sort.column);
      const bv = sortValue(b, sort.column);
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
      return sort.direction === "asc" ? cmp : -cmp;
    });
    return list;
  }, [inView, kindFilter, catFilter, sort]);

  function toggleCollapsed(id: number) {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["notifications"] });
  };

  const dismiss = useMutation({
    mutationFn: (args: { id: number; note: string }) =>
      api.patch(`/api/notifications/${args.id}/dismiss`, { note: args.note }),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
      setDismissing(null);
    },
  });
  const reopen = useMutation({
    mutationFn: (id: number) => api.patch(`/api/notifications/${id}/reopen`),
    onSuccess: invalidateAll,
  });

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
  const markDewormerGiven = useMutation({
    mutationFn: (catId: number) => api.patch(`/api/cats/${catId}/dewormer`),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["cats"] });
    },
  });
  const logProbioticDose = useMutation({
    mutationFn: (catId: number) => api.post(`/api/cats/${catId}/probiotic-dose`),
    onSuccess: invalidateAll,
  });
  const uncompleteSignTask = useMutation({
    mutationFn: (id: number) => api.patch(`/api/sign-tasks/${id}/uncomplete`),
    onSuccess: invalidateAll,
  });
  const uncompleteKennelReset = useMutation({
    mutationFn: (kennelId: number) => api.patch(`/api/kennels/${kennelId}/uncomplete-reset`),
    onSuccess: () => {
      invalidateAll();
      queryClient.invalidateQueries({ queryKey: ["kennels"] });
    },
  });
  const resolveManual = useMutation({
    mutationFn: (id: number) => api.patch(`/api/notifications/${id}/resolve`),
    onSuccess: invalidateAll,
  });
  const deleteManual = useMutation({
    mutationFn: (id: number) => api.delete(`/api/notifications/${id}`),
    onSuccess: () => {
      invalidateAll();
      setDeletingNotification(null);
    },
  });
  const saveComment = useMutation({
    mutationFn: (args: { id: number; comment: string }) =>
      api.patch(`/api/notifications/${args.id}/comment`, { comment: args.comment }),
    onSuccess: () => {
      invalidateAll();
      setCommentEditingId(null);
    },
  });

  function isBusy(kind: SubActionKind, id: number): boolean {
    switch (kind) {
      case "signTask":
        return (
          (completeSignTask.isPending && completeSignTask.variables === id) ||
          (uncompleteSignTask.isPending && uncompleteSignTask.variables === id)
        );
      case "confirmPickup":
        return confirmPickup.isPending && confirmPickup.variables === id;
      case "kennelMove":
        return completeKennelMove.isPending && completeKennelMove.variables === id;
      case "checklistAction":
        return completeChecklistAction.isPending && completeChecklistAction.variables === id;
      case "kennelReset":
        return (
          (completeKennelReset.isPending && completeKennelReset.variables === id) ||
          (uncompleteKennelReset.isPending && uncompleteKennelReset.variables === id)
        );
      case "dewormerGiven":
        return markDewormerGiven.isPending && markDewormerGiven.variables === id;
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
      case "dewormerGiven":
        markDewormerGiven.mutate(action.id);
        break;
    }
  }

  function triggerUncomplete(action: SubAction) {
    switch (action.kind) {
      case "signTask":
        uncompleteSignTask.mutate(action.id);
        break;
      case "kennelReset":
        uncompleteKennelReset.mutate(action.id);
        break;
      default:
        break;
    }
  }

  // The error from the last complete/undo attempt on this action, if it failed.
  function actionErrorFor(kind: SubActionKind, id: number): unknown {
    const failed = (mutation: { isError: boolean; variables: unknown; error: unknown }): unknown =>
      mutation.isError && mutation.variables === id ? mutation.error : undefined;
    switch (kind) {
      case "signTask":
        return failed(completeSignTask) ?? failed(uncompleteSignTask);
      case "confirmPickup":
        return failed(confirmPickup);
      case "kennelMove":
        return failed(completeKennelMove);
      case "checklistAction":
        return failed(completeChecklistAction);
      case "kennelReset":
        return failed(completeKennelReset) ?? failed(uncompleteKennelReset);
      case "dewormerGiven":
        return failed(markDewormerGiven);
    }
  }

  // The card's big line: who or what it's about. The type goes above it.
  function notificationHeadline(notification: Notification): string {
    if (notification.type === NotificationType.Manual) return notification.title ?? "Announcement";
    if (notification.cat) return notification.cat.name;
    const kennelNumber = kennelNumberOf(notification);
    if (kennelNumber !== null) return `Kennel ${kennelNumber}`;
    return NOTIFICATION_TYPE_LABELS[notification.type];
  }

  // Cell contents shared by the desktop table and the phone cards.
  function renderActions(notification: Notification) {
    // A card marked "Not relevant" keeps its message but drops its actions.
    const subActions = notification.dismissed ? [] : getSubActions(notification);
    return (
      <>
        {notification.type === NotificationType.Manual && notification.message && (
          <p className="text-muted-foreground">{notification.message}</p>
        )}
        {notification.dismissed ? null : notification.type === NotificationType.ProbioticNeeded ? (
          <ProbioticStatus
            notification={notification}
            collapsed={collapsedIds.has(notification.id)}
            onToggle={() => toggleCollapsed(notification.id)}
            onLogDose={() => logProbioticDose.mutate(notification.cat!.id)}
            isLoggingDose={
              logProbioticDose.isPending && logProbioticDose.variables === notification.cat?.id
            }
            logDoseError={
              logProbioticDose.isError && logProbioticDose.variables === notification.cat?.id
                ? logProbioticDose.error
                : undefined
            }
          />
        ) : subActions.length === 0 ? null : notification.checklist && subActions.length > 1 ? (
          (() => {
            const collapsed = collapsedIds.has(notification.id);
            const doneCount = subActions.filter((a) => a.status === "done").length;
            return (
              <Collapsible open={!collapsed} onOpenChange={() => toggleCollapsed(notification.id)}>
                <CollapsibleTrigger className="flex items-center gap-1 text-sm font-medium">
                  {collapsed ? (
                    <ChevronRight className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                  {doneCount} of {subActions.length} steps done
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 flex flex-col gap-2">
                  {subActions.map((action) => (
                    <ActionRow
                      key={`${action.kind}-${action.id}`}
                      action={action}
                      isBusy={isBusy(action.kind, action.id)}
                      onComplete={() => triggerComplete(action)}
                      onUncomplete={() => triggerUncomplete(action)}
                      error={actionErrorFor(action.kind, action.id)}
                    />
                  ))}
                </CollapsibleContent>
              </Collapsible>
            );
          })()
        ) : (
          <div className="flex flex-col gap-2">
            {subActions.map((action) => (
              <ActionRow
                key={`${action.kind}-${action.id}`}
                action={action}
                isBusy={isBusy(action.kind, action.id)}
                onComplete={() => triggerComplete(action)}
                onUncomplete={() => triggerUncomplete(action)}
                error={actionErrorFor(action.kind, action.id)}
              />
            ))}
          </div>
        )}
      </>
    );
  }

  function renderResolution(notification: Notification) {
    if (notification.dismissed) {
      return (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="min-w-0 text-xs text-muted-foreground">
            Not relevant
            {notification.dismissNote && `: ${notification.dismissNote}`}
            {notification.resolvedBy && ` — ${notification.resolvedBy.name}`}
            {notification.resolvedAt && `, ${new Date(notification.resolvedAt).toLocaleString()}`}
          </p>
          {isAdmin && (
            <Button
              variant="outline"
              size="sm"
              disabled={reopen.isPending && reopen.variables === notification.id}
              onClick={() => reopen.mutate(notification.id)}
            >
              Reopen
            </Button>
          )}
          {reopen.isError && reopen.variables === notification.id && (
            <div className="w-full">
              <ErrorAlert error={reopen.error} />
            </div>
          )}
        </div>
      );
    }
    if (notification.resolvedAt) {
      return (
        <p className="text-xs text-muted-foreground">
          Resolved {new Date(notification.resolvedAt).toLocaleString()}
          {notification.resolvedBy && ` by ${notification.resolvedBy.name}`}
        </p>
      );
    }
    return (
      <div className="flex flex-wrap items-center gap-2">
        {notification.type === NotificationType.Manual && isAdmin && (
          <Button
            variant="outline"
            size="sm"
            disabled={resolveManual.isPending}
            onClick={() => resolveManual.mutate(notification.id)}
          >
            Mark resolved
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="-ml-3 text-muted-foreground"
          onClick={() => {
            dismiss.reset();
            setDismissNote("");
            setDismissing({ id: notification.id, headline: notificationHeadline(notification) });
          }}
        >
          Not relevant
        </Button>
      </div>
    );
  }

  function renderCard(notification: Notification) {
    const status = statusBadge(notification);
    const typeLabel = NOTIFICATION_TYPE_LABELS[notification.type];
    const headline = notificationHeadline(notification);
    return (
      <Card className="flex-row items-start gap-3 px-3 sm:gap-4 sm:px-5">
        {kennelNumberOf(notification) === null ? (
          // Not about a kennel (e.g. a general post): a plain notification mark
          // instead of an empty kennel tile.
          <div className="grid h-14 w-13 shrink-0 place-content-center rounded-lg bg-secondary text-navy">
            <Megaphone className="size-6" aria-hidden="true" />
          </div>
        ) : (
          <KennelTile number={kennelNumberOf(notification)} attention={isOverdue(notification)} />
        )}
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1 text-sm font-bold text-blue">
                {kindOf(notification) === "medical" && (
                  <Pill className="size-4" aria-hidden="true" />
                )}
                {typeLabel}
              </p>
              <Badge variant={status.variant} className="shrink-0">
                {status.label}
              </Badge>
            </div>
            {headline !== typeLabel && (
              <h2 className="mt-0.5 flex items-center gap-2 text-lg leading-snug font-semibold">
                <CollarDot color={notification.cat?.collarColor} />
                {notification.cat && notification.type !== NotificationType.Manual ? (
                  <button
                    type="button"
                    className="min-w-0 cursor-pointer text-left break-words hover:underline"
                    title={`Show only ${notification.cat.name}`}
                    onClick={() =>
                      setCatFilter({ id: notification.cat!.id, name: notification.cat!.name })
                    }
                  >
                    {headline}
                  </button>
                ) : (
                  <span className="min-w-0 break-words">{headline}</span>
                )}
              </h2>
            )}
            <p className="text-xs text-muted-foreground">
              Posted {new Date(notification.createdAt).toLocaleString()}
              {notification.createdBy && ` by ${notification.createdBy.name}`}
            </p>
          </div>
          <div className="space-y-2 text-sm">{renderActions(notification)}</div>
          {renderResolution(notification)}
          <div className="flex items-start justify-between gap-2 border-t pt-2">
            <div className="min-w-0 flex-1">{renderComment(notification)}</div>
            {isAdmin && <div className="-mr-2 shrink-0">{renderAdminActions(notification)}</div>}
          </div>
        </div>
      </Card>
    );
  }

  function renderComment(notification: Notification) {
    const isCommenting = commentEditingId === notification.id;
    return (
      <>
        {isCommenting ? (
          <div className="space-y-1">
            <Textarea
              className="min-h-16 px-2 py-1"
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
            />
            <div className="flex gap-1">
              <Button
                size="sm"
                disabled={saveComment.isPending}
                onClick={() =>
                  saveComment.mutate({
                    id: notification.id,
                    comment: commentDraft,
                  })
                }
              >
                Save
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCommentEditingId(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-1 text-sm">
            {notification.comment && (
              <p>
                {notification.comment}
                {notification.commentedBy && (
                  <span className="text-muted-foreground">
                    {" "}
                    — {notification.commentedBy.name}
                    {notification.commentedAt
                      ? `, ${new Date(notification.commentedAt).toLocaleString()}`
                      : ""}
                  </span>
                )}
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3"
              onClick={() => {
                setCommentEditingId(notification.id);
                setCommentDraft(notification.comment ?? "");
              }}
            >
              {notification.comment ? "Edit comment" : "Add comment"}
            </Button>
          </div>
        )}
      </>
    );
  }

  function renderAdminActions(notification: Notification) {
    return (
      <>
        {notification.type === NotificationType.Manual && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Edit announcement"
              onClick={() =>
                setDialog({
                  mode: "edit",
                  notification: {
                    id: notification.id,
                    title: notification.title,
                    message: notification.message,
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
                setDeletingNotification({
                  id: notification.id,
                  title: notification.title,
                })
              }
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </>
    );
  }

  const close = () => setDialog(null);

  return (
    <AppLayout width="3xl">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-3xl font-bold">Notifications</h1>
        {isAdmin && (
          <Button onClick={() => setDialog({ mode: "create" })}>
            <Plus className="mr-1 h-4 w-4" />
            New Announcement
          </Button>
        )}
      </div>

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:gap-4">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="dateFrom">From</Label>
            <Input
              id="dateFrom"
              type="date"
              className="w-full sm:w-auto"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="dateTo">To</Label>
            <Input
              id="dateTo"
              type="date"
              className="w-full sm:w-auto"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>
        <div className="grid w-full grid-cols-2 gap-3 sm:flex sm:w-auto sm:gap-4">
          <div className="min-w-0 space-y-1">
            <Label htmlFor="statusFilter">Status</Label>
            <NativeSelect
              id="statusFilter"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            >
              {STATUS_FILTERS.map(([value, label]) => (
                <NativeSelectOption key={value} value={value}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <div className="min-w-0 space-y-1">
            <Label htmlFor="catFilter">Cat</Label>
            <NativeSelect
              id="catFilter"
              value={catFilter?.id ?? ""}
              onChange={(e) => {
                const id = Number(e.target.value);
                const cat = catOptions.find((option) => option.id === id);
                setCatFilter(cat ?? null);
              }}
            >
              <NativeSelectOption value="">All cats</NativeSelectOption>
              {catOptions.map((cat) => (
                <NativeSelectOption key={cat.id} value={cat.id}>
                  {cat.name}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        </div>
        <ToggleGroup
          type="single"
          variant="outline"
          aria-label="Kind"
          className="w-full flex-wrap sm:w-auto"
          value={kindFilter}
          // Re-clicking the selected chip yields "": go back to All.
          onValueChange={(next) => setKindFilter(next === "" ? "all" : (next as KindFilter))}
        >
          {KIND_FILTERS.map(([value, label]) => (
            <ToggleGroupItem
              key={value}
              value={value}
              className="h-9 rounded-full bg-white px-3 text-foreground data-[state=on]:border-navy data-[state=on]:bg-navy data-[state=on]:text-white data-[state=on]:hover:bg-navy data-[state=on]:hover:text-white"
            >
              {value === "medical" && <Pill className="size-4" aria-hidden="true" />}
              {label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className="flex w-full items-end gap-2 sm:ml-auto sm:w-auto">
          <div className="flex-1 space-y-1">
            <Label htmlFor="sortBy">Sort by</Label>
            <NativeSelect
              id="sortBy"
              value={sort.column}
              onChange={(e) =>
                setSort((prev) => ({ ...prev, column: e.target.value as SortColumn }))
              }
            >
              {SORT_COLUMNS.map(([column, label]) => (
                <NativeSelectOption key={column} value={column}>
                  {label}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <Button
            variant="outline"
            onClick={() =>
              setSort((prev) => ({
                ...prev,
                direction: prev.direction === "asc" ? "desc" : "asc",
              }))
            }
          >
            {sort.direction === "asc" ? "Ascending" : "Descending"}
          </Button>
        </div>
      </div>

      {(catFilter || filtersActive) && (
        <div className="-mt-3 mb-4 flex flex-wrap items-center gap-2">
          {catFilter && (
            <Badge variant="secondary" className="h-8 gap-1 pr-1 pl-3 text-sm">
              Cat: {catFilter.name}
              <button
                type="button"
                aria-label={`Clear cat filter ${catFilter.name}`}
                className="grid size-6 cursor-pointer place-content-center rounded-full hover:bg-black/10"
                onClick={() => setCatFilter(null)}
              >
                <X className="size-3.5" />
              </button>
            </Badge>
          )}
          {filtersActive && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>
      )}

      {error ? (
        <ErrorAlert message="Failed to fetch notifications" />
      ) : isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full rounded-xl" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <Card className="items-center px-4 py-10 text-center">
          <p className="font-display text-lg font-semibold text-navy">Nothing to do here</p>
          <p className="text-sm text-muted-foreground">
            {filtersActive
              ? "No notifications match these filters in these dates."
              : "No open notifications in these dates. Widen the dates or change Status to see older or finished ones."}
          </p>
          {filtersActive && (
            <Button variant="outline" size="sm" className="mt-2" onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </Card>
      ) : (
        <ul className="space-y-3">
          {sorted.map((notification) => (
            <li key={notification.id}>{renderCard(notification)}</li>
          ))}
        </ul>
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
          <NotificationForm
            key={dialog?.mode === "edit" ? dialog.notification.id : "create"}
            notification={dialog?.mode === "edit" ? dialog.notification : undefined}
            onSuccess={close}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={dismissing !== null}
        onOpenChange={(open) => {
          if (!open) setDismissing(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark as not relevant</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (dismissing) dismiss.mutate({ id: dismissing.id, note: dismissNote });
            }}
          >
            <p className="text-sm text-muted-foreground">
              &ldquo;{dismissing?.headline}&rdquo; will be closed without being done. Any open sign
              or move task on it is cancelled.
            </p>
            <div className="space-y-2">
              <Label htmlFor="dismissNote">Note (optional)</Label>
              <Textarea
                id="dismissNote"
                placeholder="Why it no longer applies"
                value={dismissNote}
                onChange={(e) => setDismissNote(e.target.value)}
              />
            </div>
            {dismiss.error && <ErrorAlert error={dismiss.error} />}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setDismissing(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={dismiss.isPending}>
                {dismiss.isPending ? "Saving..." : "Mark not relevant"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={deletingNotification !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingNotification(null);
            deleteManual.reset();
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Announcement</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &ldquo;
              {deletingNotification?.title ?? "this announcement"}
              &rdquo;? This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteManual.isError && <ErrorAlert message="Failed to delete announcement" />}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingNotification && deleteManual.mutate(deletingNotification.id)}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
