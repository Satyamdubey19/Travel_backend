import assert from "node:assert/strict"
import test from "node:test"
import { ageOnDate, assertTourSafetyReady, assertTravelersMeetMinimumAge } from "../modules/tour/services/tour-listing-policy"

const safeBase = {
  riskLevel: "LOW",
  riskDisclosure: "Walking on uneven public paths may cause slips or fatigue; travelers should follow the group leader.",
  meetingPoint: "Main entrance of the district visitor centre",
  eligibilityRequirements: ["Able to walk for 30 minutes with rest breaks"],
  requiredEquipment: [],
  emergencyPlan: null,
  minimumAge: 12,
  requiresCaretaker: false,
  verifiedTravelersOnly: false,
  joinApprovalRequired: false,
}

test("low-risk tours require honest disclosure, meeting guidance and eligibility", () => {
  assert.doesNotThrow(() => assertTourSafetyReady(safeBase))
  assert.throws(() => assertTourSafetyReady({ ...safeBase, riskDisclosure: "Safe trip" }), /Risk disclosure/)
  assert.throws(() => assertTourSafetyReady({ ...safeBase, eligibilityRequirements: [] }), /eligibility/)
})

test("high-risk tours require adults, equipment, approval and verified travelers", () => {
  const high = {
    ...safeBase,
    riskLevel: "HIGH",
    emergencyPlan: "The leader stops the activity, accounts for every traveler, contacts local response support, records the issue, and follows the documented evacuation route.",
    requiredEquipment: ["Certified helmet"],
    minimumAge: 18,
    verifiedTravelersOnly: true,
    joinApprovalRequired: true,
  }
  assert.doesNotThrow(() => assertTourSafetyReady(high))
  assert.throws(() => assertTourSafetyReady({ ...high, requiredEquipment: [] }), /equipment/)
  assert.throws(() => assertTourSafetyReady({ ...high, verifiedTravelersOnly: false }), /verified travelers/)
})

test("very-high-risk supply remains blocked from approval until caretaker controls exist", () => {
  const veryHigh = {
    ...safeBase,
    riskLevel: "VERY_HIGH",
    emergencyPlan: "The leader stops the activity, accounts for every traveler, contacts local response support, records the issue, and follows the documented evacuation route.",
    requiredEquipment: ["Certified specialist equipment"],
    minimumAge: 18,
    verifiedTravelersOnly: true,
    joinApprovalRequired: true,
    requiresCaretaker: true,
  }
  assert.doesNotThrow(() => assertTourSafetyReady(veryHigh))
  assert.throws(() => assertTourSafetyReady(veryHigh, { forApproval: true }), /cannot be published/)
})

test("minimum age is evaluated on departure using date of birth when present", () => {
  const departure = new Date("2027-01-15T00:00:00.000Z")
  assert.equal(ageOnDate({ dob: "2009-01-15" }, departure), 18)
  assert.equal(ageOnDate({ dob: "2009-01-16" }, departure), 17)
  assert.doesNotThrow(() => assertTravelersMeetMinimumAge([{ dob: "2000-06-01" }, { age: 22 }], 18, departure))
  assert.throws(() => assertTravelersMeetMinimumAge([{ dob: "2009-01-16" }], 18, departure), /at least 18/)
})
