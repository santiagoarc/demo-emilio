"use client";

import type { CareTask, TaskStatus } from "@/domain/types";
import { TASK_STATUS_LABEL } from "@/logic/labels";
import { useDemo } from "@/state/DemoProvider";
import { cx } from "@/components/ui/primitives";

const TONE: Record<TaskStatus, string> = {
  pending: "border-warn/40 text-warn",
  in_progress: "border-accent-2/40 text-accent-2",
  done: "border-ok/40 text-ok",
  cancelled: "border-line-strong text-faint",
};

export function TaskStatusControl({ task, className }: { task: CareTask; className?: string }) {
  const { setTaskStatus } = useDemo();
  return (
    <select
      value={task.status}
      onChange={(e) => setTaskStatus(task.id, e.target.value as TaskStatus)}
      onClick={(e) => e.stopPropagation()}
      aria-label={`Estado de ${task.id}`}
      className={cx("h-7 rounded-lg border bg-panel-solid px-2 text-[11px] font-medium outline-none", TONE[task.status], className)}
    >
      {(Object.keys(TASK_STATUS_LABEL) as TaskStatus[]).map((s) => (
        <option key={s} value={s} className="text-ink">
          {TASK_STATUS_LABEL[s]}
        </option>
      ))}
    </select>
  );
}
