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
            console.log(`✅ Đã nạp ${faqMasterData.length} dòng kịch bản!`);
        });
}
loadFaqData();

app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;
    console.log(`\n--- CÓ TIN NHẮN MỚI ---`);
    console.log(`📩 Khách hỏi: "${question}" (Từ trang: ${site_id})`);

    const siteFaq = faqMasterData.filter(item => item.site_id && item.site_id.trim() === site_id.trim());
    
    let matchedAnswer = null;
    let redirectUrl = "";

    for (const row of siteFaq) {
        if (!row.keywords) continue;

        // Bóc tách từ khóa từ file CSV chuẩn
        const keywordList = row.keywords.split(',').map(k => k.trim());
        
        console.log(`🕵️ Đang kiểm tra với bộ từ khóa:`, keywordList);

        const isMatch = keywordList.some(keyword => question.includes(keyword));

        if (isMatch) {
            matchedAnswer = row.answer_text; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 ĐÃ TÌM THẤY CÂU TRẢ LỜI!`);
            break; 
        }
    }

    if (matchedAnswer) {
        return res.json({ status: "success", answer: matchedAnswer, redirect_url: redirectUrl });
    } else {
        console.log(`⚠️ BÓT CHƯA HIỂU CÂU NÀY.`);
        return res.json({ status: "fallback", answer: "Xin lỗi, tôi chưa hiểu câu hỏi của bạn.", redirect_url: "" });
    }
});

app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Đã nạp lại file CSV mới!" });
});

app.listen(PORT, () => { console.log(`🚀 API chạy tại cổng: ${PORT}`); });
