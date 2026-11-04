import assert from "node:assert/strict";
import test from "node:test";

import { restoreSteps, scheduleSteps } from "./backup-commands";

test("Phục hồi trên Windows: đường dẫn có dấu cách nằm trong nháy kép, lệnh sh không chứa nháy kép", () => {
  const steps = restoreSteps({ source: "windows", location: "D:\\Sao luu\\iorder", repoDir: "D:\\work\\webiorderv2", stamp: "20261104T043134Z", database: "iorder_v2" });
  const commands = steps.map((step) => step.command).join("\n");
  assert.match(commands, /cd "D:\\work\\webiorderv2"/);
  assert.match(commands, /docker compose cp "D:\\Sao luu\\iorder\\db\\20261104T043134Z\\iorder_v2\.dump" db:\/tmp\/restore\.dump/);
  assert.match(commands, /restore "D:\\Sao luu\\iorder\\media"/);
  // PowerShell 5.1 làm mất nháy kép bên trong đối số truyền cho docker.exe.
  const shell = steps.find((step) => step.command.includes("sh -c"))!.command.split("sh -c ")[1]!;
  assert.equal(shell.includes('"'), false);
  assert.ok(commands.indexOf("pnpm dev:stop") < commands.indexOf("dropdb"));
});

test("Phục hồi trên VPS: kiểm tra checksum, dừng app trước khi xóa database, nạp đúng tệp dump", () => {
  const steps = restoreSteps({ source: "vps", location: "/var/backups/iorder", repoDir: "/srv/iorder", stamp: "20261104T023000Z", database: "iorder_v2" });
  const commands = steps.map((step) => step.command);
  assert.equal(commands[1], '(cd "/var/backups/iorder/db/20261104T023000Z" && sha256sum -c SHA256SUMS)');
  assert.ok(commands.findIndex((command) => command.includes("stop backend cms publish-web")) < commands.findIndex((command) => command.includes("dropdb")));
  assert.match(commands.join("\n"), /< "\/var\/backups\/iorder\/db\/20261104T023000Z\/iorder_v2\.dump"$/m);
});

test("Lên lịch dùng đúng thư mục repo; chưa biết thì để chỗ trống dễ thấy", () => {
  assert.match(scheduleSteps("windows", "D:\\work\\webiorderv2")[1]!.command, /-File \\"D:\\work\\webiorderv2\\scripts\\backup\.ps1\\""$/);
  assert.match(scheduleSteps("vps", "/srv/iorder")[1]!.command, /^30 2 \* \* \* cd "\/srv\/iorder" && scripts\/backup\.sh/);
  assert.match(scheduleSteps("windows", null)[0]!.command, /duong-dan/);
});
