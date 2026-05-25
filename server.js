const express = require('express');
const cors = require('cors'); 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();

// 1. CẤU HÌNH PORT ĐỘNG: Tránh lỗi sập Render khi deploy
const PORT = process.env.PORT || 3000;

// 2. CẤU HÌNH CORS: Cho phép trang jukou-kanri.jp kết nối tự do
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Nơi lưu trữ dữ liệu FAQ tạm thời trong bộ nhớ RAM của Server
let faqMasterData = [];
 
// ==========================================
// HÀM ĐỌC FILE CSV (Sửa chuẩn theo tiêu đề file thật)
// ==========================================
function loadFaqData() {
    const results = [];
    const csvFilePath = path.join(__dirname, 'master_faq.csv');

    if (!fs.existsSync(csvFilePath)) {
        console.error("❌ Không tìm thấy file master_faq.csv! Vui lòng kiểm tra lại trên GitHub.");
        return;
    }

    fs.createReadStream(csvFilePath)
        // Loại bỏ ký tự tàng hình BOM của Excel và ép tiêu đề về chữ thường
        .pipe(csv({
            mapHeaders: ({ header }) => header.replace(/^[\uFEFF\xEF\xBB\xBF]+/, '').trim().toLowerCase()
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            faqMasterData = results;
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng kịch bản từ file CSV thật vào RAM!`);
            
            if (faqMasterData.length > 0) {
                console.log("🔍 [DÒNG 1 THỰC TẾ TRÊN SERVER]:", faqMasterData[0]);
            }
        });
}

// Khởi động nạp dữ liệu
loadFaqData();

// ==========================================
// API XỬ LÝ CHÍNH: Tiếp nhận câu hỏi từ bot
// ==========================================
app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;

    if (!site_id || !question) {
        return res.status(400).json({ status: "error", message: "Thiếu site_id hoặc câu hỏi!" });
    }

    console.log(`📩 Nhận câu hỏi từ [${site_id}]: "${question}"`);

    // Lọc kịch bản theo site_id (ví dụ: 'c-wing')
    const siteFaq = faqMasterData.filter(item => item.site_id && item.site_id.trim().toLowerCase() === site_id.trim().toLowerCase());

    console.log(`🔍 Tìm thấy ${siteFaq.length} câu kịch bản khớp với site_id: [${site_id}]`);

    let matchedAnswer = null;
    let redirectUrl = "";

    // Duyệt tìm từ khóa
// Duyệt tìm từ khóa (Đoạn này thay vào trong file server.js)
    for (const row of siteFaq) {
        if (!row.keywords) continue;

        // 🎯 CẢI TIẾN THÔNG MINH: Loại bỏ hoàn toàn dấu nháy kép " và dấu nháy đơn ' do Excel sinh ra
        const cleanKeywords = row.keywords.replace(/['"“”]/g, '');

        // Tách các từ khóa ra bằng dấu phẩy, sau đó gọt sạch khoảng trắng thừa
        const keywordList = cleanKeywords.split(',').map(k => k.trim().toLowerCase());

        console.log(`👀 Đang đối chiếu với danh sách từ khóa thực tế:`, keywordList);

        // Kiểm tra xem câu hỏi khách gõ có chứa từ khóa nào trong danh sách không
        const isMatch = keywordList.some(keyword => {
            if (!keyword) return false;
            return question.toLowerCase().includes(keyword);
        });

        if (isMatch) {
            matchedAnswer = row.answer_text; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 KHỚP TỪ KHÓA THÀNH CÔNG: [${keywordList}]`);
            break; 
        }
    }

    // TRẢ KẾT QUẢ VỀ CHO CHATBOT
    if (matchedAnswer) {
        return res.json({
            status: "success",
            answer: matchedAnswer,
            redirect_url: redirectUrl
        });
    } else {
        console.log(`⚠️ Không khớp từ khóa nào cho câu: "${question}"`);
        return res.json({
            status: "fallback",
            answer: "Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Hệ thống đang ghi nhận để nâng cấp.",
            redirect_url: ""
        });
    }
});

// API RELOAD
app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Đã cập nhật dữ liệu FAQ mới nhất từ file CSV thật!" });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`🚀 Central Chatbot API đang chạy tại cổng: ${PORT}`);
});
