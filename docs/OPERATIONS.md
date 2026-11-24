# Hướng dẫn vận hành CMS

CMS là nơi quản lý nội dung và cấu hình website. Các mục nhìn thấy và thao tác có thể thực hiện phụ thuộc vào quyền của tài khoản. Nếu không có nút hoặc không mở được một mục, liên hệ người quản trị để kiểm tra quyền; không chia sẻ tài khoản.

## Tìm đúng nơi cần sửa

| Công việc | Mục trong CMS |
|---|---|
| Theo dõi liên hệ khách gửi | Công việc → Khách hàng tiềm năng |
| Sửa nội dung trang chủ hoặc trang website | Nội dung website → Trang chủ / Trang website |
| Viết tin tức, bài viết, hướng dẫn | Nội dung website → Bài viết & Tin tức / Hướng dẫn sử dụng |
| Sửa sản phẩm, giải pháp, thiết bị hoặc tệp cài đặt | Nội dung website → mục tương ứng |
| Quản lý ảnh và tệp dùng trên website | Nội dung website → Thư viện hình ảnh & tệp |
| Đổi menu, chuyển hướng, biểu mẫu tư vấn hoặc quảng cáo tự hiện | Cấu trúc website |
| Đổi thông tin doanh nghiệp, tên miền, SEO và liên kết | Cài đặt website |
| Xem tình trạng, sao lưu, người dùng và nhật ký | Hệ thống |

Những trang danh sách như Tin tức, Thiết bị và Phần mềm có phần trình bày riêng; các bài và sản phẩm trong danh sách được quản lý tại mục nội dung tương ứng. Sửa trang danh sách không thay thế việc sửa từng bản ghi.

## Soạn và xuất bản

1. Mở mục nội dung phù hợp, chọn tạo mới hoặc mở nội dung cần sửa. Nhập tiêu đề, nội dung, hình ảnh và các thông tin cần thiết.
2. Lưu bản nháp hoặc gửi duyệt khi chưa muốn công khai. Dùng chức năng xem trước để kiểm tra; đọc thông báo trong CMS để biết bản xem trước sử dụng nội dung nào.
3. Người có quyền xuất bản chọn đăng ngay hoặc hẹn giờ và lưu. Mở website để kiểm tra nội dung, đường dẫn, ảnh và liên kết sau khi đăng.
4. Muốn gỡ nội dung khỏi website, chuyển về bản nháp hoặc lưu trữ theo thao tác được cung cấp. Khi đổi đường dẫn, kiểm tra các liên kết liên quan và chuyển hướng.

**Khóa bài viết, tin tức và hướng dẫn.** Bài đã chốt (ví dụ nội dung pháp lý hay bài cần giữ nguyên) có thể khóa để không ai sửa được nữa:
- Người có quyền **Khóa** (mô-đun Bài viết) thấy nút **Khóa bài viết** ở đầu trình soạn; khóa xong, bài hiện ổ khóa cạnh tiêu đề trong danh sách và trình soạn chuyển sang chỉ đọc, kèm dòng "Bài viết đã khóa bởi … lúc …".
- Bài khóa không ai sửa, đổi trạng thái (đăng/gỡ/lưu trữ), đổi chuyên mục, khôi phục phiên bản hay xóa được, kể cả người tạo bài và người có quyền Sửa hay Xuất bản; thao tác hàng loạt cũng bị chặn và báo "Nội dung đang bị khóa". Bài vẫn hiển thị trên website như cũ.
- Chỉ người có quyền **Khóa** mới **Mở khóa** được (Super Admin có sẵn). Khóa và mở khóa không đổi nội dung nên không làm mới trang website, và đều ghi vào nhật ký hoạt động. Lưu thay đổi dở dang trước khi khóa.
- Việc hệ thống tự cập nhật liên kết khi đổi chuyển hướng vẫn chạy trên bài khóa để liên kết không hỏng.
- Quyền Khóa mặc định có ở **Super Admin**, **Trưởng nhóm nội dung**, **Quản lý nội dung** và **Marketing & SEO**; **Biên tập viên** và **Xuất bản viên** sửa/đăng được bài nhưng không khóa được. Vai trò đã tạo trước đó không tự có quyền mới: bật ở Vai trò & quyền (ô Khóa ở dòng Bài viết).
- **Trưởng nhóm nội dung** (vai trò mẫu mới) soạn, duyệt, xuất bản và khóa/mở khóa mọi nội dung, xem menu và chuyển hướng, nhưng không đụng cấu hình hệ thống, người dùng, vai trò.

Khi hệ thống báo nội dung đã thay đổi ở phiên khác, bản nhập hiện tại chưa được ghi. Sao chép phần đang sửa nếu cần, tải bản mới và đối chiếu trước khi lưu lại. Lịch sử phiên bản hỗ trợ xem và khôi phục nội dung khi màn hình có chức năng này.

## Trang và hình ảnh

Trong trình dựng trang, chọn một thành phần để sửa nội dung và bố cục, kéo tay nắm để đổi thứ tự khi được phép, rồi lưu trang. Có thể đặt tên thành phần để dễ nhận diện trong CMS; tên này không thay tiêu đề hiển thị trên website. Các mục con được sửa trong thành phần cha tương ứng. Thành phần bị ẩn không xuất hiện trên website.

Chọn ảnh từ thư viện hoặc tải tệp lên, sau đó lưu nội dung để gắn ảnh vào trang. Thư viện nhận (nhận dạng theo nội dung tệp, không theo đuôi tên) ảnh PNG, JPEG, WebP, GIF, AVIF, SVG và tệp PDF, ZIP, RAR, 7Z, GZ, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), tối đa 20 MB mỗi tệp. Ảnh bìa, ảnh chia sẻ Facebook/Zalo/Twitter và ảnh đại diện chỉ nhận PNG, JPEG, WebP vì mạng xã hội không hiện SVG hay AVIF. SVG có script, thuộc tính sự kiện hoặc liên kết ngoài bị từ chối; hãy xuất lại SVG sạch. Tệp chạy được (.exe, .msi, .apk, .dmg) không lưu vào thư viện: ở mục Tệp cài đặt chúng giữ dạng link ngoài. Kiểm tra mô tả ảnh, ảnh xem trước và quyền sử dụng trước khi đăng. Không xóa tệp đang được nội dung khác sử dụng; xem thông báo tại thư viện để xử lý nơi dùng trước.

## Biểu mẫu tư vấn và quảng cáo tự hiện

Cấu trúc website có hai mục độc lập, mỗi mục có công tắc bật/tắt, nội dung và lịch hiển thị riêng: **Biểu mẫu tư vấn** (thu họ tên, số điện thoại, nhu cầu; thông tin khách để lại vào Khách hàng tiềm năng) và **Quảng cáo** (ảnh hoặc thông báo kèm một nút mở liên kết). Đổi mục này không ảnh hưởng mục kia; tắt chỉ ẩn hộp, nội dung vẫn được giữ.

- Khung **Xem trước** cạnh form (trên điện thoại nằm phía trên) cập nhật ngay khi nhập chữ, chọn ảnh và đổi mẫu hiển thị. Đây là bản mô phỏng trên máy tính, chưa lưu; quảng cáo bố cục "Chỉ ảnh" hoặc "Chia đôi" cần chọn ảnh mới bật được.
- Điều kiện hiển thị gồm trang (mọi trang phù hợp hoặc chỉ trang chủ), mức lướt trang, thời gian chờ và số ngày không hiện lại. Hộp không hiện ở trang Liên hệ, bản xem trước và trình dựng trang. Mỗi lượt xem trang chỉ hiện một hộp: hộp nào đủ điều kiện trước sẽ hiện, đến cùng lúc thì quảng cáo hiện trước. Dòng ghi chú dưới công tắc cho biết hộp còn lại đang bật hay tắt.
- Quảng cáo chỉ hiện sau khi ảnh đã tải xong. Nếu ảnh bị xóa hoặc không tải được, bố cục "Chỉ ảnh" và "Chia đôi" tạm không hiện, "Thẻ tiêu chuẩn" vẫn hiện nhưng không có ảnh; hãy chọn lại ảnh trong Thư viện.
- Muốn xem hộp trên website thật sau khi lưu: mở trang trong cửa sổ ẩn danh (hoặc xóa dữ liệu trang trong trình duyệt), lướt tới mức đã đặt và chờ đủ thời gian. Khách đã đóng hộp sẽ không thấy lại trong số ngày đã đặt; đổi tiêu đề, ảnh hoặc liên kết quảng cáo được tính là nội dung mới và hiện lại.
- Đổi đường dẫn mà quảng cáo đang trỏ tới thì liên kết của quảng cáo được cập nhật theo chuyển hướng (xem báo cáo sau khi lưu chuyển hướng).

## Liên hệ, tài khoản và hệ thống

Tại **Khách hàng tiềm năng**, mở liên hệ để theo dõi, ghi chú, giao việc và cập nhật trạng thái. Chỉ xuất dữ liệu cho người có nhu cầu công việc và giữ tệp xuất an toàn. Vai trò và quyền do quản trị viên cấu hình; quyền truy cập trên máy chủ vẫn được kiểm tra kể cả khi giao diện có hiển thị nút.

**Liên hệ mua thiết bị**
- Khách bấm **Liên hệ mua hàng** ở một thiết bị (trang chi tiết hoặc bảng chi tiết trong danh sách thiết bị) sẽ điền ngay biểu mẫu hỏi mua tại trang đó, không sang trang Liên hệ chung.
- Liên hệ có cột **Thiết bị hỏi mua** với tên, giá và tình trạng hàng **tại lúc khách gửi** (không đổi khi thiết bị sửa sau này; bấm tên để mở thiết bị). Tìm được theo tên hoặc mã thiết bị và có trong tệp xuất.

**Website tự chặn liên hệ rác**
- Gửi không qua biểu mẫu hoặc quá nhanh; ô bẫy bot.
- Quá 5 liên hệ/10 phút từ một IP; quá 5 liên hệ/30 phút hoặc 10 liên hệ/ngày từ một số điện thoại; hai liên hệ liên tiếp của cùng một số cách nhau dưới 30 giây.
- Số điện thoại sai quy tắc: đúng 10–11 chữ số bắt đầu bằng 0, `+84` thay cho số 0 đầu (nên +84 912 345 678 và 0912 345 678 là một số và được lưu dạng 0912345678). Họ tên bịa. Lời nhắn nhiều hơn một liên kết.
- Mỗi số điện thoại chỉ hỏi mua **một thiết bị một lần** trong 24 giờ (so theo mã thiết bị nên đổi tên hay slug thiết bị không né được); hỏi lại thì khách nhận thông báo "đã gửi yêu cầu cho thiết bị này" và cần bổ sung thì gọi hotline. Cùng một IP hỏi cùng một thiết bị tối đa 2 lần/giờ (đủ cho vài người cùng văn phòng).
- Liên hệ chung gửi trùng (cùng số và lời nhắn trong 24 giờ) chỉ lưu một dòng.
- Khách bị chặn nhận thông báo "thử lại sau ít phút" (không nêu số phút; chờ lâu hơn do giới hạn theo ngày thì mời gọi hotline).

**Danh sách và khung chi tiết**
- Số điện thoại hiển thị chuẩn hóa (0964 350 515); liên hệ cũ thiếu số 0 hoặc sai quy tắc giữ nguyên và có nhãn "Số chưa chuẩn". Giờ gửi kèm "5 phút trước"; liên hệ **Mới** chờ quá 24 giờ có nhãn đỏ "Chờ 2 ngày".
- Nhãn "Gửi N lần" khi cùng một số gửi nhiều liên hệ (mở liên hệ › Xem tất cả) và nhãn "Có ghi chú".
- Bộ lọc trên thanh: **Người phụ trách** (Của tôi, Chưa giao, từng người) và **Chỉ hiện** (**Chờ quá 24 giờ**: liên hệ Mới bị bỏ quên; **Khách gửi nhiều lần**: để tìm và gộp liên hệ trùng). **Bộ lọc khác** chứa Nguồn (Hỏi mua thiết bị / Liên hệ chung) và Khoảng thời gian; số trên nút là số bộ lọc đang bật, và mọi bộ lọc đang áp dụng hiện thành nhãn bỏ được từng cái. Các tab trạng thái đếm trong nhóm đang xem. Ô tìm kiếm khớp số điện thoại bất kể cách viết (0964…, +84 964…).
- **Ô tìm kiếm ở mọi màn danh sách tìm ngay khi gõ**: ngừng gõ khoảng nửa giây là lọc, không cần bấm Enter (Enter vẫn lọc ngay).
- Bảng gọn hơn: cột **Nhu cầu / thiết bị** gộp nhu cầu khách chọn với thiết bị hỏi mua; cột Email ẩn mặc định (bật lại ở nút cài đặt cột góc phải bảng; liên hệ nào có email thì email hiện trong khung chi tiết).
- Rê chuột vào một dòng (luôn hiện trên màn cảm ứng) thì cạnh số điện thoại hiện ba nút nhỏ **Gọi**, **Zalo** (chỉ với số hợp lệ) và **Sao chép** (đổi thành dấu tick khi đã chép); bấm các nút này không mở khung chi tiết. Chọn nhiều dòng thì menu **Thao tác** chia nhóm Trạng thái, Giao việc và Dọn dẹp.
- Chân khung chi tiết luôn có thanh nút: **Trước / Sau** (xem vị trí `n/N` trong danh sách; phím ↑ ↓ hoặc K J, không áp dụng khi đang gõ vào ô nhập), **Xóa**, và một nút đổi trạng thái một chạm (Mới → **Đã liên hệ**, Đã liên hệ → **Đã xử lý**, Đã xử lý → **Mở lại**). Đổi trạng thái ở một tab lọc làm liên hệ rời khỏi tab thì khung tự chuyển sang liên hệ kế tiếp, nên xử lý liên tiếp không phải mở lại từng liên hệ.
- Khung chi tiết có nút Gọi, Zalo, Sao chép số và **Sửa thông tin** (họ tên, số điện thoại, email; số điện thoại theo quy tắc chung và được lưu dạng chuẩn, nên đây cũng là cách sửa các số cũ có nhãn "Số chưa chuẩn"; nhật ký chỉ ghi tên trường đã sửa, không ghi giá trị); mục Xử lý lúc kèm tên người xử lý; ô **Ghi chú nội bộ** để ghi kết quả cuộc gọi, hẹn gọi lại (khách không thấy; nhật ký hoạt động chỉ ghi độ dài ghi chú, không ghi nội dung).
- Tệp xuất có thêm cột Người xử lý, Người phụ trách và Ghi chú nội bộ.

**Giao việc, xóa và gộp**
- **Giao việc:** mỗi liên hệ có thể giao cho một người phụ trách (cột **Phụ trách** trong bảng, hoặc mục Người phụ trách trong khung chi tiết; **Nhận xử lý** là giao cho chính mình; chọn nhiều dòng rồi Thao tác › Giao cho… để giao hàng loạt). Chỉ nhân viên đang hoạt động có quyền **Sửa** Khách hàng tiềm năng (hoặc Super Admin) được giao, vì người chỉ xem không đổi được trạng thái hay ghi chú của liên hệ đã giao cho mình.
- **Xóa liên hệ rác** (khung chi tiết, hoặc Thao tác › Xóa liên hệ rác cho nhiều dòng) và **Gộp các liên hệ cùng số** (chọn từ 2 liên hệ cùng một số điện thoại, Thao tác › Gộp) cần quyền *Xóa* của mô-đun Khách hàng tiềm năng. Super Admin có sẵn; vai trò khác do quản trị viên bật ở Vai trò & quyền.
- Gộp giữ liên hệ mới nhất, ghi thiết bị, lời nhắn và trạng thái của các liên hệ cũ vào Ghi chú nội bộ của nó rồi xóa các liên hệ cũ. Liên hệ giữ lại lấy mức xử lý thấp nhất của cả nhóm (một liên hệ cũ chưa ai xử lý không biến mất) và thừa hưởng người phụ trách nếu chưa có.
- **Xóa liên hệ xóa luôn thông tin cá nhân của khách** (tên, số điện thoại, email, lời nhắn, ghi chú) và không hoàn tác được. Liên hệ biến khỏi danh sách, thông báo, thống kê và tệp xuất; hệ thống chỉ giữ số điện thoại dạng chữ số, IP đã băm và thiết bị đó để chặn gửi rác lặp lại. Gộp cũng xóa như vậy các liên hệ cũ, vì nội dung đã nằm trong ghi chú của liên hệ giữ lại. Nếu chưa chắc là rác, chỉ cần chuyển trạng thái chứ đừng xóa. Liên hệ đã xóa từ phiên bản cũ (chỉ bị ẩn, còn giữ thông tin) được dọn nốt bằng `pnpm db:cleanup-leads` (chạy một lần, chạy lại không sao).

**Chuông thông báo**
- Nêu **từng việc một**: mỗi liên hệ chưa xử lý là một dòng "Gọi lại <tên> — hỏi mua <thiết bị>" kèm số điện thoại và thời gian chờ (quá 24 giờ có chấm đỏ, xếp trước), bấm vào mở thẳng liên hệ đó. Chỉ nêu liên hệ do bạn phụ trách hoặc chưa giao cho ai; người có quyền xóa liên hệ (quản lý) còn thấy liên hệ đã giao cho người khác nhưng quá 24 giờ chưa xử lý, dạng "Chị Lan chưa gọi lại …", để nhắc việc. Tối đa 5 dòng rồi gộp "Còn N liên hệ khác". Mỗi nội dung chờ duyệt cũng một dòng "Duyệt bài viết: <tiêu đề>" mở thẳng trang sửa.
- Mỗi dòng có nút ✓ **đánh dấu đã đọc / chưa đọc** và nút × **xóa thông báo**; bấm vào dòng để mở việc đó cũng tự đánh dấu đã đọc; thanh phía trên có **Đọc tất cả** và **Xóa tất cả**. Chưa đọc có vạch xanh và chữ đậm, đã đọc mờ đi; số đỏ trên chuông là số việc **chưa đọc**.
- Đã đọc hay đã xóa chỉ là của riêng từng tài khoản (người khác vẫn thấy thông báo đó) và dùng được trên mọi máy. "Xóa" chỉ ẩn thông báo, không xóa liên hệ hay bài viết: khi thông báo đó có diễn biến mới (liên hệ vừa quá hạn hoặc vừa được giao cho bạn, bài vừa được sửa lại, số việc còn lại tăng) nó hiện lại như thông báo mới; việc đã xử lý xong thì thông báo tự mất.
- Chuông tự cập nhật mỗi phút; việc mới tới trong lúc bạn đang mở CMS có thông báo nổi ở góc màn hình.


Nhật ký hoạt động chỉ đọc đối với mọi vai trò; nội dung từng dòng không sửa được. Super Admin có nút **Xóa nhật ký** (xóa các dòng cũ hơn 30 ngày, 90 ngày, 6 tháng hoặc 1 năm, mọi dòng đang khớp bộ lọc, hoặc toàn bộ) và chọn từng dòng để xóa; hộp xác nhận cho biết trước số dòng sẽ bị xóa và phải gõ chữ xác nhận ("xóa hết" khi xóa toàn bộ). Mỗi lần xóa để lại một dòng "Xóa nhật ký hoạt động" ghi ai xóa, lúc nào, phạm vi và số dòng; các dòng này không bao giờ bị xóa. Bản sao lưu database tạo trước đó vẫn chứa các dòng đã xóa.

Mục Tình trạng hệ thống và Sao lưu giúp theo dõi vận hành; Super Admin còn tải bản sao lưu về, xóa bản cũ, chỉnh số bản giữ lại và xóa lịch sử sao lưu ở màn Sao lưu & phục hồi (mọi thao tác được ghi vào Nhật ký hoạt động). Sao lưu không đồng nghĩa đã khôi phục được: người phụ trách cần lưu bản sao ở nơi an toàn và định kỳ thử phục hồi trên môi trường riêng theo [tài liệu hệ thống](PROJECT.md). Không tự chạy lệnh khôi phục hoặc xóa dữ liệu khi chưa xác định đúng môi trường và bản sao.

## Nhập dữ liệu từ tệp

Chọn đúng loại dữ liệu, chọn tệp và sheet nếu có, xem kết quả kiểm tra và các lỗi trước khi xác nhận. Nếu dữ liệu hoặc điều kiện thay đổi sau bước xem trước, kiểm tra lại theo yêu cầu của màn hình. Không dùng tệp mẫu hoặc số liệu chưa xác minh làm thông tin công khai.
