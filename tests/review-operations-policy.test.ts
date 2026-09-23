import assert from "node:assert/strict";
import test from "node:test";
import {
  hostReviewResponseSchema,
  reviewModerationSchema,
} from "@/modules/review/services/review-operations.service";

test("host review responses are meaningful and bounded", () => {
  assert.throws(() => hostReviewResponseSchema.parse({ response: "Thanks" }));
  assert.equal(
    hostReviewResponseSchema.parse({
      response: "Thank you. We have improved the pickup briefing.",
    }).response,
    "Thank you. We have improved the pickup briefing.",
  );
});

test("review visibility changes require an auditable reason", () => {
  assert.throws(() =>
    reviewModerationSchema.parse({ isPublished: false, reason: "spam" }),
  );
  assert.equal(
    reviewModerationSchema.parse({
      isPublished: false,
      reason: "Contains a private phone number and must be redacted.",
    }).isPublished,
    false,
  );
  assert.throws(() =>
    reviewModerationSchema.parse({
      isPublished: true,
      reason: "Restored after review",
      unexpected: true,
    }),
  );
});
