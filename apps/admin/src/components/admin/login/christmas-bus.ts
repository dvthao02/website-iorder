import type { Pattern } from "./christmas-patterns";

// Xe buýt sự kiện nhỏ giữa ChristmasStage (nhận bấm chuột, đăng nhập thành công/thất bại) và các canvas hiệu ứng.
// Tọa độ x, y là tọa độ trong cửa sổ (clientX/clientY); canvas tự đổi sang tọa độ của nó.
export const effectEvent = "xmas:effect";

export type EffectRequest =
  | { type: "firework"; x: number; y: number; pattern?: Pattern; scale?: number }
  | { type: "rocket"; x: number; y: number; pattern?: Pattern; scale?: number }
  | { type: "confetti"; x: number; y: number; count?: number; angle?: number; spread?: number }
  | { type: "sparkle"; x: number; y: number }
  | { type: "celebrate" }
  | { type: "flurry" };

export function requestEffect(detail: EffectRequest) {
  window.dispatchEvent(new CustomEvent<EffectRequest>(effectEvent, { detail }));
}
