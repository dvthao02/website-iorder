import { z } from "zod";

// Khóa API và thông tin kết nối Super Admin nhập ở CMS (Cài đặt → Kết nối & khóa API). Tệp này an toàn cho cả trình duyệt: chỉ có kiểu, nhãn và
// schema, không import gì của Node. Giá trị khóa KHÔNG bao giờ nằm trong kiểu nào ở đây: trạng thái chỉ có "đã đặt/chưa đặt" và gợi ý không bí mật.

export const secretKeys = ["google_service_account", "search_console_property", "umami_api_url", "umami_website_id", "umami_api_key"] as const;
export type SecretKey = (typeof secretKeys)[number];

/** Mỗi công cụ ngoài là một thẻ ở CMS gồm nhiều biến kết nối. Thêm công cụ mới = thêm khóa vào secretKeys, secretMetas, bộ kiểm tra ở secrets.catalog.ts và một dòng ở đây. */
export const integrationTools = [
  { id: "umami", label: "Umami (thống kê truy cập)", description: "Công cụ đếm lượt truy cập tự host. Điền đủ địa chỉ, mã website và API key để Tổng quan hiện số liệu truy cập; mã website còn được dùng để gắn thẻ theo dõi lên website công khai.", keys: ["umami_api_url", "umami_website_id", "umami_api_key"] },
  { id: "google_search_console", label: "Google Search Console", description: "Cho CMS xem tình trạng lập chỉ mục và hiệu quả tìm kiếm của website. Chỉ cần khóa tài khoản dịch vụ; thuộc tính chỉ điền khi muốn chọn thuộc tính cụ thể.", keys: ["google_service_account", "search_console_property"] },
] as const satisfies ReadonlyArray<{ id: string; label: string; description: string; keys: readonly SecretKey[] }>;
export type IntegrationToolId = (typeof integrationTools)[number]["id"];

export type SecretMeta = {
  key: SecretKey;
  label: string;
  description: string;
  /** json_file: người vận hành chọn tệp .json (không gõ JSON); text: một dòng chữ. */
  input: "json_file" | "text";
  /** true: giá trị không bí mật nên CMS hiển thị lại được (gợi ý chính là giá trị). */
  exposeValue: boolean;
  /** Biến môi trường tương ứng: nếu đã đặt thì biến thắng và giá trị trong CMS chưa có hiệu lực. */
  envNames: readonly string[];
  placeholder?: string;
};

export const secretMetas: Record<SecretKey, SecretMeta> = {
  google_service_account: {
    key: "google_service_account",
    label: "Google Search Console: khóa tài khoản dịch vụ",
    description: "Tệp khóa JSON tải từ Google Cloud (Service Account). CMS chỉ giữ email và khóa riêng trong tệp, mã hóa trước khi lưu.",
    input: "json_file",
    exposeValue: false,
    envNames: ["GOOGLE_SERVICE_ACCOUNT_JSON", "GOOGLE_SERVICE_ACCOUNT_FILE"],
  },
  search_console_property: {
    key: "search_console_property",
    label: "Google Search Console: thuộc tính",
    description: "Chỉ cần khi muốn chọn thuộc tính cụ thể thay vì tự khớp theo địa chỉ website. Dạng sc-domain:ten-mien.vn hoặc https://ten-mien.vn/.",
    input: "text",
    exposeValue: true,
    envNames: ["SEARCH_CONSOLE_PROPERTY"],
    placeholder: "sc-domain:ten-mien.vn",
  },
  umami_api_url: {
    key: "umami_api_url",
    label: "Địa chỉ Umami (API)",
    description: "Địa chỉ gốc để Backend gọi Umami, ví dụ http://umami:3000 trong mạng Docker hoặc https://thongke.ten-mien.vn. Không kèm đường dẫn phía sau. Đường chuyển tiếp /stats của website công khai do máy chủ web đảm nhiệm, không đổi ở đây.",
    input: "text",
    exposeValue: true,
    envNames: ["UMAMI_API_URL"],
    placeholder: "https://thongke.ten-mien.vn",
  },
  umami_website_id: {
    key: "umami_website_id",
    label: "Mã website trong Umami",
    description: "Mã dạng UUID của website, lấy ở Umami → Websites → Settings. Dùng cả để đọc số liệu lẫn để gắn thẻ theo dõi lên website công khai (website cập nhật trong khoảng một phút).",
    input: "text",
    exposeValue: true,
    envNames: ["UMAMI_WEBSITE_ID"],
    placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  },
  umami_api_key: {
    key: "umami_api_key",
    label: "Umami: API key",
    description: "Khóa để CMS đọc số liệu truy cập từ Umami (tạo trong giao diện Umami).",
    input: "text",
    exposeValue: false,
    envNames: ["UMAMI_API_KEY"],
  },
};

export const secretKeySchema = z.enum(secretKeys);

/** Đặt hoặc thay một khóa. `password` là mật khẩu CỦA CHÍNH người đang đăng nhập, dùng để xác nhận. */
export const setSecretRequestSchema = z.object({
  key: secretKeySchema,
  value: z.string().min(1, "Chưa nhập giá trị.").max(20_000, "Giá trị quá dài."),
  password: z.string().min(1, "Cần nhập mật khẩu để xác nhận.").max(256),
  expectedVersion: z.number().int().min(0).optional(),
});

/** Lưu nhiều biến của một công cụ cùng lúc (một lần nhập mật khẩu). Kiểm tra hết rồi mới ghi: có biến sai thì không biến nào được lưu. */
export const setSecretsRequestSchema = z.object({
  items: z.array(z.object({
    key: secretKeySchema,
    value: z.string().min(1, "Chưa nhập giá trị.").max(20_000, "Giá trị quá dài."),
    expectedVersion: z.number().int().min(0).optional(),
  })).min(1, "Chưa có biến nào để lưu.").max(10, "Quá nhiều biến một lần.").refine((items) => new Set(items.map((item) => item.key)).size === items.length, "Một biến chỉ được nhập một lần."),
  password: z.string().min(1, "Cần nhập mật khẩu để xác nhận.").max(256),
});

/** Tạo khóa chủ ngay ở CMS (khi máy chủ chưa có SECRETS_MASTER_KEY): CMS tự sinh khóa ngẫu nhiên và cất trong tệp riêng trên máy chủ. */
export const createMasterKeyRequestSchema = z.object({
  action: z.literal("create-master-key"),
  password: z.string().min(1, "Cần nhập mật khẩu để xác nhận.").max(256),
});

export const clearSecretRequestSchema = z.object({
  key: secretKeySchema,
  password: z.string().min(1, "Cần nhập mật khẩu để xác nhận.").max(256),
});

export type SecretStatus = {
  key: SecretKey;
  label: string;
  description: string;
  input: SecretMeta["input"];
  exposeValue: boolean;
  placeholder?: string;
  /** Giá trị đang được dùng đến từ đâu: biến môi trường (thắng), CMS, hoặc chưa có. */
  state: "env" | "cms" | "none";
  storedInCms: boolean;
  /** Biến môi trường đang ghi đè: giá trị lưu ở CMS (nếu có) chưa có hiệu lực. */
  envOverrides: boolean;
  /** Gợi ý không bí mật: email tài khoản dịch vụ, bốn ký tự cuối của API key, hoặc chính giá trị nếu exposeValue. */
  hint: string | null;
  version: number;
  updatedAt: string | null;
  updatedByName: string | null;
};

export type SecretsOverview = {
  /** ok: có khóa chủ hợp lệ; missing: chưa có (chưa lưu được); invalid: có nhưng sai định dạng hoặc không đọc được. */
  masterKey: "ok" | "missing" | "invalid";
  /** Khóa chủ đang lấy từ đâu: biến môi trường SECRETS_MASTER_KEY, tệp trên máy chủ (do CMS tạo hoặc đặt sẵn), hoặc chưa có. */
  masterKeySource: "env" | "file" | "none";
  /** Super Admin có thể bấm "Tạo khóa chủ" (chưa có khóa chủ và máy chủ cho phép ghi tệp khóa). */
  canCreateMasterKey: boolean;
  /** Đường dẫn tệp khóa chủ trên máy chủ (để người quản trị biết cần sao lưu riêng); null nếu không dùng tệp. Không phải bí mật. */
  keyFilePath: string | null;
  secrets: SecretStatus[];
};
