const express = require('express');
const cors = require('cors'); 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*', methods: ['GET', 'POST'], allowedHeaders: ['Content-Type'] }));
app.use(express.json());

let faqMasterData = [];
 
function loadFaqData() {
    const results = [];
    const csvFilePath = path.join(__dirname, 'master_faq.csv');

    if (!fs.existsSync(csvFilePath)) {
        console.log("❌ KHÔNG TÌM THẤY FILE CSV!");
        return;
    }

    fs.createReadStream(csvFilePath)
        .pipe(csv({ mapHeaders: ({ header }) => header.replace(/^[\uFEFF\xEF\xBB\xBF]+/, '').trim().toLowerCase() }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            faqMasterData = results;
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng kịch bản từ file CSV!`);
        });
}
loadFaqData();

app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;
    console.log(`\n--- CÓ TIN NHẮN MỚI ---`);
    console.log(`📩 Khách hỏi: "${question}" (Từ trang: ${site_id})`);

    // Lọc kịch bản theo site_id (không phân biệt hoa thường)
    const siteFaq = faqMasterData.filter(item => item.site_id && item.site_id.trim().toLowerCase() === site_id.trim().toLowerCase());
    
    let matchedAnswer = null;
    let redirectUrl = "";

    for (const row of siteFaq) {
        if (!row.keywords) continue;

        // 1. Làm sạch các loại dấu nháy kép rác do Excel tự sinh ra
        const cleanKeywords = row.keywords.replace(/['"“»«”]/g, '');

        // 2. 🎯 THUẬT TOÁN VẠN NĂNG: Tách bằng cả dấu phẩy (,) VÀ dấu chấm phẩy (;) để chấp nhận mọi kiểu file dữ liệu
        const keywordList = cleanKeywords.split(/[,;]/).map(k => k.trim()).filter(Boolean);
        
        console.log(`🕵️ Đang kiểm tra bộ từ khóa thực tế (Đã bổ nhỏ):`, keywordList);

        // 3. So khớp từ khóa (không phân biệt chữ hoa chữ thường)
        const isMatch = keywordList.some(keyword => {
            if (!keyword) return false;
            return question.toLowerCase().includes(keyword.toLowerCase());
        });

        if (isMatch) {
            // Đề phòng bạn đổi tên cột, lấy cột answer_text hoặc answer đều được
            matchedAnswer = row.answer_text || row.answer; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 ĐÃ TÌM THẤY CÂU TRẢ LỜI HỢP LỆ!`);
            break; 
        }
    }

    if (matchedAnswer) {
        return res.json({ status: "success", answer: matchedAnswer, redirect_url: redirectUrl });
    } else {
        console.log(`⚠️ BÓT CHƯA HIỂU CÂU NÀY.`);
        return res.json({ status: "fallback", answer: "Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Hệ thống đang ghi nhận để nâng cấp.", redirect_url: "" });
    }
});

app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Đã nạp lại file CSV mới thành công!" });
});

app.use(express.static(__dirname));

app.listen(PORT, () => { console.log(`🚀 Central Chatbot API chạy tại cổng: ${PORT}`); });
