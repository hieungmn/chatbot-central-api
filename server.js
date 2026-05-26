const express = require('express');
const cors = require('cors'); 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Cấu hình CORS mở cho mọi nguồn kết nối
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static(__dirname));

let faqMasterData = [];
 
// ==========================================
// HÀM ĐỌC FILE CSV (Đã tối ưu hóa mapHeaders)
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

// Khởi động nạp dữ liệu từ CSV
loadFaqData();

// ==========================================
// API CHÍNH: XỬ LÝ CHÁT (SIÊU CHUẨN TỪ KHÓA)
// ==========================================
app.post('/api/v1/chatbot/query', (req, res) => {
    let { site_id, question } = req.body;

    if (!site_id || !question) {
        return res.status(400).json({
            status: "error",
            message: "Thiếu tham số site_id hoặc question."
        });
    }

    // Làm sạch dữ liệu đầu vào từ client để tránh lệch pha chữ hoa/chữ thường
    const cleanSiteId = site_id.trim().toLowerCase();
    const cleanQuestion = question.trim().toLowerCase();

    console.log(`=== [REQ] Site: [${cleanSiteId}] | Câu hỏi: "${question}" ===`);

    // 1. Lọc dữ liệu FAQ chuẩn theo đúng site_id
    const siteSpecificData = faqMasterData.filter(row => 
        row.site_id && row.site_id.trim().toLowerCase() === cleanSiteId
    );

    let matchedAnswer = "";
    let redirectUrl = "";

    // 2. Tiến hành duyệt từ khóa tĩnh với bộ dọn rác thông minh
    for (const row of siteSpecificData) {
        // Loại bỏ dấu ngoặc kép bọc ngoài trường (nếu có)
        let rawKeywords = row.keywords ? row.keywords.replace(/^"|"$/g, '').trim() : "";
        if (!rawKeywords) continue;

        // BỘ DỌN RÁC THÔNG MINH: Chấp nhận cả dấu phẩy Anh (,) và dấu phẩy Nhật (、)
        // Sau đó tự động cắt bỏ toàn bộ khoảng trắng thừa của từng từ khóa bằng .trim()
        const keywordList = rawKeywords
            .split(/[,、]/)
            .map(k => k.trim().toLowerCase())
            .filter(k => k !== ""); // Loại bỏ các ô rỗng do gõ thừa dấu phẩy

        // Log thám tử hiển thị danh sách từ khóa đã được dọn sạch rác
        console.log(`🔍 Đang quét hàng dữ liệu. Từ khóa sạch: [${keywordList}]`);

        // Kiểm tra xem câu hỏi có chứa bất kỳ từ khóa nào trong danh sách sạch không
        const isMatch = keywordList.some(keyword => {
            const checkResult = cleanQuestion.includes(keyword);
            console.log(`   > Thử từ khóa: "${keyword}" -> Kết quả khớp: ${checkResult}`);
            return checkResult;
        });

        if (isMatch) {
            matchedAnswer = row.answer_text; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 KHỚP THÀNH CÔNG! Đang lấy câu trả lời.`);
            break; 
        }
    }

    // 3. Phản hồi kết quả về Frontend
    if (matchedAnswer) {
        return res.json({
            status: "success",
            answer: matchedAnswer,
            redirect_url: redirectUrl
        });
    } else {
        console.log(`⚠️ Không tìm thấy từ khóa nào khớp trong toàn bộ file CSV của site [${cleanSiteId}].`);
        return res.json({
            status: "fallback",
            answer: "Xin lỗi, tôi chưa tìm thấy thông tin phù hợp. Vui lòng thử lại bằng từ khóa khác hoặc liên hệ bộ phận hỗ trợ.",
            redirect_url: ""
        });
    }
});

// API Ép nạp lại dữ liệu CSV không cần khởi động lại Server
app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Dữ liệu CSV đã được cập nhật lại thành công vào bộ nhớ." });
});

app.listen(PORT, () => {
    console.log(`🚀 Server Central (Bản Chuẩn Tối Ưu) đang chạy mượt mà tại cổng ${PORT}`);
});
