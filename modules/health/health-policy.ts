export type DependencyState = "ok" | "unavailable" | "not_configured"

export function readinessOutcome(
  database: DependencyState,
  redis: DependencyState,
  redisRequired: boolean,
  authSchema: DependencyState = "ok",
  authEmailConfiguration: DependencyState = "ok",
) {
  const ready = database === "ok" && authSchema === "ok" && authEmailConfiguration === "ok" && (!redisRequired || redis === "ok")
  return { ready, status: ready ? "ready" as const : "not_ready" as const }
}
