type ErrorWithStatus = {
  code?: unknown;
  name?: unknown;
  message?: unknown;
  statusCode?: unknown;
};

const infrastructurePattern = /prisma|database|connection|timeout|turbo/i;

export function authErrorResponse(
  error: unknown,
  fallbackStatus = 400,
  unavailableMessage = "Unable to complete this request right now.",
) {
  const candidate = typeof error === "object" && error !== null
    ? error as ErrorWithStatus
    : undefined;
  const code = typeof candidate?.code === "string" ? candidate.code : "";
  const name = typeof candidate?.name === "string" ? candidate.name : "";
  const message = error instanceof Error
    ? error.message
    : "Unable to complete this request.";
  const infrastructureFailure = /^P\d{4}$/.test(code) || infrastructurePattern.test(`${name} ${message}`);
  const requestedStatus = Number(candidate?.statusCode);

  return {
    message: infrastructureFailure ? unavailableMessage : message,
    status: infrastructureFailure
      ? 503
      : (Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus < 600
        ? requestedStatus
        : fallbackStatus),
  };
}
