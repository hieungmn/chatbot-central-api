const express = require('express');
const cors = require('cors'); 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

let faqMasterData = [];
 
// ==========================================
// HÀM ĐỌC FILE CSV (Nâng cấp bộ lọc dọn rác dữ liệu)
// ==========================================
function loadFaqData() {
    const results = [];
    const csvFilePath = path.join(__dirname, 'master_faq.csv');

    if (!fs.existsSync(csvFilePath)) {
        console.error("❌ Không tìm thấy file master_faq.csv!");
        return;
    }

    fs.createReadStream(csvFilePath)
        .pipe(csv({
            mapHeaders: ({ header }) => header.replace(/^[\uFEFF\xEF\xBB\xBF]+/, '').trim().toLowerCase()
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            faqMasterData = results;
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng kịch bản từ file CSV!`);
        });
}

loadFaqData();

// ==========================================
// API XỬ LÝ CHÍNH (Thuật toán đối khớp tối ưu)
// ==========================================
app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;

    if (!site_id || !question) {
        return res.status(400).json({ status: "error", message: "Thiếu site_id hoặc câu hỏi!" });
    }

    console.log(`📩 Nhận câu hỏi từ [${site_id}]: "${question}"`);

    // Lọc kịch bản theo site_id chuẩn xác
    const siteFaq = faqMasterData.filter(item => item.site_id && item.site_id.trim().toLowerCase() === site_id.trim().toLowerCase());
    console.log(`🔍 Số câu kịch bản tìm thấy cho [${site_id}]: ${siteFaq.length} câu`);

    let matchedAnswer = null;
    let redirectUrl = "";

    // Duyệt tìm từ khóa bóc tách thông minh
    for (const row of siteFaq) {
        if (!row.keywords) continue;

        // 🎯 THUẬT TOÁN ĐÃ NÂNG CẤP: Gọt sạch toàn bộ các loại dấu nháy kép/nháy đơn quấy nhiễu chuỗi
        const cleanKeywords = row.keywords.replace(/['"“”]/g, '');

        // Tách từ khóa ra bằng dấu phẩy và xóa bỏ khoảng trắng thừa
        const keywordList = cleanKeywords.split(',').map(k => k.trim().toLowerCase());

        console.log(`🕵️ Đang so khớp với danh sách từ khóa đã làm sạch:`, keywordList);

        // Kiểm tra xem câu hỏi người dùng gõ (ví dụ: "申込") có chứa từ khóa nào không
        const isMatch = keywordList.some(keyword => {
            if (!keyword) return false;
            // Chuyển câu hỏi về chữ thường để so sánh không phân biệt hoa thường
            return question.toLowerCase().includes(keyword);
        });

        if (isMatch) {
            matchedAnswer = row.answer_text; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 KHỚP TỪ KHÓA THÀNH CÔNG!`);
            break; 
        }
    }

    // TRẢ KẾT QUẢ VỀ FRONT-END
    if (matchedAnswer) {
        return res.json({
            status: "success",
            answer: matchedAnswer,
            redirect_url: redirectUrl
        });
    } else {
        console.log(`⚠️ Không tìm thấy từ khóa trùng khớp.`);
        return res.json({
            status: "fallback",
            answer: "Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Hệ thống đang ghi nhận để nâng cấp.",
            redirect_url: ""
        });
    }
});

app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Đã cập nhật lại RAM!" });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`🚀 Central Chatbot API đang chạy tại cổng: ${PORT}`);
});
