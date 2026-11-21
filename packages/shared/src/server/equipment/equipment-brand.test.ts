import assert from "node:assert/strict";
import test from "node:test";

import { inferEquipmentBrand } from "./equipment-brand";

test("Nhận ra hãng khi tên ghi rõ, kể cả tên viết khác nhau", () => {
  const cases: Array<[string, string | null, string]> = [
    ["POS cảm ứng 1 màn hình Sunmi D2 - Single", "D2-Single", "Sunmi"],
    ["Máy POS Sunmi V2s", "V2s", "Sunmi"],
    ["Máy in hóa đơn Zywell ZY-Q822", "ZY-Q822", "Zywell"],
    ["Máy quét mã vạch Datamax M1400", "M1400", "Datamax"],
    ["Máy quét mã vạch ATS-1400-D", "ATS-1400-D", "ATS"],
    ["Loa thông báo QRBox - Bảo Kim", "QRBox", "Bảo Kim"],
    ["Bộ thẻ rung tự phục vụ Jiantaokj Model 911", "911", "Jiantaokj"],
    ["Máy in nhiệt IOD 86", "iOD86", "iOrder"],
    ["Máy In Hóa Đơn IOD 86", "iOD86", "iOrder"],
    ["Máy POS tính tiền màn hình đơn iOrder - Model IOD68", "IOD68", "iOrder"],
  ];
  for (const [name, model, brand] of cases) assert.equal(inferEquipmentBrand(name, model), brand, name);
});

test("Tên không ghi hãng thì để trống thay vì đoán", () => {
  for (const [name, model] of [["Máy POS mini cầm tay", "POS-MINI"], ["Máy in hóa đơn nhiệt 80mm", "TP-80"], ["Két đựng tiền", "CD-405"], ["Két đựng tiền AT - 410", "AT-410"],
    ["Giấy in nhiệt K80x80", "K80x80"], ["Máy quét mã vạch", "SC-2D"], ["Máy in nhiệt model PD304", "PD304"]] as const) {
    assert.equal(inferEquipmentBrand(name, model), null, name);
  }
});

test("Không nhận nhầm khi chữ chỉ nằm trong từ khác", () => {
  assert.equal(inferEquipmentBrand("Máy radiod 86 khác", null), null);
  assert.equal(inferEquipmentBrand("Thiết bị statsmith", null), null);
});
