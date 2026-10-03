import "dotenv/config";

import { eq } from "drizzle-orm";

import { getDb } from "../packages/core/src/db/client";
import { users } from "../packages/core/src/db/schema";
import { getSiteProfile, updateSiteProfile } from "../packages/core/src/server/settings/profile.service";

const v1Profile = {
  companyName: "iOrder",
  hotline: "028 710 73 999",
  supportEmail: "support@iorder.vn",
  salesEmail: "contact@iorder.vn",
  address: "756A Đ. Âu Cơ, P.14, Q. Tân Bình, TP.HCM",
  workingHours: "Thứ 2 - Thứ 7: 08:00 - 18:00",
};

async function run() {
  const profile = await getSiteProfile();
  const next = {
    companyName: profile?.companyName ?? v1Profile.companyName,
    legalName: profile?.legalName ?? null,
    hotline: profile?.hotline ?? v1Profile.hotline,
    supportEmail: profile?.supportEmail ?? v1Profile.supportEmail,
    salesEmail: profile?.salesEmail ?? v1Profile.salesEmail,
    address: profile?.address ?? v1Profile.address,
    workingHours: profile?.workingHours ?? v1Profile.workingHours,
    logoMediaId: profile?.logoMediaId ?? null,
  };
  const needsSeed = !profile || Object.entries(v1Profile).some(([key, value]) => profile[key as keyof typeof v1Profile] === null && value !== null);
  if (!needsSeed) {
    console.log("Hồ sơ doanh nghiệp đã đủ dữ liệu V1; giữ nguyên dữ liệu CMS.");
    return;
  }

  const [user] = await getDb().select({ id: users.id }).from(users).where(eq(users.username, process.env.INITIAL_ADMIN_USERNAME ?? "")).limit(1);
  if (!user) throw new Error("Chưa có tài khoản quản trị để khởi tạo hồ sơ doanh nghiệp.");
  await updateSiteProfile(next, user.id);
  console.log(profile ? "Đã bổ sung thông tin liên hệ V1 còn thiếu vào CMS." : "Đã khởi tạo hồ sơ doanh nghiệp từ dữ liệu V1.");
}

run().then(() => process.exit(0)).catch((error) => {
  console.error(error instanceof Error ? error.message : "Không thể khởi tạo hồ sơ doanh nghiệp.");
  process.exit(1);
});
