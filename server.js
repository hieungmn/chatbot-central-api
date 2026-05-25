const express = require('express');
const cors = require('cors'); 
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();

// 1. CẤU HÌNH PORT ĐỘNG: Để Render tự cấp cổng chạy online, tránh lỗi sập Server
const PORT = process.env.PORT || 3000;

// 2. CẤU HÌNH CORS: Mở toang cửa cho phép mọi website (bao gồm jukou-kanri.jp) kết nối vào
app.use(cors({
    origin: '*', 
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

// Nơi lưu trữ dữ liệu FAQ tạm thời trong bộ nhớ RAM của Server
let faqMasterData = [];
 
// ==========================================
// HÀM ĐỌC FILE CSV (Đã nâng cấp chống lỗi Excel BOM)
// ==========================================
function loadFaqData() {
    const results = [];
    const csvFilePath = path.join(__dirname, 'master_faq.csv');

    // Kiểm tra xem file CSV có tồn tại không
    if (!fs.existsSync(csvFilePath)) {
        console.error("❌ Không tìm thấy file master_faq.csv! Vui lòng kiểm tra lại trên GitHub.");
        return;
    }

    fs.createReadStream(csvFilePath)
        // 🎯 ĐOẠN QUAN TRỌNG: Tự động phát hiện và gọt sạch ký tự tàng hình (BOM) do Excel tự sinh ra
        // Đồng thời ép tên tiêu đề cột về chữ thường (site_id, keywords, answer, redirect_url)
        .pipe(csv({
            mapHeaders: ({ header }) => header.replace(/^[\uFEFF\xEF\xBB\xBF]+/, '').trim().toLowerCase()
        }))
        .on('data', (data) => results.push(data))
        .on('end', () => {
            faqMasterData = results;
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng kịch bản từ file CSV vào RAM!`);
            
            // 🕵️ LOG GIÁN ĐIỆP 1: In thử dòng đầu tiên lên Render Logs để kiểm tra font chữ có bị lỗi không
            if (faqMasterData.length > 0) {
                console.log("🔍 [KIỂM TRA DÒNG ĐẦU TIÊN]:", faqMasterData[0]);
            }
        });
}

// Chạy hàm nạp dữ liệu ngay khi bật Server
loadFaqData();

// ==========================================
// API XỬ LÝ CHÍNH: Tiếp nhận câu hỏi từ các site
// ==========================================
app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;

    // Kiểm tra tính hợp lệ của dữ liệu đầu vào
    if (!site_id || !question) {
        return res.status(400).json({ status: "error", message: "Thiếu site_id hoặc câu hỏi!" });
    }

    console.log(`📩 Nhận câu hỏi từ [${site_id}]: "${question}"`);

    // LỌC DỮ LIỆU: Chỉ lấy các hàng kịch bản thuộc về site_id này
    const siteFaq = faqMasterData.filter(item => item.site_id && item.site_id.trim().toLowerCase() === site_id.trim().toLowerCase());

    // 🕵️ LOG GIÁN ĐIỆP 2: Kiểm tra xem Server lọc được bao nhiêu câu cho mã site này
    console.log(`🔍 Hệ thống tìm thấy ${siteFaq.length} câu kịch bản khớp với site_id: [${site_id}]`);

    let matchedAnswer = null;
    let redirectUrl = "";

    // ĐỐI KHỚP TỪ KHÓA (Cấp độ 1)
    for (const row of siteFaq) {
        if (!row.keywords) continue;

        // Tách các từ khóa từ cột keywords (cách nhau bởi dấu phẩy) thành một mảng
        const keywordList = row.keywords.split(',').map(k => k.trim().toLowerCase());

        // Kiểm tra xem câu hỏi của khách có chứa từ khóa nào trong danh sách không
        const isMatch = keywordList.some(keyword => question.toLowerCase().includes(keyword));

        if (isMatch) {
            // Lấy cột 'answer' từ file CSV (đã chuẩn hóa tiêu đề chữ thường)
            matchedAnswer = row.answer; 
            redirectUrl = row.redirect_url || "";
            console.log(`🎯 KHỚP TỪ KHÓA THÀNH CÔNG! Đang chuẩn bị gửi câu trả lời về web.`);
            break; 
        }
    }

    // TRẢ KẾT QUẢ VỀ CHO FRONT-END
    if (matchedAnswer) {
        return res.json({
            status: "success",
            answer: matchedAnswer,
            redirect_url: redirectUrl
        });
    } else {
        // FALLBACK: Khi không tìm thấy từ khóa trùng khớp
        console.log(`⚠️ Không tìm thấy từ khóa khớp cho câu: "${question}". Trả về câu Fallback mặc định.`);
        return res.json({
            status: "fallback",
            answer: "Xin lỗi, tôi chưa hiểu câu hỏi của bạn. Hệ thống đang ghi nhận để nâng cấp.",
            redirect_url: ""
        });
    }
});

// ==========================================
// API LÀM TƯƠI: Nhân viên sửa file CSV xong, gọi API này để update kịch bản ngay lập tức
// ==========================================
app.get('/api/v1/chatbot/reload', (req, res) => {
    loadFaqData();
    res.json({ status: "success", message: "Đã cập nhật dữ liệu FAQ mới nhất!" });
});

// Cho phép tải công khai các file tĩnh như chatbot.js từ thư mục gốc
app.use(express.static(__dirname));

// Khởi chạy Server ở cổng thích ứng của Render
app.listen(PORT, () => {
    console.log(`🚀 Central Chatbot API đang chạy tại cổng: ${PORT}`);
});
