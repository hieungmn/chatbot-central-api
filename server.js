const express = require('express');
const cors = require('cors'); 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình CORS mở để các website vệ tinh kết nối được
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Cho phép public các file trong thư mục gốc (để nhúng trực tiếp file JS)
app.use(express.static(__dirname));

let faqMasterData = [];
 
// ==========================================
// HÀM ĐỌC FILE CSV (Giữ nguyên bộ lọc dọn rác của bạn)
// ==========================================
function loadFaqData() {
    const results = [];
    const csvFilePath = path.join(__dirname, 'master_faq.csv');

    if (!fs.existsSync(csvFilePath)) {
        console.error("❌ Không tìm thấy file master_faq.csv! Hãy kiểm tra lại.");
        return;
    }

    fs.createReadStream(csvFilePath)
        .pipe(csv({
            mapHeaders: ({ header }) => header.replace(/^[\uFEFF\xEF\xBB\xBF]+/, '').trim().toLowerCase()
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            faqMasterData = results;
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng dữ liệu từ CSV.`);
        })
        .on('error', (err) => {
            console.error("❌ Lỗi khi đọc file CSV:", err);
        });
}

// Gọi nạp dữ liệu khi khởi động
loadFaqData();

// ==========================================
// API XỬ LÝ CHÁT: ĐỐI KHỚP TỪ KHÓA TĨNH 100%
// ==========================================
app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;

    // Kiểm tra đầu vào an toàn
    if (!site_id || !question) {
        return res.status(400).json({
            status: "error",
            message: "Thiếu tham số site_id hoặc question."
        });
    }

    console.log(`[REQ] Site: ${site_id} | Hỏi: "${question}"`);

    // 1. Lọc dữ liệu theo đúng site_id gửi lên
    const siteSpecificData = faqMasterData.filter(row => 
        row.site_id && row.site_id.trim().toLowerCase() === site_id.trim().toLowerCase()
    );

    let matchedAnswer = "";
    let redirectUrl = "";

    // 2. Duyệt qua danh sách để dò từ khóa tĩnh
    for (const row of siteSpecificData) {
        const cleanKeywords = row.keywords ? row.keywords.replace(/^"|"$/g, '').trim() : "";
        if (!cleanKeywords) continue;

        // Tách các từ khóa dấu phẩy thành mảng để so khớp
        const keywordList = cleanKeywords.split(',').map(k => k.trim().toLowerCase());

        const isMatch = keywordList.some(keyword => {
            if (!keyword) return false;
            return question.toLowerCase().includes(keyword);
        });

        if (isMatch) {
            matchedAnswer = row.answer_text; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 KHỚP TỪ KHÓA: [${keywordList}]`);
            break; 
        }
    }

    // 3. Trả kết quả về cho Frontend
    if (matchedAnswer) {
        return res.json({
            status: "success",
            answer: matchedAnswer,
            redirect_url: redirectUrl
        });
    } else {
        // Câu trả lời mặc định khi không tìm thấy từ khóa tĩnh (Fallback cũ)
        return res.json({
            status: "fallback",
            answer: "Xin lỗi, tôi chưa tìm thấy thông tin phù hợp. Vui lòng thử lại bằng từ khóa khác hoặc liên hệ bộ phận hỗ trợ.",
            redirect_url: ""
        });
    }
});

// API reload dữ liệu nhanh không cần khởi động lại server
app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Đã nạp lại dữ liệu CSV thành công." });
});

app.listen(PORT, () => {
    console.log(`🚀 Server form cũ đang chạy ổn định tại cổng ${PORT}`);
});
