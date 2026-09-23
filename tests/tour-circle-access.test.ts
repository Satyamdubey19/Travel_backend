import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasActiveCircleMembership } from "@/modules/tour/services/tour-circle-access.service";

describe("Trip Circle membership", () => {
  it("requires both active participation and a confirmed booking", () => {
    assert.equal(hasActiveCircleMembership({ status: "JOINED", Booking: { status: "CONFIRMED" } }), true);
    assert.equal(hasActiveCircleMembership({ status: "JOINED", Booking: { status: "PENDING" } }), false);
    assert.equal(hasActiveCircleMembership({ status: "APPROVED", Booking: { status: "CONFIRMED" } }), false);
  });

  it("revokes access when cancellation changes either record", () => {
    assert.equal(hasActiveCircleMembership({ status: "CANCELLED", Booking: { status: "CONFIRMED" } }), false);
    assert.equal(hasActiveCircleMembership({ status: "JOINED", Booking: { status: "CANCELLED" } }), false);
    assert.equal(hasActiveCircleMembership(null), false);
  });

  it("allows completed members to read the archived circle", () => {
    assert.equal(hasActiveCircleMembership({ status: "COMPLETED", Booking: { status: "COMPLETED" } }), true);
  });
});
