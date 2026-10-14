import { z } from "zod";

export function assertActiveAdministratorRemains(wasActiveAdmin: boolean, willBeActiveAdmin: boolean, activeCount: number) {
  if (wasActiveAdmin && !willBeActiveAdmin && activeCount <= 1) {
    throw new z.ZodError([{ code: "custom", path: ["role"], message: "Hệ thống phải luôn còn ít nhất một quản trị viên đang hoạt động." }]);
  }
}
