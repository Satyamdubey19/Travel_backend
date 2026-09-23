import assert from "node:assert/strict";
import test from "node:test";
import {
  assertInspectionReady,
  inspectionDraftSchema,
  inspectionResponseSchema,
} from "@/modules/rental/validators/rental-inspection.validators";
import { resolveRentalDisputeSchema } from "@/modules/admin/services/rental-dispute.service";

const ready = {
  odometerKm: 24120,
  fuelOrChargePercent: 72,
  conditionNotes: "Vehicle clean with one existing mark on the left door.",
  checklist: [{ label: "Vehicle condition reviewed", completed: true }],
  damages: [
    {
      area: "Left door",
      severity: "MINOR" as const,
      description: "Existing two-centimetre paint mark",
    },
  ],
  evidenceAssetIds: [
    "travels-pro/private/front.webp",
    "travels-pro/private/odometer.webp",
  ],
};

test("rental custody submission requires a complete evidence snapshot", () => {
  const parsed = inspectionDraftSchema.parse(ready);
  assert.doesNotThrow(() => assertInspectionReady(parsed));
  assert.throws(
    () => assertInspectionReady({ ...parsed, evidenceAssetIds: ["one.webp"] }),
    /two private condition photos/,
  );
  assert.throws(
    () =>
      assertInspectionReady({
        ...parsed,
        checklist: [{ label: "Vehicle condition reviewed", completed: false }],
      }),
    /Complete every/,
  );
});

test("rental inspection readings and private asset references are bounded", () => {
  assert.throws(() =>
    inspectionDraftSchema.parse({ ...ready, fuelOrChargePercent: 101 }),
  );
  assert.throws(() =>
    inspectionDraftSchema.parse({
      ...ready,
      evidenceAssetIds: ["https://public.example/evidence.jpg", "ok.webp"],
    }),
  );
});

test("traveler disputes require a meaningful permanent reason", () => {
  assert.throws(() =>
    inspectionResponseSchema.parse({ action: "DISPUTE", reason: "scratch" }),
  );
  assert.equal(
    inspectionResponseSchema.parse({
      action: "DISPUTE",
      reason: "The rear bumper mark is not shown.",
    }).action,
    "DISPUTE",
  );
  assert.equal(
    inspectionResponseSchema.parse({ action: "ACKNOWLEDGE" }).action,
    "ACKNOWLEDGE",
  );
});

test("admin custody resolution requires a supported outcome and detailed notes", () => {
  assert.throws(() =>
    resolveRentalDisputeSchema.parse({
      resolution: "REFUND_NOW",
      notes: "A detailed but unsupported financial action.",
    }),
  );
  assert.throws(() =>
    resolveRentalDisputeSchema.parse({
      resolution: "NO_FINANCIAL_ACTION",
      notes: "Too short",
    }),
  );
  assert.equal(
    resolveRentalDisputeSchema.parse({
      resolution: "MUTUAL_SETTLEMENT",
      notes: "Both parties confirmed the documented settlement terms.",
    }).resolution,
    "MUTUAL_SETTLEMENT",
  );
});
