import type { IncidentStatus } from "@prisma/client";

const NEXT_STATUS: Partial<Record<IncidentStatus, IncidentStatus>> = {
  OPEN: "TRIAGED",
  TRIAGED: "IN_PROGRESS",
  IN_PROGRESS: "RESOLVED",
  RESOLVED: "CLOSED",
};

export function assertIncidentTransition(
  current: IncidentStatus,
  requested: IncidentStatus,
) {
  if (NEXT_STATUS[current] !== requested) {
    throw Object.assign(
      new Error(`Incident cannot move from ${current} to ${requested}`),
      { statusCode: 409 },
    );
  }
}

export function statusForIncidentAction(action: string): IncidentStatus | null {
  if (action === "TRIAGE") return "TRIAGED";
  if (action === "START_INVESTIGATION") return "IN_PROGRESS";
  if (action === "RESOLVE") return "RESOLVED";
  if (action === "CLOSE") return "CLOSED";
  return null;
}
