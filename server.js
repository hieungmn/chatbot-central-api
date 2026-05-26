const express = require('express');
const cors = require('cors'); 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// === [CẤP ĐỘ 3]: BỔ SUNG THƯ VIỆN AI VÀ DOTENV ===
const { OpenAI } = require('openai');
require('dotenv').config(); // Đọc cấu hình API Key từ file .env bảo mật

const app = express();
const PORT = process.env.PORT || 3000;

// === [CẤP ĐỘ 3]: KHỞI TẠO ĐỐI TƯỢNG OPENAI ===
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Cấu hình CORS mở cho mọi nguồn để website jukou-kanri.jp kết nối được
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Cho phép public file static (để các website bên ngoài có thể nhúng trực tiếp file chatbot-widget.js)
app.use(express.static(__dirname));

let faqMasterData = [];
 
// ==========================================
// HÀM ĐỌC FILE CSV (Giữ nguyên logic dọn rác của bạn)
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

// Chạy nạp dữ liệu ban đầu
loadFaqData();

// ==========================================
// API CHÍNH: XỬ LÝ CÂU HỎI (HYBRID WORKFLOW)
// ==========================================
app.post('/api/v1/chatbot/query', async (req, res) => {
    const { site_id, question } = req.body;

    if (!site_id || !question) {
        return res.status(400).json({
            status: "error",
            message: "Thiếu tham số site_id hoặc question trong yêu cầu."
        });
    }

    console.log(`=== NHẬN REQ: Site [${site_id}] | Câu hỏi: "${question}" ===`);

    // Lọc riêng dữ liệu FAQ thuộc về website đang gọi (Giữ nguyên logic của bạn)
    const siteSpecificData = faqMasterData.filter(row => row.site_id && row.site_id.trim().toLowerCase() === site_id.trim().toLowerCase());

    let matchedAnswer = "";
    let redirectUrl = "";

    // --- BƯỚC 1: ĐỐI KHỚP TỪ KHÓA TĨNH (CẤP ĐỘ 1 CHẠY TRƯỚC) ---
    for (const row of siteSpecificData) {
        const cleanKeywords = row.keywords ? row.keywords.replace(/^"|"$/g, '').trim() : "";
        if (!cleanKeywords) continue;

        const keywordList = cleanKeywords.split(',').map(k => k.trim().toLowerCase());

        const isMatch = keywordList.some(keyword => {
            if (!keyword) return false;
            return question.toLowerCase().includes(keyword);
        });

        if (isMatch) {
            matchedAnswer = row.answer_text; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 CẤP ĐỘ 1: KHỚP TỪ KHÓA TĨNH -> [${keywordList}]`);
            break; 
        }
    }

    // Nếu khớp từ khóa tĩnh -> Trả kết quả ngay lập tức (Tốc độ cao, chi phí = 0)
    if (matchedAnswer) {
        return res.json({
            status: "success",
            answer: matchedAnswer,
            redirect_url: redirectUrl
        });
    }

    // --- BƯỚC 2: KÍCH HOẠT AI TẠO SINH (CẤP ĐỘ 3) KHI KHÔNG KHỚP TỪ KHÓA ---
    console.log(`⚠️ Không khớp từ khóa tĩnh. Đang kích hoạt Trí tuệ nhân tạo (AI Mode)...`);

    // Lấy thông tin luật rào chắn ai_context của riêng website này từ file CSV
    const defaultSiteRow = siteSpecificData.find(row => row.ai_context && row.ai_context.trim() !== "");
    const siteAiContext = defaultSiteRow ? defaultSiteRow.ai_context : "Hãy trả lời khách hàng lịch sự, bằng ngôn ngữ họ sử dụng.";

    try {
        // Gọi API OpenAI (Sử dụng model gpt-4o-mini siêu nhanh và tối ưu chi phí)
        const chatCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `Bạn là trợ lý ảo chăm sóc khách hàng của trang web [${site_id}].
                             Bạn bắt buộc phải trả lời người dùng dựa trên quy định nghiêm ngặt của công ty sau đây.
                             
                             【QUY TẮC KINH DOANH VÀ NGỮ CẢNH】:
                             ${siteAiContext}
                             
                             【CHỈ THỊ AN TOÀN CHỐNG AI NÓI DỐI (HALLUCINATION)】:
                             1. Hãy hành văn tự nhiên, mượt mà và ngắn gọn (Ưu tiên dùng kính ngữ Nhật Bản です/ます nếu ngữ cảnh tiếng Nhật).
                             2. Nếu câu hỏi của khách hàng nằm ngoài phạm vi quy định doanh nghiệp được cung cấp ở trên, hoặc bạn không biết chắc chắn, TUYỆT ĐỐI không tự bịa ra thông tin, chính sách hoặc giá cả. Hãy trả lời chính xác câu sau:
                             "Xin lỗi, tôi không có thông tin về vấn đề này. Vui lòng liên hệ trung tâm hỗ trợ để được giải đáp chi tiết."`
                },
                {
                    role: "user",
                    content: question
                }
            ],
            temperature: 0.2, // Đặt độ sáng tạo thấp (0.2) để AI không nói hớ, luôn bám sát kịch bản
        });

        const aiReply = chatCompletion.choices[0].message.content;
        console.log(`🤖 AI PHẢN HỒI THÀNH CÔNG: "${aiReply}"`);

        return res.json({
            status: "ai_generated",
            answer: aiReply,
            redirect_url: defaultSiteRow ? defaultSiteRow.redirect_url : "" 
        });

    } catch (aiError) {
        console.error("❌ Lỗi API OpenAI:", aiError);
        // Phương án dự phòng an toàn nếu AI mất kết nối hoặc hết hạn token
        return res.json({
            status: "fallback",
            answer: "Xin lỗi, tôi chưa hiểu rõ câu hỏi của bạn. Vui lòng liên hệ trung tâm hỗ trợ để được giải đáp chi tiết.",
            redirect_url: ""
        });
    }
});

// API Ép nạp lại dữ liệu CSV
app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({
        status: "success",
        message: "Dữ liệu CSV đã được nạp lại thành công vào bộ nhớ."
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Central Server Cấp độ 3 đang chạy ổn định tại http://localhost:${PORT}`);
});
