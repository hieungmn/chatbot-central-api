const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
app.use(cors());
app.use(express.json());

// Cho phép gọi trực tiếp file tĩnh như chatbot.html, chatbot.js từ trình duyệt
app.use(express.static(__dirname));

const CSV_FILE_PATH = path.join(__dirname, 'master_faq.csv');

// 1. API LẤY CẤU HÌNH MÀU SẮC & NÚT GỢI Ý ĐỘNG TỪ CSV
app.get('/api/v1/chatbot/config', (req, res) => {
    const targetSiteId = req.query.site_id ? req.query.site_id.trim().toLowerCase() : '';
    
    if (!targetSiteId) {
        return res.status(400).json({ error: 'Thiếu tham số site_id' });
    }

    const resultData = {
        site_id: targetSiteId,
        site_name: '',
        primary_color: '',
        faqs: []
    };

    if (!fs.existsSync(CSV_FILE_PATH)) {
        return res.status(500).json({ error: 'Không tìm thấy file master_faq.csv trên server' });
    }

    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
            if (row.site_id && row.site_id.trim().toLowerCase() === targetSiteId) {
                // Lấy thông tin cấu hình của trang ở dòng đầu tiên tìm thấy
                if (!resultData.site_name) {
                    resultData.site_name = row.site_name;
                    resultData.primary_color = row.primary_color;
                }
                // Gom tất cả các câu hỏi được đánh dấu valid = 1
                if (row.valid == "1" || row.valid == 1) {
                    resultData.faqs.push({
                        faq_id: row.faq_id,
                        category: row.category,
                        question: row.question,
                        answer: row.answer,
                        reference_url: row.reference_url
                    });
                }
            }
        })
        .on('end', () => {
            if (!resultData.site_name) {
                return res.status(404).json({ error: 'Không tìm thấy dữ liệu cho site_id này' });
            }
            res.json(resultData);
        })
        .on('error', (err) => {
            res.status(500).json({ error: 'Lỗi trong quá trình xử lý file dữ liệu' });
        });
});

// 2. API XỬ LÝ CÂU HỎI TỰ DO CỦA USER (MỞ RỘNG AI PHẦN B)
app.post('/api/v1/chatbot/query', (req, res) => {
    const { site_id, question } = req.body;

    if (!site_id || !question) {
        return res.status(400).json({ error: 'Thiếu site_id hoặc câu hỏi' });
    }

    const userQuestion = question.toLowerCase().trim();
    let matchedFaq = null;

    fs.createReadStream(CSV_FILE_PATH)
        .pipe(csv())
        .on('data', (row) => {
            if (row.site_id && row.site_id.trim().toLowerCase() === site_id.trim().toLowerCase() && (row.valid == "1" || row.valid == 1)) {
                // Thuật toán AI cơ bản: Quét kiểm tra cụm từ khóa (keywords)
                const keywords = row.keywords ? row.keywords.toLowerCase().split(',') : [];
                const isMatch = keywords.some(keyword => userQuestion.includes(keyword.trim()));

                if (isMatch) {
                    matchedFaq = {
                        answer: row.answer,
                        reference_url: row.reference_url
                    };
                }
            }
        })
        .on('end', () => {
            if (matchedFaq) {
                res.json(matchedFaq);
            } else {
                // Phản hồi dự phòng khi AI không hiểu hoặc từ khóa không khớp
                res.json({
                    answer: "申し訳ありません。Câu hỏi chưa có trong hệ thống dữ liệu AI. Bạn vui lòng thử chọn các câu hỏi nhanh bên dưới nhé!",
                    reference_url: ""
                });
            }
        });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server đang hoạt động ổn định tại cổng ${PORT}`));
