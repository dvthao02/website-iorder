import type { Metadata } from "next";

import { Snowflake } from "lucide-react";
import { cookies } from "next/headers";
import Image from "next/image";

import { SantaHat } from "@/components/admin/login/christmas-art";
import { ChristmasEffects } from "@/components/admin/login/christmas-effects";
import { ChristmasGreeting, ChristmasSanta, ChristmasScenery } from "@/components/admin/login/christmas-scenery";
import { ChristmasSnow } from "@/components/admin/login/christmas-snow";
import { ChristmasStage } from "@/components/admin/login/christmas-stage";
import { AdminToastProvider } from "@/components/admin/ui/admin-feedback";
import { colorThemeCookie } from "@/lib/cms-theme";
import { resolveLoginTheme } from "@/lib/login-theme";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Đăng nhập quản trị | iOrder",
  robots: { index: false, follow: false },
};

const thongBaoLoiDangNhap: Record<string, string> = {
  INVALID_CREDENTIALS: "Thông tin đăng nhập quản trị không chính xác.",
  INVALID_INPUT: "Vui lòng nhập tên đăng nhập và mật khẩu hợp lệ.",
  RATE_LIMITED: "Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.",
  INTERNAL_ERROR: "Hệ thống đang gặp sự cố. Vui lòng thử lại sau.",
};

// Giao diện đăng nhập theo bảng màu đã chọn ở "Giao diện CMS" (cookie): chọn "Giáng sinh" thì là cảnh Giáng sinh; chưa chọn gì thì tự bật trong
// mùa 15/11 – 10/01. Xem thử hoặc ép bằng ?theme=christmas|default hay biến CMS_LOGIN_THEME (thứ tự ưu tiên ở lib/login-theme.ts).
export default async function AdministratorLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; theme?: string | string[] }>;
}) {
  const { error, theme } = await searchParams;
  const cookieStore = await cookies();
  const loginTheme = resolveLoginTheme({ query: typeof theme === "string" ? theme : undefined, env: process.env.CMS_LOGIN_THEME, cookie: cookieStore.get(colorThemeCookie)?.value, now: new Date() });
  const form = <LoginForm initialError={error ? thongBaoLoiDangNhap[error] : undefined} theme={loginTheme} />;

  if (loginTheme === "christmas") {
    return (
      <ChristmasStage>
        <AdminToastProvider>
          <ChristmasScenery />
          <ChristmasSnow />
          <ChristmasSanta />
          <div aria-hidden="true" className="xmas__curtain" />
          <main className="xmas__center">
            <div className="xmas__stack">
              <div className="xmas__tilt">
                <section aria-labelledby="login-title" className="xmas__card">
                  <SantaHat className="xmas__hat" />
                  <p className="xmas__chip"><Snowflake aria-hidden="true" size={13} />Đêm Noel Sài Gòn</p>
                  <Image alt="iOrder" className="mb-4" height={47} preload src="/brand/iorder-logo-dark.png" width={141} />
                  <h1 id="login-title">Đăng nhập CMS</h1>
                  <p className="xmas__lead">Quản lý nội dung, sản phẩm và khách hàng của website iOrder.</p>
                  {form}
                </section>
              </div>
            </div>
            <ChristmasGreeting text="Chúc bạn một mùa Giáng sinh ấm áp và năm mới bình an." />
          </main>
          <ChristmasEffects />
        </AdminToastProvider>
      </ChristmasStage>
    );
  }

  return (
    <AdminToastProvider>
      <main className="grid min-h-screen place-items-center p-4">
        <section className="w-full max-w-sm rounded-[var(--cms-radius-card)] border border-[var(--cms-border)] bg-[var(--cms-card)] p-6">
          <Image alt="iOrder" className="mb-4" height={51} preload src="/brand/iorder-logo.png" width={140} />
          <h1 className="mb-1">Đăng nhập CMS</h1>
          <p className="mb-5 text-[13px] text-[var(--cms-muted)]">Quản lý nội dung, sản phẩm và khách hàng của website iOrder.</p>
          {form}
        </section>
      </main>
    </AdminToastProvider>
  );
}
