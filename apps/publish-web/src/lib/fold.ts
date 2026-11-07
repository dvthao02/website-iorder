// So khớp không dấu, không phân biệt hoa thường: gõ "in hoa don" vẫn ra "In hóa đơn". Dùng được cả ở server lẫn trình duyệt.
export const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
