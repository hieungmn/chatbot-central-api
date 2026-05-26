const express = require('express');
const cors = require('cors'); 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. CẤU HÌNH CORS MỞ ĐỂ ĐA TRANG KẾT NỐI KHÔNG BỊ CHẶN
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());
app.use(express.static(__dirname));

let faqMasterData = [];
 
// 2. HÀM NẠP VÀ LÀM SẠCH DỮ LIỆU FILE CSV CHUYÊN SÂU
function loadFaqData() {
    const results = [];
    const csvFilePath = path.join(__dirname, 'master_faq.csv');

    if (!fs.existsSync(csvFilePath)) {
        console.error("❌ Không tìm thấy file master_faq.csv! Hãy chắc chắn file nằm chung thư mục với server.js");
        return;
    }

    fs.createReadStream(csvFilePath)
        .pipe(csv({
            // Xóa mã BOM tàng hình, xóa ký tự xuống dòng \r \n, chuyển tiêu đề về chữ thường
            mapHeaders: ({ header }) => header.replace(/^[\uFEFF\xEF\xBB\xBF]+/, '').replace(/[\r\n]+/g, '').trim().toLowerCase(),
            // Xóa sạch các ký tự xuống dòng bẩn bên trong từng ô dữ liệu
            mapValues: ({ value }) => typeof value === 'string' ? value.replace(/[\r\n]+/g, '').trim() : value
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            faqMasterData = results;
            console.log(`==========================================`);
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng dữ liệu từ CSV.`);
            if (faqMasterData.length > 0) {
                console.log(`🔍 Các cột nhận diện được: [${Object.keys(faqMasterData[0]).join(', ')}]`);
            }
            console.log(`==========================================`);
        })
        .on('error', (err) => {
            console.error("❌ Lỗi trong quá trình đọc file CSV:", err);
        });
}

// Chạy lệnh nạp dữ liệu ngay khi khởi động server
loadFaqData();

// 3. API TIẾP NHẬN VÀ XỬ LÝ CÂU HỎI TỪ CHATBOT
app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;

    if (!site_id || !question) {
        return res.status(400).json({ status: "error", message: "Thiếu tham số site_id hoặc question." });
    }

    // Chuẩn hóa dữ liệu nhận về (viết thường, xóa khoảng trắng thừa đầu đuôi)
    const cleanSiteId = site_id.trim().toLowerCase();
    const cleanQuestion = question.trim().toLowerCase();

    console.log(`\n📬 [YÊU CẦU MỚI] Từ Site: [${cleanSiteId}] | Câu hỏi: "${question}"`);

    // Bước A: Lọc toàn bộ dữ liệu có site_id trùng khớp trong file CSV
    const siteSpecificData = faqMasterData.filter(row => 
        row.site_id && row.site_id.trim().toLowerCase() === cleanSiteId
    );

    let matchedAnswer = "";
    let redirectUrl = "";

    // Bước B: Duyệt tìm từ khóa khớp với câu hỏi
    for (const row of siteSpecificData) {
        let rawKeywords = row.keywords ? row.keywords.replace(/^"|"$/g, '').trim() : "";
        if (!rawKeywords) continue;

        // Cắt mảng từ khóa (hỗ trợ cả dấu phẩy Anh ',' lẫn dấu phẩy Nhật '、') và xóa khoảng trắng
        const keywordList = rawKeywords
            .split(/[,、]/)
            .map(k => k.trim().toLowerCase())
            .filter(k => k !== "");

        // Kiểm tra xem câu hỏi người dùng có chứa từ khóa nào trong danh sách không
        const isMatch = keywordList.some(keyword => cleanQuestion.includes(keyword));

        if (isMatch) {
            matchedAnswer = row.answer_text; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 KHỚP THÀNH CÔNG -> Từ khóa: [${keywordList}]`);
            break; // Tìm thấy từ khóa đầu tiên khớp là dừng vòng lặp ngay
        }
    }

    // Bước C: Trả kết quả phản hồi về cho Widget Chatbot
    if (matchedAnswer) {
        return res.json({
            status: "success",
            answer: matchedAnswer,
            redirect_url: redirectUrl
        });
    } else {
        console.log(`⚠️ Không tìm thấy từ khóa nào trùng khớp cho site [${cleanSiteId}].`);
        return res.json({
            status: "fallback",
            answer: "Xin lỗi, tôi chưa tìm thấy thông tin phù hợp. Vui lòng thử lại bằng từ khóa khác hoặc liên hệ bộ phận hỗ trợ.",
            redirect_url: ""
        });
    }
});

// 4. API RE_LOAD CẬP NHẬT NHANH DỮ LIỆU CSV (KHÔNG CẦN RESET SERVER)
app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Đã nạp lại dữ liệu CSV mới nhất vào bộ nhớ thành công." });
});

app.listen(PORT, () => {
    console.log(`🚀 Central Server đang vận hành ổn định tại cổng: ${PORT}`);
});
