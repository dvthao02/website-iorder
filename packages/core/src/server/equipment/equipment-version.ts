export class EquipmentVersionConflictError extends Error {
  constructor() {
    super("Thiết bị đã được cập nhật ở phiên làm việc khác. Nội dung bạn nhập vẫn được giữ lại. Hãy sao chép thay đổi cần giữ và tải lại bản mới nhất trước khi tiếp tục.");
    this.name = "EquipmentVersionConflictError";
  }
}

/** Phải gọi sau khi khóa dòng, trước mọi ghi dữ liệu/revision/audit. */
export function assertEquipmentVersion(actualVersion: number, expectedVersion: number | undefined) {
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion !== actualVersion) throw new EquipmentVersionConflictError();
}
