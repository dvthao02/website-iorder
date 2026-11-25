import assert from "node:assert/strict";
import test from "node:test";

import { downloadHost, downloadKind, groupDownloads, groupIcon } from "./downloads";

test("loại tệp đoán từ đuôi trong đường dẫn, bỏ query và không phân biệt hoa thường", () => {
  assert.deepEqual(downloadKind("/media/uploads/goi-cai-dat.zip"), { icon: "archive", label: "ZIP" });
  assert.deepEqual(downloadKind("/media/uploads/huong-dan.PDF"), { icon: "document", label: "PDF" });
  assert.deepEqual(downloadKind("https://example.com/tai-ve/iOrder-Setup.exe?token=abc#x"), { icon: "windows", label: "EXE" });
  assert.deepEqual(downloadKind("https://example.com/app.dmg"), { icon: "mac", label: "DMG" });
  assert.deepEqual(downloadKind("https://example.com/app.apk"), { icon: "mobile", label: "APK" });
  assert.deepEqual(downloadKind("https://example.com/ban-sao.tar.gz"), { icon: "archive", label: "GZ" });
});

test("link không có đuôi (như link tải của Google Drive) hoặc sai định dạng là tệp chung, không nhãn", () => {
  assert.deepEqual(downloadKind("https://drive.google.com/uc?export=download&id=1abc"), { icon: "file", label: null });
  assert.deepEqual(downloadKind("https://example.com/"), { icon: "file", label: null });
  assert.deepEqual(downloadKind("https://example.com/readme.unknownext"), { icon: "file", label: null });
  assert.deepEqual(downloadKind("https://example.com/.zip"), { icon: "file", label: null });
});

test("tên máy chủ bỏ www và trả null khi link sai", () => {
  assert.equal(downloadHost("https://www.example.com/a.zip"), "example.com");
  assert.equal(downloadHost("https://drive.google.com/uc?id=1"), "drive.google.com");
  assert.equal(downloadHost("không phải link"), null);
});

const item = (id: string, groupName: string | null) => ({ id, groupName });
const summary = <T extends { id: string }>(groups: Array<{ label: string | null; items: T[] }>) => groups.map(group => [group.label, group.items.map(entry => entry.id)]);

test("chia theo nhóm người vận hành đặt, xếp theo thứ tự xuất hiện đầu tiên, tệp chưa có nhóm vào Khác ở cuối", () => {
  const groups = groupDownloads([item("1", "Driver trên Windows"), item("2", "Driver trên macOS"), item("3", "Driver trên Windows"), item("4", null), item("5", "Driver trên macOS")]);
  assert.deepEqual(summary(groups), [["Driver trên Windows", ["1", "3"]], ["Driver trên macOS", ["2", "5"]], ["Khác", ["4"]]]);
});

test("một nhóm duy nhất vẫn có tiêu đề; nhóm chỉ khác hoa thường hay khoảng trắng là một nhóm, giữ cách viết đầu tiên", () => {
  assert.deepEqual(summary(groupDownloads([item("1", "Máy in"), item("2", "  máy in ")])), [["Máy in", ["1", "2"]]]);
  assert.deepEqual(summary(groupDownloads([item("1", "Driver")])), [["Driver", ["1"]]]);
});

test("không tệp nào có nhóm thì không chia (một danh sách, không tiêu đề), kể cả nhóm toàn khoảng trắng", () => {
  assert.deepEqual(summary(groupDownloads([item("1", null), item("2", "   ")])), [[null, ["1", "2"]]]);
  assert.deepEqual(summary(groupDownloads([])), [[null, []]]);
});

test("nếu mọi tệp đều có nhóm thì không có nhóm Khác", () => {
  assert.deepEqual(groupDownloads([item("1", "A"), item("2", "B")]).map(group => group.label), ["A", "B"]);
});

test("biểu tượng nhóm đoán từ tên: Windows, macOS/iOS, Android, Linux, còn lại là thư mục", () => {
  assert.equal(groupIcon("Driver trên Windows"), "windows");
  assert.equal(groupIcon("Driver trên macOS"), "apple");
  assert.equal(groupIcon("Ứng dụng iOS"), "apple");
  assert.equal(groupIcon("Cho Mac"), "apple");
  assert.equal(groupIcon("Ứng dụng Android"), "android");
  assert.equal(groupIcon("Linux / Ubuntu"), "linux");
  assert.equal(groupIcon("Khác"), "folder");
  assert.equal(groupIcon("Máy in hóa đơn"), "folder");
  assert.equal(groupIcon("Macro"), "folder");
});

test("tên nhóm cho tệp chưa đặt nhóm đổi được theo ngôn ngữ khách chọn (mặc định vẫn là Khác)", () => {
  assert.deepEqual(summary(groupDownloads([item("1", "A"), item("2", null)], "Other")), [["A", ["1"]], ["Other", ["2"]]]);
  assert.deepEqual(summary(groupDownloads([item("1", "A"), item("2", null)])), [["A", ["1"]], ["Khác", ["2"]]]);
});
