import { config } from "dotenv";
import postgres from "postgres";

config({ quiet: true });

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url || !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname)) {
    throw new Error("Chỉ kiểm kê audit log trên PostgreSQL local.");
  }
  const client = postgres(url, { max: 1, prepare: false, onnotice: () => undefined });
  try {
    await client.begin("read only", async (tx) => {
      await tx`set local statement_timeout = '8000'`;
      const [counts] = await tx`
        select count(*)::int as total,
          count(*) filter (where before_data ? 'passwordHash')::int as before_hash,
          count(*) filter (where after_data ? 'passwordHash')::int as after_hash,
          count(*) filter (where before_data ? 'password')::int as before_password,
          count(*) filter (where after_data ? 'password')::int as after_password
        from public.audit_logs where entity_type = 'user'`;
      console.log("Kiểm kê log tài khoản local (chỉ đếm sự hiện diện khóa, không đọc giá trị):", JSON.stringify(counts));
    });
  } finally {
    await client.end({ timeout: 10 });
  }
}

void main().catch(() => {
  console.error("Không hoàn tất kiểm kê log tài khoản local. Không có dữ liệu lịch sử nào bị thay đổi.");
  process.exitCode = 1;
});
