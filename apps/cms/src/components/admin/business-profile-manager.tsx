"use client";

import type { ProfileInput } from "@iorder/core/server/settings/profile.contract";

import { ProfileEditor } from "./profile-editor";

type BusinessProfileManagerProps = {
  profile: ProfileInput | null;
  version: number;
};

export function BusinessProfileManager({ profile, version }: BusinessProfileManagerProps) {
  return <main className="admin-settings-page">
    <h1 className="sr-only">Thông tin doanh nghiệp</h1>
    <p className="admin-help">Cập nhật tên thương hiệu, thông tin liên hệ và hình ảnh dùng trên website.</p>

    <section className="admin-settings-page__section" aria-labelledby="business-profile-title">
      <header>
        <div>
          <h2 id="business-profile-title">Thông tin hiển thị</h2>
          <p>Nội dung này xuất hiện ở Header, Footer và các trang liên hệ.</p>
        </div>
      </header>
      <ProfileEditor initial={profile} initialVersion={version} />
    </section>
  </main>;
}
