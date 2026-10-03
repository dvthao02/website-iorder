"use client";

import type { ProfileInput } from "@iorder/core/server/settings/profile.contract";

import { ProfileEditor } from "./profile-editor";

type BusinessProfileManagerProps = {
  profile: ProfileInput | null;
};

export function BusinessProfileManager({ profile }: BusinessProfileManagerProps) {
  return <main className="admin-settings-page">
    <header className="admin-settings-page__header">
      <p>Doanh nghiệp</p>
      <h1>Thông tin doanh nghiệp</h1>
      <span>Cập nhật tên thương hiệu, thông tin liên hệ và hình ảnh dùng trên website.</span>
    </header>

    <section className="admin-settings-page__section" aria-labelledby="business-profile-title">
      <header>
        <div>
          <h2 id="business-profile-title">Thông tin hiển thị</h2>
          <p>Nội dung này xuất hiện ở Header, Footer và các trang liên hệ.</p>
        </div>
      </header>
      <ProfileEditor initial={profile} />
    </section>
  </main>;
}
