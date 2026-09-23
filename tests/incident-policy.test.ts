import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assertIncidentTransition, statusForIncidentAction } from "@/modules/incident/services/incident-policy";
import { adminIncidentActionSchema, createIncidentSchema } from "@/modules/incident/services/incident.service";

describe("incident policy", () => {
  it("allows only ordered status transitions", () => {
    assert.doesNotThrow(() => assertIncidentTransition("OPEN", "TRIAGED"));
    assert.throws(() => assertIncidentTransition("OPEN", "RESOLVED"), /cannot move/i);
    assert.throws(() => assertIncidentTransition("CLOSED", "TRIAGED"), /cannot move/i);
  });

  it("maps administrative actions to explicit states", () => {
    assert.equal(statusForIncidentAction("START_INVESTIGATION"), "IN_PROGRESS");
    assert.equal(statusForIncidentAction("ADD_NOTE"), null);
  });

  it("requires urgent reports to carry an urgent severity", () => {
    const result = createIncidentSchema.safeParse({
      bookingId: "8a2190cb-997b-4dc2-9278-20d01c5abc99",
      category: "SAFETY",
      severity: "MEDIUM",
      title: "Immediate safety concern",
      description: "There is an immediate concern requiring prompt private operations review.",
      immediateDanger: true,
    });
    assert.equal(result.success, false);
  });

  it("requires reasoned resolution notes", () => {
    assert.equal(adminIncidentActionSchema.safeParse({ action: "RESOLVE", notes: "Too short for closure." }).success, false);
  });
});
