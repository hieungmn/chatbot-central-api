const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// ===============================
// CONFIG
// ===============================

app.use(cors({
    origin: '*',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
}));

app.use(express.json());

let faqMasterData = [];

// ===============================
// NORMALIZE TEXT
// ===============================

function normalize(str) {
    return String(str || '')
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '');
}

// ===============================
// LOAD CSV
// ===============================

function loadFaqData() {

    return new Promise((resolve, reject) => {

        const results = [];

        const csvFilePath = path.join(__dirname, 'master_faq.csv');

        if (!fs.existsSync(csvFilePath)) {
            console.error('❌ Không tìm thấy master_faq.csv');
            return reject('CSV NOT FOUND');
        }

        fs.createReadStream(csvFilePath)
            .pipe(csv({
                mapHeaders: ({ header }) =>
                    header
                        .replace(/^[\uFEFF\xEF\xBB\xBF]+/, '')
                        .replace(/[\r\n]+/g, '')
                        .trim()
                        .toLowerCase(),

                mapValues: ({ value }) =>
                    typeof value === 'string'
                        ? value.replace(/[\r\n]+/g, '').trim()
                        : value
            }))
            .on('data', (data) => {
                results.push(data);
            })

            .on('end', () => {

                faqMasterData = results;

                console.log('==============================');
                console.log(`✅ CSV loaded: ${faqMasterData.length} rows`);

                if (faqMasterData.length > 0) {
                    console.log('📌 Columns:', Object.keys(faqMasterData[0]));
                }

                console.log('==============================');

                resolve();
            })

            .on('error', (err) => {
                console.error('❌ CSV ERROR:', err);
                reject(err);
            });
    });
}

// ===============================
// HEALTH CHECK
// ===============================

app.get('/', (req, res) => {
    res.send('✅ CHATBOT API RUNNING');
});

// ===============================
// CHATBOT API
// ===============================

app.post('/api/v1/chatbot/query', (req, res) => {

    try {

        console.log('\n==============================');
        console.log('📩 NEW REQUEST');
        console.log(req.body);

        const { site_id, question } = req.body;

        if (!site_id || !question) {
            return res.status(400).json({
                status: 'error',
                answer: 'Thiếu site_id hoặc question'
            });
        }

        const cleanSiteId = normalize(site_id);
        const cleanQuestion = normalize(question);

        const siteSpecificData = faqMasterData.filter(row =>
            normalize(row.site_id) === cleanSiteId
        );

        console.log(`🔍 Site matched rows: ${siteSpecificData.length}`);

        let matchedAnswer = '';
        let redirectUrl = '';

        for (const row of siteSpecificData) {

            const rawKeywords = row.keywords || '';

            if (!rawKeywords) continue;

            const keywordList = rawKeywords
                .split(/[,、]/)
                .map(k => normalize(k))
                .filter(Boolean);

            const isMatch = keywordList.some(keyword =>
                cleanQuestion.includes(keyword)
            );

            if (isMatch) {

                matchedAnswer = row.answer_text || '';
                redirectUrl = row.redirect_url || '';

                console.log('🎯 MATCH FOUND');
                console.log(keywordList);

                break;
            }
        }

        if (matchedAnswer) {

            return res.json({
                status: 'success',
                answer: matchedAnswer,
                redirect_url: redirectUrl
            });

        } else {

            console.log('⚠️ NO MATCH');

            return res.json({
                status: 'fallback',
                answer: 'Xin lỗi, tôi chưa tìm thấy thông tin phù hợp.',
                redirect_url: ''
            });
        }

    } catch (err) {

        console.error('❌ SERVER ERROR:', err);

        return res.status(500).json({
            status: 'error',
            answer: 'Lỗi server.'
        });
    }
});

// ===============================
// RELOAD CSV
// ===============================

app.get('/api/v1/chatbot/reload', async (req, res) => {

    try {

        await loadFaqData();

        res.json({
            status: 'success',
            message: 'Reload CSV thành công'
        });

    } catch (err) {

        res.status(500).json({
            status: 'error',
            message: 'Reload thất bại'
        });
    }
});

// ===============================
// START SERVER
// ===============================

loadFaqData()
    .then(() => {

        app.listen(PORT, () => {
            console.log(`🚀 Server running at PORT ${PORT}`);
        });

    })
    .catch(err => {
        console.error('❌ FAILED TO START:', err);
    });
