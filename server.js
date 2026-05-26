const express = require('express');
const cors = require('cors'); 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình CORS mở cho mọi nguồn để website jukou-kanri.jp kết nối được
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

let faqMasterData = [];
 
// ==========================================
// HÀM ĐỌC FILE CSV (Tự động dọn rác font và dấu nháy)
// ==========================================
function loadFaqData() {
    const results = [];
    const csvFilePath = path.join(__dirname, 'master_faq.csv');

    if (!fs.existsSync(csvFilePath)) {
        console.error("❌ Không tìm thấy file master_faq.csv! Vui lòng kiểm tra lại vị trí file.");
        return;
    }

    fs.createReadStream(csvFilePath)
        .pipe(csv({
            // Loại bỏ ký tự tàng hình BOM của Excel và đưa tiêu đề cột về chữ thường sạch sẽ
            mapHeaders: ({ header }) => header.replace(/^[\uFEFF\xEF\xBB\xBF]+/, '').trim().toLowerCase()
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            faqMasterData = results;
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng kịch bản từ file CSV!`);
            if (faqMasterData.length > 0) {
                console.log("🔍 [DÒNG ĐẦU TIÊN TRÊN RAM]:", faqMasterData[0]);
            }
        });
}

// Chạy nạp dữ liệu khi khởi động Server
loadFaqData();

// ==========================================
// API XỬ LÝ CHÍNH: Tiếp nhận câu hỏi và khớp từ khóa
// ==========================================
app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;

    if (!site_id || !question) {
        return res.status(400).json({ status: "error", message: "Thiếu site_id hoặc câu hỏi!" });
    }

    console.log(`📩 Nhận câu hỏi từ trang [${site_id}]: "${question}"`);

    // Lọc các dòng kịch bản thuộc về site_id này
    const siteFaq = faqMasterData.filter(item => item.site_id && item.site_id.trim().toLowerCase() === site_id.trim().toLowerCase());
    console.log(`🔍 Tìm thấy ${siteFaq.length} câu kịch bản cho [${site_id}]`);

    let matchedAnswer = null;
    let redirectUrl = "";

    // Duyệt tìm từ khóa bằng bộ lọc thông minh (chấp nhận cả dấu nháy kép của Excel)
    for (const row of siteFaq) {
        if (!row.keywords) continue;

        // 🎯 THUẬT TOÁN LÀM SẠCH: Xóa bỏ tất cả các loại dấu nháy kép "", '' hoặc “” do Excel tự bọc
        const cleanKeywords = row.keywords.replace(/['"“»«”]/g, '');

        // Tách các từ khóa bằng dấu phẩy và gọt sạch khoảng trắng thừa của từng từ
        const keywordList = cleanKeywords.split(',').map(k => k.trim().toLowerCase());

        // Kiểm tra xem khách gõ câu hỏi có chứa từ khóa nào trong danh sách sạch không
        const isMatch = keywordList.some(keyword => {
            if (!keyword) return false;
            return question.toLowerCase().includes(keyword);
        });

        if (isMatch) {
            matchedAnswer = row.answer_text; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 KHỚP THÀNH CÔNG TỪ KHÓA: [${keywordList}]`);
            break; 
        }
    }

    // TRẢ KẾT QUẢ VỀ CHO FRONT-END CHATBOT
    if (matchedAnswer) {
        return res.json({
            status: "success",
            answer: matchedAnswer,
            redirect_url: redirectUrl
        });
    } else {
        console.log(`⚠️ Không tìm thấy từ khóa trùng khớp cho: "${question}"`);
        return res.json({
            status: "fallback",
            answer: "Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Hệ thống đang ghi nhận để nâng cấp.",
            redirect_url: ""
        });
    }
});

// API Ép nạp lại dữ liệu ngay lập tức khi bạn sửa file CSV mà không cần khởi động lại Render
app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Đã cập nhật lại bộ nhớ RAM thành công!" });
});

app.use(express.static(__dirname));

app.listen(PORT, () => {
    console.log(`🚀 Central Chatbot API đang hoạt động tại cổng: ${PORT}`);
});
