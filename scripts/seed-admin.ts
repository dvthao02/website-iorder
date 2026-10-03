import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { roles, userRoles, users } from "../packages/core/src/db/schema";
import { hashPassword } from "../packages/core/src/server/auth/password";

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Cần đặt ${name} trước khi khởi tạo tài khoản quản trị.`);
  }

  return value;
}

async function seedInitialAdministrator() {
  const username = requiredEnvironmentValue("INITIAL_ADMIN_USERNAME");
  const password = requiredEnvironmentValue("INITIAL_ADMIN_PASSWORD");
  const fullName = process.env.INITIAL_ADMIN_NAME?.trim() || "Administrator";
  const db = getDb();

  const created = await db.transaction(async (tx) => {
    await tx
      .insert(roles)
      .values({ code: "admin", name: "Administrator" })
      .onConflictDoNothing({ target: roles.code });
    await tx
      .insert(roles)
      .values({ code: "editor", name: "Biên tập viên" })
      .onConflictDoNothing({ target: roles.code });

    const [adminRole] = await tx.select({ id: roles.id }).from(roles).where(eq(roles.code, "admin")).limit(1);

    if (!adminRole) {
      throw new Error("Không thể tạo vai trò quản trị.");
    }

    const [existingUser] = await tx
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, username))
      .limit(1);

    const user = existingUser
      ? existingUser
      : (
          await tx
            .insert(users)
            .values({
              username,
              passwordHash: await hashPassword(password),
              fullName,
            })
            .returning({ id: users.id })
        )[0];

    if (!user) {
      throw new Error("Không thể tạo tài khoản quản trị ban đầu.");
    }

    await tx
      .insert(userRoles)
      .values({ userId: user.id, roleId: adminRole.id })
      .onConflictDoNothing();

    return !existingUser;
  });

  console.log(created ? "Đã tạo tài khoản quản trị ban đầu." : "Tài khoản quản trị đã tồn tại; vai trò admin đã được xác nhận.");
}

seedInitialAdministrator().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Lỗi không xác định";
  console.error(`Khởi tạo admin thất bại: ${message}`);
  process.exitCode = 1;
});
