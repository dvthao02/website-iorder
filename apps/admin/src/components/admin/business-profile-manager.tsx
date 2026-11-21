"use client";

import { AdminPage } from "@/components/admin/ui/admin-page";
import { AdminPageBarHelp } from "@/components/admin/ui/admin-page-bar";
import type { ProfileInput } from "@iorder/shared/server/settings/profile.contract";

import { ProfileEditor } from "./profile-editor";

type BusinessProfileManagerProps = {
  profile: ProfileInput | null;
  version: number;
};

export function BusinessProfileManager({ profile, version }: BusinessProfileManagerProps) {
  return <AdminPage>
    <h1 className="sr-only">Thông tin doanh nghiệp</h1>
    <AdminPageBarHelp>Cập nhật tên thương hiệu, thông tin liên hệ và hình ảnh dùng trên website. Nội dung này xuất hiện ở đầu trang, chân trang và các trang liên hệ.</AdminPageBarHelp>

    <section className="admin-settings-page__section" aria-labelledby="business-profile-title">
      <header>
        <div>
          <h2 id="business-profile-title">Thông tin hiển thị</h2>
        </div>
      </header>
      <ProfileEditor initial={profile} initialVersion={version} />
    </section>
  </AdminPage>;
}
