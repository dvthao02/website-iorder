-- URL public chuyển sang tiếng Anh, trùng tên thư mục route (/tin-tuc → /news, /gioi-thieu → /about, /dieu-khoan → /terms-of-use…).
-- Đưa các liên kết đã lưu trong dữ liệu về URL mới: mục menu, đích chuyển hướng, khối trang, bài viết (kể cả nút cuối bài), sản phẩm/giải pháp/dịch vụ,
-- thiết bị, cài đặt website và canonical URL. Khớp theo tiền tố đoạn đường dẫn (kèm /con, ?query, #neo); nguồn của chuyển hướng giữ nguyên vì đó là
-- URL cũ cần được chuyển hướng; lịch sử phiên bản (*_revisions) giữ nguyên. Chạy lại không đổi thêm gì. Website vẫn chuyển 301 URL tiếng Việt cũ về URL mới.
DO $$
DECLARE
  pair text[];
  target text[];
  starts_with text;
BEGIN
  -- Mục cụ thể đứng trước mục chung (/ho-tro/faq trước /ho-tro).
  FOREACH pair SLICE 1 IN ARRAY ARRAY[
    ['/ho-tro/cai-dat', '/support/setup'], ['/ho-tro/huong-dan', '/support/guides'], ['/ho-tro/faq', '/support/faq'], ['/ho-tro/video', '/support/videos'],
    ['/ho-tro-tu-xa', '/support/remote'], ['/ho-tro', '/support'],
    ['/tin-tuc/chuyen-muc', '/news/category'], ['/tin-tuc/the', '/news/tag'], ['/tin-tuc', '/news'],
    ['/tac-gia', '/author'], ['/gioi-thieu', '/about'], ['/lien-he', '/contact'], ['/thiet-bi', '/equipment'],
    ['/chinh-sach-bao-mat', '/privacy-policy'], ['/dieu-khoan', '/terms-of-use'], ['/trang', '/pages'],
    ['/phan-mem', '/software'], ['/giai-phap', '/solutions'], ['/dich-vu', '/services']
  ] LOOP
    starts_with := '^' || pair[1] || '([/#?]|$)';
    -- Cột chữ: đường dẫn đứng đầu giá trị.
    FOREACH target SLICE 1 IN ARRAY ARRAY[['menu_items', 'url'], ['redirects', 'destination_path'], ['posts', 'cta_url']] LOOP
      EXECUTE format('UPDATE %1$I SET %2$I = regexp_replace(%2$I, %3$L, %4$L) WHERE %2$I ~ %3$L', target[1], target[2], starts_with, pair[2] || '\1');
    END LOOP;
    -- Canonical URL: giữ nguyên tên miền, chỉ đổi phần đường dẫn.
    FOREACH target SLICE 1 IN ARRAY ARRAY[['pages', 'canonical_url'], ['posts', 'canonical_url'], ['offerings', 'canonical_url'], ['sales_equipment', 'canonical_url']] LOOP
      EXECUTE format('UPDATE %1$I SET %2$I = regexp_replace(%2$I, %3$L, %4$L) WHERE %2$I ~ %3$L', target[1], target[2], '^(https?://[^/]+)' || pair[1] || '([/#?]|$)', '\1' || pair[2] || '\2');
    END LOOP;
    -- Cột JSON: chuỗi bắt đầu bằng đường dẫn, kết thúc ở / # ? hoặc dấu nháy đóng.
    FOREACH target SLICE 1 IN ARRAY ARRAY[['page_blocks', 'data'], ['posts', 'content'], ['offerings', 'content'], ['sales_equipment', 'blocks'], ['sales_equipment', 'page_layout']] LOOP
      EXECUTE format('UPDATE %1$I SET %2$I = regexp_replace(%2$I::text, %3$L, %4$L, ''g'')::jsonb WHERE %2$I::text ~ %3$L', target[1], target[2], '"' || pair[1] || '([/#?"])', '"' || pair[2] || '\1');
    END LOOP;
    -- Cài đặt website, trừ khóa hệ thống (lịch sử sao lưu, trạng thái chạy nền).
    UPDATE site_settings SET value = regexp_replace(value::text, '"' || pair[1] || '([/#?"])', '"' || pair[2] || '\1', 'g')::jsonb
      WHERE key NOT LIKE 'system.%' AND value::text ~ ('"' || pair[1] || '([/#?"])');
  END LOOP;
END
$$;
--> statement-breakpoint
-- Trang "Điều khoản dịch vụ" (slug terms, /terms-of-use): thay nội dung mẫu bằng bản công bố tại https://iorder.vn/term-of-use.
-- Chỉ chạy khi trang còn là dữ liệu mẫu (dòng "Cập nhật" ở đầu trang còn chữ "Dữ liệu mẫu"); trang đã được người vận hành sửa hoặc đã cập nhật thì giữ nguyên.
-- Giữ nguyên lời văn bản gốc; chỉ đổi danh sách đánh số thành tiêu đề mục "1. …", tách các câu bị ngắt dòng ở mục 8 thành đoạn riêng và sửa lỗi chính tả
-- hiển nhiên ("de dọa" → "đe dọa"). Câu "khu vực quản trị, hệ thống lỗi…" ở mục 2 giữ nguyên để chủ sở hữu văn bản rà soát. Bản gốc không ghi ngày cập nhật
-- nên dòng "Cập nhật" bị xóa. Tăng draft_version để tab CMS đang mở bản cũ nhận lỗi xung đột thay vì ghi đè.
DO $$
DECLARE
  terms_id uuid;
BEGIN
  SELECT p.id INTO terms_id FROM pages p
   WHERE p.slug = 'terms' AND p.deleted_at IS NULL
     AND EXISTS (SELECT 1 FROM page_blocks b WHERE b.page_id = p.id AND b.type = 'hero' AND b.data->>'footnote' LIKE '%Dữ liệu mẫu%');
  IF terms_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE page_blocks SET data = jsonb_set(data, '{footnote}', 'null'::jsonb) WHERE page_id = terms_id AND type = 'hero';
  UPDATE page_blocks SET data = jsonb_set(data, '{body}', $body${"type": "doc", "content": [
      {"type":"heading","attrs":{"level":2},"content":[{"text":"1. Phạm vi áp dụng","type":"text"}]},
      {"type":"paragraph","content":[{"text":"Khi đăng ký hoặc sử dụng bất kỳ phiên bản nào của nền tảng iOrder (bao gồm thử nghiệm, miễn phí, có phí; ứng dụng web hoặc điện thoại), người dùng đồng ý với toàn bộ điều khoản dưới đây. Nếu một phần nào trong văn bản này bị vô hiệu, các điều khoản còn lại vẫn tiếp tục áp dụng. Trong trường hợp có xung đột giữa tài liệu này và hợp đồng riêng, văn bản được ký gần nhất hoặc có quy định rõ ràng hơn sẽ được ưu tiên.","type":"text"}]},
      {"type":"heading","attrs":{"level":2},"content":[{"text":"2. Khu vực sử dụng","type":"text"}]},
      {"type":"paragraph","content":[{"text":"Khu vực chung:","type":"text","marks":[{"type":"bold"}]},{"text":" iOrder có quyền quyết định cách người dùng được tiếp cận và sử dụng các khu vực chia sẻ trên hệ thống. Một số yêu cầu sử dụng đặc thù có thể phải chi trả chi phí riêng.","type":"text"}]},
      {"type":"paragraph","content":[{"text":"Khu vực riêng:","type":"text","marks":[{"type":"bold"}]},{"text":" Đây là không gian riêng được bảo vệ bằng mật khẩu, dành riêng cho từng người dùng. iOrder không can thiệp vào dữ liệu tại đây, trừ các trường hợp sau:","type":"text"}]},
      {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Có sự đồng ý từ người dùng.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Người dùng cần hỗ trợ kỹ thuật.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Có yêu cầu từ cơ quan pháp luật.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Các tình huống khẩn cấp đe dọa đến an toàn hệ thống.","type":"text"}]}]}]},
      {"type":"paragraph","content":[{"text":"Người dùng không được quyền truy cập vào khu vực quản trị, hệ thống lỗi hay không gian riêng của bên khác.","type":"text"}]},
      {"type":"heading","attrs":{"level":2},"content":[{"text":"3. Sử dụng hợp pháp","type":"text"}]},
      {"type":"paragraph","content":[{"text":"Người dùng cam kết sử dụng dịch vụ đúng quy định pháp luật Việt Nam và không gây tổn hại cho tổ chức, cá nhân nào. iOrder có quyền tạm dừng hoặc chấm dứt dịch vụ mà không hoàn tiền nếu phát hiện:","type":"text"}]},
      {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Dùng để kinh doanh trái phép.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Lưu trữ nội dung độc hại, phản cảm, hoặc bị cấm.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Vi phạm quyền sở hữu trí tuệ.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Tấn công hệ thống hoặc làm tắc nghẽn tài nguyên.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Gây ảnh hưởng tới người dùng khác.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Không thanh toán đúng hạn.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Làm ảnh hưởng xấu tới hình ảnh iOrder.","type":"text"}]}]}]},
      {"type":"paragraph","content":[{"text":"iOrder có thể liên hệ hoặc thông báo trước tùy tình huống, nhưng vẫn bảo lưu quyền tạm dừng khẩn cấp nếu cần.","type":"text"}]},
      {"type":"heading","attrs":{"level":2},"content":[{"text":"4. Quyền sở hữu trí tuệ","type":"text"}]},
      {"type":"paragraph","content":[{"text":"Toàn bộ phần mềm, giao diện, logo, nội dung... là tài sản hợp pháp thuộc quyền sở hữu của iOrder. Người dùng chỉ được phép sử dụng theo thỏa thuận; không được sao chép, phân tán ngược, hoặc tái sử dụng trái phép.","type":"text"}]},
      {"type":"heading","attrs":{"level":2},"content":[{"text":"5. Bảo mật dữ liệu","type":"text"}]},
      {"type":"paragraph","content":[{"text":"iOrder cam kết bảo mật dữ liệu người dùng trừ khi:","type":"text"}]},
      {"type":"bulletList","content":[{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Dữ liệu đã công khai.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Có yêu cầu hỗ trợ từ chính người dùng.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Có yêu cầu từ cơ quan có thẩm quyền.","type":"text"}]}]},{"type":"listItem","content":[{"type":"paragraph","content":[{"text":"Gặp trường hợp bất khả kháng như thiên tai, sự cố hệ thống.","type":"text"}]}]}]},
      {"type":"heading","attrs":{"level":2},"content":[{"text":"6. Dịch vụ bên thứ ba","type":"text"}]},
      {"type":"paragraph","content":[{"text":"iOrder tích hợp các tiện ích mở rộng do bên thứ ba phát triển như: vận chuyển, thanh toán, tài chính,... Việc sử dụng các tiện ích này đồng nghĩa với việc người dùng đồng ý chia sẻ dữ liệu liên quan và tuân theo chính sách riêng của bên cung cấp dịch vụ đó.","type":"text"}]},
      {"type":"paragraph","content":[{"text":"iOrder không chịu trách nhiệm pháp lý về các lỗi hay tổn thất do dịch vụ bên thứ ba gây ra.","type":"text"}]},
      {"type":"heading","attrs":{"level":2},"content":[{"text":"7. Hỗ trợ và xử lý sự cố","type":"text"}]},
      {"type":"paragraph","content":[{"text":"iOrder cam kết duy trì hệ thống ổn định, tuy nhiên không đảm bảo hoàn toàn không gián đoạn. Trong trường hợp sự cố, iOrder sẽ nhanh chóng hỗ trợ khắc phục. Người dùng phải thông báo kịp thời khi phát hiện vấn đề để được xử lý.","type":"text"}]},
      {"type":"heading","attrs":{"level":2},"content":[{"text":"8. Giới hạn trách nhiệm","type":"text"}]},
      {"type":"paragraph","content":[{"text":"iOrder cung cấp công cụ hỗ trợ, không tham gia vận hành nội dung đặt hàng hoặc các tương tác cụ thể của người dùng.","type":"text"}]},
      {"type":"paragraph","content":[{"text":"Người dùng tự chịu trách nhiệm bảo mật tài khoản, nội dung, phân quyền và các hành vi phát sinh trong tài khoản của mình.","type":"text"}]},
      {"type":"paragraph","content":[{"text":"iOrder không chịu trách nhiệm về sự cố do người dùng không bảo mật thông tin hoặc do dịch vụ bên thứ ba gây ra. Ngoài ra, iOrder không có trách nhiệm giải quyết tranh chấp phát sinh từ giao dịch giữa người dùng và các bên không thuộc hệ thống.","type":"text"}]},
      {"type":"heading","attrs":{"level":2},"content":[{"text":"9. Hỗ trợ & khiếu nại","type":"text"}]},
      {"type":"paragraph","content":[{"text":"Hỗ trợ kỹ thuật:","type":"text","marks":[{"type":"bold"}]},{"text":" Hướng dẫn qua Zalo/ZaloOA, email, hotline.","type":"text"}]},
      {"type":"paragraph","content":[{"text":"Liên hệ trực tiếp:","type":"text","marks":[{"type":"bold"}]},{"type":"hardBreak"},{"text":"CÔNG TY CỔ PHẦN CÔNG NGHỆ iOrder","type":"text","marks":[{"type":"bold"}]},{"type":"hardBreak"},{"text":"Địa chỉ: 756A Âu Cơ - Phường 14 - Q. Tân Bình - HCM","type":"text"},{"type":"hardBreak"},{"text":"Hotline: ","type":"text"},{"text":"02871073999","type":"text","marks":[{"type":"link","attrs":{"href":"tel:02871073999","target":null}}]},{"type":"hardBreak"},{"text":"Email: ","type":"text"},{"text":"contact@iorder.vn","type":"text","marks":[{"type":"link","attrs":{"href":"mailto:contact@iorder.vn","target":null}}]}]},
      {"type":"paragraph","content":[{"text":"Xử lý khiếu nại:","type":"text","marks":[{"type":"bold"}]},{"text":" Tiếp nhận và phản hồi trong thời gian sớm nhất.","type":"text"}]}
    ]}$body$::jsonb)
   WHERE id = (SELECT id FROM page_blocks WHERE page_id = terms_id AND type = 'rich_text' ORDER BY sort_order LIMIT 1);
  UPDATE pages SET draft_version = draft_version + 1, updated_at = now() WHERE id = terms_id;
END
$$;
