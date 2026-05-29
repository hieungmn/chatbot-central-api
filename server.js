const express = require('express');
const cors = require('cors');
const fs = require('fs');
const csv = require('csv-parser'); // Đảm bảo đã chạy: npm install csv-parser
const app = express();

app.use(cors());
app.use(express.json());

const CSV_FILE_PATH = './chatbot_master_db.csv'; // Đường dẫn tới file CSV mới của bạn

// API CẤU HÌNH MỚI: Đọc file CSV, lọc dữ liệu theo site_id và trả về cho Frontend
app.get('/api/v1/chatbot/config', (req, res) => {
    const targetSiteId = req.query.site_id ? req.query.site_id.trim().toLowerCase() : '';
    const resultData = {
        site_id: targetSiteId,
        site_name: '',
        primary_color: '',
        faqs: []
    };

    if (!targetSiteId) {
        return res.status(400).json({ error: 'Thiếu site_id' });
    }

    // Đọc file CSV dạng dòng luồng (Stream)
    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
            if (row.site_id && row.site_id.trim().toLowerCase() === targetSiteId) {
                // Lấy thông tin cấu hình chung từ dòng đầu tiên khớp được
                if (!resultData.site_name) {
                    resultData.site_name = row.site_name;
                    resultData.primary_color = row.primary_color;
                }
                
                // Gom tất cả các câu hỏi thuộc site này vào mảng faqs
                resultData.faqs.push({
                    faq_id: row.faq_id,
                    category: row.category,
                    question: row.question,
                    answer: row.answer,
                    reference_url: row.reference_url,
                    valid: row.valid
                });
            }
        })
        .on('end', () => {
            if (!resultData.site_name) {
                return res.status(404).json({ error: 'Không tìm thấy cấu hình cho site_id này' });
            }
            res.json(resultData);
        })
        .on('error', (err) => {
            console.error('Lỗi đọc file CSV:', err);
            res.status(500).json({ error: 'Lỗi server không đọc được database' });
        });
});

// API XỬ LÝ CÂU HỎI TỰ DO (PHẦN B AI MỞ RỘNG)
app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;
    let matchedAnswer = null;

    if (!site_id || !question) {
        return res.status(400).json({ error: 'Thiếu dữ liệu đầu vào' });
    }

    const userQuestion = question.toLowerCase().trim();

    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
            if (row.site_id && row.site_id.trim().toLowerCase() === site_id.trim().toLowerCase()) {
                // Chiến lược AI cơ bản: Quét xem câu hỏi của User có chứa từ khóa (keywords) trong CSV không
                const keywords = row.keywords ? row.keywords.toLowerCase().split(',') : [];
                const isMatch = keywords.some(keyword => userQuestion.includes(keyword.trim()));

                if (isMatch && row.valid == "1") {
                    matchedAnswer = {
                        answer: row.answer,
                        reference_url: row.reference_url
                    };
                }
            }
        })
        .on('end', () => {
            if (matchedAnswer) {
                res.json(matchedAnswer);
            } else {
                res.json({ 
                    answer: "申し訳ありません。Câu hỏi của bạn hệ thống chưa có dữ liệu. Bạn có thể thử các câu hỏi gợi ý bên dưới nhé!",
                    reference_url: ""
                });
            }
        });
});

app.listen(5000, () => console.log('🚀 Server chatbot đang chạy ở cổng 5000'));
