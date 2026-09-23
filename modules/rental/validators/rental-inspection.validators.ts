import { z } from "zod";

export const inspectionStageSchema = z.enum(["PICKUP", "RETURN"]);
const assetId = z
  .string()
  .trim()
  .min(3)
  .max(300)
  .regex(
    /^(?![./])(?!.*\.\.)[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_.-]+)*$/,
    "Invalid private evidence reference",
  );

export const inspectionDraftSchema = z
  .object({
    odometerKm: z.coerce
      .number()
      .int()
      .min(0)
      .max(10_000_000)
      .nullable()
      .optional(),
    fuelOrChargePercent: z.coerce
      .number()
      .int()
      .min(0)
      .max(100)
      .nullable()
      .optional(),
    conditionNotes: z.string().trim().max(2000).nullable().optional(),
    checklist: z
      .array(
        z
          .object({
            label: z.string().trim().min(2).max(120),
            completed: z.boolean(),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    damages: z
      .array(
        z
          .object({
            area: z.string().trim().min(2).max(100),
            severity: z.enum(["MINOR", "MODERATE", "MAJOR"]),
            description: z.string().trim().min(3).max(500),
          })
          .strict(),
      )
      .max(30)
      .default([]),
    evidenceAssetIds: z.array(assetId).max(12).default([]),
  })
  .strict();

export const inspectionResponseSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ACKNOWLEDGE") }).strict(),
  z
    .object({
      action: z.literal("DISPUTE"),
      reason: z.string().trim().min(10).max(1000),
    })
    .strict(),
]);

export function assertInspectionReady(
  input: z.infer<typeof inspectionDraftSchema>,
) {
  if (input.odometerKm == null)
    throw Object.assign(
      new Error("Odometer reading is required before submission"),
      { statusCode: 400 },
    );
  if (input.fuelOrChargePercent == null)
    throw Object.assign(
      new Error("Fuel or charge level is required before submission"),
      { statusCode: 400 },
    );
  if (!input.conditionNotes || input.conditionNotes.trim().length < 10)
    throw Object.assign(
      new Error("Condition notes must contain at least 10 characters"),
      { statusCode: 400 },
    );
  if (
    input.checklist.length === 0 ||
    input.checklist.some((item) => !item.completed)
  )
    throw Object.assign(
      new Error("Complete every handover checklist item before submission"),
      { statusCode: 400 },
    );
  if (input.evidenceAssetIds.length < 2)
    throw Object.assign(
      new Error("At least two private condition photos are required"),
      { statusCode: 400 },
    );
}
