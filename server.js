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
app.use(express.static(__dirname));

let faqMasterData = [];
 
// ==========================================
// HÀM ĐỌC FILE CSV (BẢN DIỆT SẠCH RÁC TÀNG HÌNH \r \n BOM)
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
            // 1. Làm sạch tên cột (Xóa BOM, xóa khoảng trắng, xóa ký tự \r)
            mapHeaders: ({ header }) => header.replace(/^[\uFEFF\xEF\xBB\xBF]+/, '').replace(/[\r\n]+/g, '').trim().toLowerCase(),
            // 2. Làm sạch luôn dữ liệu bên trong từng ô (Xóa \r \n thừa của Windows)
            mapValues: ({ value }) => typeof value === 'string' ? value.replace(/[\r\n]+/g, '').trim() : value
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            faqMasterData = results;
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng dữ liệu từ CSV.`);
            if(faqMasterData.length > 0) {
                console.log("🔍 Cấu trúc cột thực tế nhận được:", Object.keys(faqMasterData[0]));
            }
        })
        .on('error', (err) => {
            console.error("❌ Lỗi khi đọc file CSV:", err);
        });
}

loadFaqData();

// ==========================================
// API CHÍNH: XỬ LÝ CHÁT (ĐỐI KHỚP TỪ KHÓA AN TOÀN)
// ==========================================
app.post('/api/v1/chatbot/query', (req, res) => {
    let { site_id, question } = req.body;

    if (!site_id || !question) {
        return res.status(400).json({ status: "error", message: "Thiếu tham số site_id hoặc question." });
    }

    const cleanSiteId = site_id.trim().toLowerCase();
    const cleanQuestion = question.trim().toLowerCase();

    console.log(`=== [REQ] Site: [${cleanSiteId}] | Câu hỏi: "${question}" ===`);

    // 1. Lọc theo site_id an toàn
    const siteSpecificData = faqMasterData.filter(row => 
        row.site_id && row.site_id.trim().toLowerCase() === cleanSiteId
    );

    let matchedAnswer = "";
    let redirectUrl = "";

    // 2. Quét từ khóa
    for (const row of siteSpecificData) {
        let rawKeywords = row.keywords ? row.keywords.replace(/^"|"$/g, '').trim() : "";
        if (!rawKeywords) continue;

        // Tách từ khóa bằng dấu phẩy Anh hoặc Nhật, loại bỏ ô rỗng
        const keywordList = rawKeywords
            .split(/[,、]/)
            .map(k => k.trim().toLowerCase())
            .filter(k => k !== "");

        console.log(`🔍 Đang quét hàng dữ liệu của site [${cleanSiteId}]. Danh sách từ khóa: [${keywordList}]`);

        const isMatch = keywordList.some(keyword => {
            const checkResult = cleanQuestion.includes(keyword);
            console.log(`   > Thử từ khóa: "${keyword}" -> Kết quả: ${checkResult}`);
            return checkResult;
        });

        if (isMatch) {
            matchedAnswer = row.answer_text; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 KHỚP THÀNH CÔNG!`);
            break; 
        }
    }

    // 3. Trả kết quả
    if (matchedAnswer) {
        return res.json({
            status: "success",
            answer: matchedAnswer,
            redirect_url: redirectUrl
        });
    } else {
        console.log(`⚠️ Không tìm thấy từ khóa nào khớp.`);
        return res.json({
            status: "fallback",
            answer: "Xin lỗi, tôi chưa tìm thấy thông tin phù hợp. Vui lòng thử lại bằng từ khóa khác hoặc liên hệ bộ phận hỗ trợ.",
            redirect_url: ""
        });
    }
});

app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Dữ liệu CSV đã được cập nhật lại thành công." });
});

app.listen(PORT, () => {
    console.log(`🚀 Server Central đang chạy ổn định tại cổng ${PORT}`);
});
