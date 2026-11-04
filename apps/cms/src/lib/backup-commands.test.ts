import assert from "node:assert/strict";
import test from "node:test";

import { vpsRestoreSteps, vpsScheduleSteps } from "./backup-commands";

test("Phục hồi trên VPS: kiểm tra checksum, dừng app trước khi xóa database, nạp đúng tệp dump", () => {
  const steps = vpsRestoreSteps({ location: "/var/backups/iorder", repoDir: "/srv/iorder", stamp: "20261104T023000Z", database: "iorder_v2" });
  const commands = steps.map((step) => step.command);
  assert.equal(commands[1], '(cd "/var/backups/iorder/db/20261104T023000Z" && sha256sum -c SHA256SUMS)');
  assert.ok(commands.findIndex((command) => command.includes("stop backend cms publish-web")) < commands.findIndex((command) => command.includes("dropdb")));
  assert.match(commands.join("\n"), /< "\/var\/backups\/iorder\/db\/20261104T023000Z\/iorder_v2\.dump"$/m);
});

test("Lên lịch VPS dùng đúng thư mục repo; chưa biết thì để chỗ trống dễ thấy", () => {
  assert.match(vpsScheduleSteps("/srv/iorder")[1]!.command, /^30 2 \* \* \* cd "\/srv\/iorder" && scripts\/backup\.sh/);
  assert.match(vpsScheduleSteps(null)[0]!.command, /\/srv\/iorder/);
});
