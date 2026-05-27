const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. CẤU HÌNH MIDDLEWARE
app.use(cors()); // Cho phép tất cả các trang vệ tinh kết nối đến Server trung tâm
app.use(express.json());

// Cấu hình để các trang vệ tinh có thể gọi trực tiếp file chatbot.js từ Render
app.use(express.static(path.join(__dirname)));

// Biến toàn cục lưu trữ dữ liệu FAQ trong bộ nhớ RAM để quét cho nhanh
let faqMasterData = [];
const CSV_FILE_PATH = path.join(__dirname, 'master_faq.csv');

// 2. HÀM ĐỌC VÀ CHUẨN HÓA DỮ LIỆU TỪ FILE CSV
function loadFaqData() {
    const results = [];
    if (!fs.existsSync(CSV_FILE_PATH)) {
        console.error(`❌ Không tìm thấy file dữ liệu tại: ${CSV_FILE_PATH}`);
        return;
    }

    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (data) => {
            // Chuẩn hóa, xóa bỏ khoảng trắng thừa và ký tự rác ẩn (\r, \n) của từng ô dữ liệu
            const cleanedRow = {};
            Object.keys(data).forEach(key => {
                const cleanKey = key.trim().toLowerCase();
                cleanedRow[cleanKey] = data[key] ? data[key].replace(/[\r\n]/g, '').trim() : '';
            });
            results.push(cleanedRow);
        })
        .on('end', () => {
            faqMasterData = results;
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng dữ liệu FAQ vào RAM.`);
        })
        .on('error', (err) => {
            console.error("❌ Lỗi khi đang đọc file CSV:", err);
        });
}

// Gọi hàm nạp dữ liệu ngay khi khởi động Server
loadFaqData();

// 3. API CHÍNH: XỬ LÝ CÂU HỎI TỪ KHUNG CHAT (ĐỐI KHỚP KÉP CATEGORY & KEYWORDS)
app.post('/api/v1/chatbot/query', (req, res) => {
    try {
        const userQuestion = req.body.question ? req.body.question.toLowerCase().trim() : "";
        const siteId = req.body.site_id ? req.body.site_id.toLowerCase().trim() : "";

        // Kiểm tra dữ liệu đầu vào
        if (!userQuestion || !siteId) {
            return res.status(400).json({ answer: "Thiếu dữ liệu site_id hoặc nội dung câu hỏi." });
        }

        // BƯỚC 1: LỌC THÔ - Chỉ lấy các dòng FAQ có mã site_id trùng với trang đang gọi bot
        const siteData = faqMasterData.filter(row => row.site_id && row.site_id.toLowerCase().trim() === siteId);

        // BƯỚC 2: LOGIC ĐỐI KHỚP KÉP THÔNG MINH
        let matchedRow = siteData.find(row => {
            // Hướng 1: Người dùng bấm NÚT GỢI Ý -> Kiểm tra xem câu hỏi có TRÙNG KHÍT 100% với tên Category không
            const categoryMatch = row.category && row.category.toLowerCase().trim() === userQuestion;
            
            // Hướng 2: Người dùng GÕ TAY -> Tách mảng từ khóa bằng dấu [;] và tìm xem câu gõ có CHỨA từ khóa không
            let keywordMatch = false;
            if (row.keywords) {
                // Tách chuỗi từ khóa bằng các dấu phân cách phổ biến (;, ,, 、)
                const keywordsArray = row.keywords.split(/[,、;]/).map(k => k.trim().toLowerCase());
                // Kiểm tra xem câu hỏi của khách có chứa ít nhất 1 từ khóa hợp lệ không
                keywordMatch = keywordsArray.some(keyword => keyword !== "" && userQuestion.includes(keyword));
            }
            
            // Chỉ cần thỏa mãn 1 trong 2 hướng (Bấm nút danh mục HOẶC Gõ dính từ khóa) là chọn dòng này
            return categoryMatch || keywordMatch;
        });

        // BƯỚC 3: TRẢ KẾT QUẢ VỀ CHO GIAO DIỆN
        if (matchedRow) {
            return res.json({
                answer: matchedRow.answer_text,
                redirect_url: matchedRow.redirect_url || ""
            });
        } else {
            // Câu trả lời mặc định khi không tìm thấy bất kỳ dữ liệu nào trùng khớp
            return res.json({ 
                answer: "申し訳ありません。質問を理解できませんでした。メニューのボタンを押すか、別のキーワードでお試しください。",
                redirect_url: ""
            });
        }

    } catch (error) {
        console.error("🔥 Lỗi nghiêm trọng tại API Query:", error);
        return res.status(500).json({ answer: "❌ Hệ thống trung tâm gặp sự cố. Vui lòng thử lại sau." });
    }
});

// 4. API PHỤ: LÀM TƯƠI DỮ LIỆU (Mỗi khi bạn cập nhật file CSV trên GitHub)
app.get('/api/v1/chatbot/reload', (req, res) => {
    try {
        loadFaqData();
        return res.json({ 
            status: "success", 
            message: "Đã cập nhật và nạp lại toàn bộ dữ liệu từ file CSV mới thành công!" 
        });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Không thể reload dữ liệu." });
    }
});

// Khởi chạy máy chủ
app.listen(PORT, () => {
    console.log(`🚀 Central Server đang chạy trực tuyến tại Port: ${PORT}`);
});
