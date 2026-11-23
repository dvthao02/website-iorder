import assert from "node:assert/strict";
import test from "node:test";

import { assertDatabaseName, DatabaseSwapError, retryAsync, swapDatabases } from "./database-swap";

const names = { live: "iorder_v2", staging: "iorder_restore_check_abc", previous: "iorder_before_restore_20261122t100000z" };
const noSleep = async () => undefined;

function recorder(failWhen: (sql: string, call: number) => Error | null = () => null) {
  const statements: string[] = [];
  return {
    statements,
    run: async (sql: string) => {
      const failure = failWhen(sql, statements.length);
      statements.push(sql);
      if (failure) throw failure;
    },
  };
}

test("Đổi database: chặn kết nối, ngắt phiên, đưa bản cũ sang một bên rồi bản mới vào chỗ", async () => {
  const { run, statements } = recorder();
  await swapDatabases({ run, ...names, sleep: noSleep });
  assert.deepEqual(statements, [
    'ALTER DATABASE "iorder_v2" WITH ALLOW_CONNECTIONS false',
    "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $$iorder_v2$$ AND pid <> pg_backend_pid()",
    'ALTER DATABASE "iorder_v2" RENAME TO "iorder_before_restore_20261122t100000z"',
    'ALTER DATABASE "iorder_restore_check_abc" RENAME TO "iorder_v2"',
  ]);
});

test("Còn phiên chưa kịp thoát thì ngắt lại rồi đổi tên lại, không bỏ cuộc ngay", async () => {
  let renameFailures = 2;
  const { run, statements } = recorder((sql) => sql.includes('RENAME TO "iorder_before') && renameFailures-- > 0 ? new Error("database is being accessed by other users") : null);
  await swapDatabases({ run, ...names, sleep: noSleep });
  assert.equal(statements.filter(sql => sql.startsWith("SELECT pg_terminate_backend")).length, 3);
  assert.equal(statements.at(-1), 'ALTER DATABASE "iorder_restore_check_abc" RENAME TO "iorder_v2"');
});

test("Lỗi trước khi đổi tên: mở lại kết nối cho database cũ và báo đã giữ nguyên", async () => {
  const { run, statements } = recorder((sql) => sql.startsWith("SELECT pg_terminate_backend") ? new Error("không ngắt được phiên") : null);
  await assert.rejects(swapDatabases({ run, ...names, attempts: 2, sleep: noSleep }), (error: unknown) => {
    assert.ok(error instanceof DatabaseSwapError);
    assert.equal(error.rolledBack, true);
    assert.match(error.message, /không ngắt được phiên.*như trước khi bấm/);
    return true;
  });
  assert.equal(statements.at(-1), 'ALTER DATABASE "iorder_v2" WITH ALLOW_CONNECTIONS true');
  assert.equal(statements.some(sql => sql.includes("RENAME")), false);
});

test("Lỗi khi đưa bản mới vào chỗ: đổi tên bản cũ trở lại rồi mở kết nối", async () => {
  const { run, statements } = recorder((sql) => sql.startsWith('ALTER DATABASE "iorder_restore_check_abc" RENAME') ? new Error("không đổi được") : null);
  await assert.rejects(swapDatabases({ run, ...names, sleep: noSleep }), (error: unknown) => error instanceof DatabaseSwapError && error.rolledBack);
  assert.deepEqual(statements.slice(-2), [
    'ALTER DATABASE "iorder_before_restore_20261122t100000z" RENAME TO "iorder_v2"',
    'ALTER DATABASE "iorder_v2" WITH ALLOW_CONNECTIONS true',
  ]);
});

test("Đưa về như cũ cũng lỗi: báo rõ database nào còn dữ liệu cũ để người quản trị xử lý", async () => {
  // Bản cũ đã sang một bên, bản mới không vào được và đổi tên lại cũng hỏng.
  const stuckAside = recorder((sql) => sql.includes('RENAME TO "iorder_v2"') ? new Error("sập") : null);
  await assert.rejects(swapDatabases({ run: stuckAside.run, ...names, attempts: 1, sleep: noSleep }), (error: unknown) => {
    assert.ok(error instanceof DatabaseSwapError);
    assert.equal(error.rolledBack, false);
    assert.match(error.message, /nằm ở database "iorder_before_restore_20261122t100000z"/);
    return true;
  });
  // Chưa đổi tên gì mà cũng không mở lại được kết nối: dữ liệu cũ vẫn ở tên cũ.
  const blocked = recorder((sql) => sql.includes("ALLOW_CONNECTIONS") ? new Error("mất kết nối") : null);
  await assert.rejects(swapDatabases({ run: blocked.run, ...names, attempts: 1, sleep: noSleep }), (error: unknown) => {
    assert.ok(error instanceof DatabaseSwapError);
    assert.equal(error.rolledBack, false);
    assert.match(error.message, /nằm ở database "iorder_v2"/);
    return true;
  });
});

test("Tên database có ký tự lạ bị từ chối trước mọi câu SQL", async () => {
  for (const name of ["", "a b", "a'b", 'a"b', "a;drop", "a$$b", "x".repeat(64)]) assert.throws(() => assertDatabaseName(name), /chỉ được gồm/, name);
  assert.equal(assertDatabaseName("iorder-v2_Test"), "iorder-v2_Test");
  const { run, statements } = recorder();
  await assert.rejects(swapDatabases({ run, ...names, previous: "x'; drop database iorder_v2; --" }), /chỉ được gồm/);
  assert.deepEqual(statements, []);
});

test("retryAsync thử đủ số lần rồi ném lỗi cuối", async () => {
  let calls = 0;
  await assert.rejects(retryAsync(async () => { calls++; throw new Error(`lần ${calls}`); }, 3, 1, noSleep), /lần 3/);
  assert.equal(calls, 3);
  assert.equal(await retryAsync(async () => "ok", 3, 1, noSleep), "ok");
});
