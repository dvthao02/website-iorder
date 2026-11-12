import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";
import { revisionTargetSchema } from "./revisions.contract";
import { restoreRevision } from "./revisions.service";

test("service từ chối version thiếu/sai ở mọi target trước truy vấn DB", async () => {
  const id = "12345678-1234-4123-8123-123456789012";
  for (const target of revisionTargetSchema.options) {
    for (const version of [undefined, null, "1", -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      await assert.rejects(restoreRevision(target, id, id, id, version as number), z.ZodError);
    }
  }
});
