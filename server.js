const express = require('express');
const cors = require('cors'); 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();

// 🎯 ĐÃ SỬA CỔNG PORT: Để Render tự cấp cổng chạy online
const PORT = process.env.PORT || 3000;

// Cấu hình CORS mở toang cửa cho phép mọi website kết nối vào
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Nơi lưu trữ dữ liệu FAQ tạm thời trong bộ nhớ RAM của Server
let faqMasterData = [];
 
// ==========================================
// HÀM ĐỌC FILE CSV (Nạp dữ liệu khi khởi động)
// ==========================================
function loadFaqData() {
    const results = [];
    const csvFilePath = path.join(__dirname, 'master_faq.csv');

    // Kiểm tra xem file CSV có tồn tại không
    if (!fs.existsSync(csvFilePath)) {
        console.error("❌ Không tìm thấy file master_faq.csv! Vui lòng tạo file trước.");
        return;
    }

    fs.createReadStream(csvFilePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
            faqMasterData = results;
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng kịch bản từ file CSV vào RAM!`);
        });
}

// Chạy hàm nạp dữ liệu ngay khi bật Server
loadFaqData();

// ==========================================
// API XỬ LÝ CHÍNH: Tiếp nhận câu hỏi từ các site
// ==========================================
app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;

    // Kiểm tra tính hợp lệ của dữ liệu đầu vào
    if (!site_id || !question) {
        return res.status(400).json({ status: "error", message: "Thiếu site_id hoặc câu hỏi!" });
    }

    console.log(`📩 Nhận câu hỏi từ [${site_id}]: "${question}"`);

    // LỌC DỮ LIỆU: Chỉ lấy các hàng kịch bản thuộc về site_id này
    const siteFaq = faqMasterData.filter(item => item.site_id && item.site_id.trim().toLowerCase() === site_id.trim().toLowerCase());

    let matchedAnswer = null;
    let redirectUrl = "";

    // ĐỐI KHỚP TỪ KHÓA (Cấp độ 1)
    for (const row of siteFaq) {
        if (!row.keywords) continue;

        // Tách các từ khóa từ cột keywords (cách nhau bởi dấu phẩy) thành một mảng
        const keywordList = row.keywords.split(',').map(k => k.trim().toLowerCase());

        // Kiểm tra xem câu hỏi của khách có chứa từ khóa nào trong danh sách không
        const isMatch = keywordList.some(keyword => question.toLowerCase().includes(keyword));

        if (isMatch) {
            // 🎯 ĐÃ SỬA: Lấy đúng cột 'answer' từ file CSV
            matchedAnswer = row.answer; 
            redirectUrl = row.redirect_url || "";
            break; // Tìm thấy từ khóa phù hợp đầu tiên thì dừng lại luôn
        }
    }

    // TRẢ KẾT QUẢ VỀ CHO FRONT-END
    if (matchedAnswer) {
        return res.json({
            status: "success",
            answer: matchedAnswer,
            redirect_url: redirectUrl
        });
    } else {
        // FALLBACK: Khi không tìm thấy từ khóa ở Cấp độ 1
        return res.json({
            status: "fallback",
            answer: "Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Hệ thống đang ghi nhận để nâng cấp.",
            redirect_url: ""
        });
    }
});

// ==========================================
// API LÀM TƯƠI: Nhân viên sửa file CSV xong, gọi API này để update kịch bản ngay lập tức
// ==========================================
app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Đã cập nhật dữ liệu FAQ mới nhất!" });
});

// Cho phép tải công khai các file như chatbot.js từ Server
app.use(express.static(__dirname));

// Khởi chạy Server ở cổng thích ứng
app.listen(PORT, () => {
    console.log(`🚀 Central Chatbot API đang chạy tại cổng: ${PORT}`);
});
