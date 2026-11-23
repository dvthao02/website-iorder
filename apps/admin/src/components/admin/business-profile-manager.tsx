"use client";

import { SettingsDetailPage } from "@/components/admin/settings-detail-page";
import type { ProfileInput } from "@iorder/shared/server/settings/profile.contract";

import { ProfileEditor } from "./profile-editor";

type BusinessProfileManagerProps = {
  profile: ProfileInput | null;
  version: number;
};

export function BusinessProfileManager({ profile, version }: BusinessProfileManagerProps) {
  return <SettingsDetailPage bare description="Cập nhật tên thương hiệu, thông tin liên hệ và hình ảnh dùng trên website. Nội dung này xuất hiện ở đầu trang, chân trang và các trang liên hệ." title="Thông tin doanh nghiệp">
    <section className="admin-settings-page__section" aria-labelledby="business-profile-title">
      <header>
        <div>
          <h2 id="business-profile-title">Thông tin hiển thị</h2>
        </div>
      </header>
      <ProfileEditor initial={profile} initialVersion={version} />
    </section>
  </SettingsDetailPage>;
}
