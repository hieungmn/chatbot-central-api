const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// 1. CẤU HÌNH MIDDLEWARE
app.use(cors()); // Cho phép tất cả các trang vệ tinh kết nối
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Biến toàn cục lưu trữ dữ liệu FAQ trong RAM
let faqMasterData = [];
const CSV_FILE_PATH = path.join(__dirname, 'master_faq.csv');

// 2. HÀM ĐỌC VÀ CHUẨN HÓA DỮ LIỆU TỪ FILE CSV
function loadFaqData() {
    const results = [];
    if (!fs.existsSync(CSV_FILE_PATH)) {
        console.error(`❌ Không tìm thấy file dữ liệu tại: ${CSV_FILE_PATH}`);
        return;
    }

    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (data) => {
            const cleanedRow = {};
            Object.keys(data).forEach(key => {
                const cleanKey = key.trim().toLowerCase();
                cleanedRow[cleanKey] = data[key] ? data[key].replace(/[\r\n]/g, '').trim() : '';
            });
            results.push(cleanedRow);
        })
        .on('end', () => {
            faqMasterData = results;
            console.log(`✅ Đã nạp thành công ${faqMasterData.length} dòng dữ liệu FAQ.`);
        })
        .on('error', (err) => {
            console.error("❌ Lỗi khi đọc file CSV:", err);
        });
}

// Gọi hàm nạp dữ liệu ngay khi khởi động Server
loadFaqData();

// 3. API LẤY DANH SÁCH NÚT GỢI Ý (QUICK REPLIES) TỰ ĐỘNG TỪ FILE CSV
app.get('/api/v1/chatbot/suggestions', (req, res) => {
    try {
        const siteId = req.query.site_id ? req.query.site_id.toLowerCase().trim() : "";
        if (!siteId) return res.json({ categories: [] });

        // Lọc lấy cột category của trang tương ứng
        const categories = faqMasterData
            .filter(row => row.site_id && row.site_id.toLowerCase().trim() === siteId && row.category)
            .map(row => row.category);

        // Loại bỏ các danh mục bị trùng lặp
        const uniqueCategories = [...new Set(categories)];

        return res.json({ categories: uniqueCategories });
    } catch (error) {
        return res.status(500).json({ categories: [] });
    }
});

// 4. API XỬ LÝ CÂU HỎI (VẠN NĂNG - TRẢ VỀ TẤT CẢ CÁC CỘT)
app.post('/api/v1/chatbot/query', (req, res) => {
    try {
        const userQuestion = req.body.question ? req.body.question.toLowerCase().trim() : "";
        const siteId = req.body.site_id ? req.body.site_id.toLowerCase().trim() : "";

        if (!userQuestion || !siteId) {
            return res.status(400).json({ status: "fail", answer_text: "Thiếu dữ liệu đầu vào." });
        }

        // Bước 4.1: Lọc dữ liệu theo trang
        const siteData = faqMasterData.filter(row => row.site_id && row.site_id.toLowerCase().trim() === siteId);

        // Bước 4.2: Logic đối khớp kép thông minh
        let matchedRow = siteData.find(row => {
            // Hướng 1: Khách bấm nút danh mục -> Khớp chính xác 100%
            const categoryMatch = row.category && row.category.toLowerCase().trim() === userQuestion;
            
            // Hướng 2: Khách gõ tay -> Quét xem câu hỏi có chứa từ khóa không
            let keywordMatch = false;
            if (row.keywords) {
                const keywordsArray = row.keywords.split(/[,、;]/).map(k => k.trim().toLowerCase());
                keywordMatch = keywordsArray.some(keyword => keyword !== "" && userQuestion.includes(keyword));
            }
            
            return categoryMatch || keywordMatch;
        });

        // Bước 4.3: Trả kết quả (Cú pháp ...matchedRow tự động lấy hết mọi cột trong CSV)
        if (matchedRow) {
            return res.json({
                status: "success",
                ...matchedRow
            });
        } else {
            return res.json({ 
                status: "fail",
                answer_text: "申し訳ありません。質問を理解できませんでした。メニューのボタンを押すか、別のキーワードでお試しください。"
            });
        }

    } catch (error) {
        console.error("🔥 Lỗi API Query:", error);
        return res.status(500).json({ status: "error", answer_text: "❌ Lỗi hệ thống trung tâm." });
    }
});

// 5. API KHỞI ĐỘNG LẠI DỮ LIỆU TỪ XA
app.get('/api/v1/chatbot/reload', (req, res) => {
    try {
        loadFaqData();
        return res.json({ status: "success", message: "Đã nạp lại dữ liệu CSV thành công!" });
    } catch (error) {
        return res.status(500).json({ status: "error", message: "Không thể reload." });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Central Server trực tuyến tại Port: ${PORT}`);
});
