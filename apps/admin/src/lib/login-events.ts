// Sự kiện trình duyệt giữa form đăng nhập và giao diện theo mùa, để LoginForm không phải biết giao diện nào đang hiện.
export const loginSuccessEvent = "cms:login-success";
export const loginFailureEvent = "cms:login-failure";

/**
 * Chi tiết của sự kiện đăng nhập thành công. Giao diện nào muốn chiếu hiệu ứng chúc mừng trước khi chuyển trang thì
 * đặt `delayMs` (mili giây) trong trình xử lý; LoginForm chờ chừng đó rồi mới chuyển. Mặc định 0: chuyển ngay.
 */
export type LoginSuccessDetail = { delayMs: number };
