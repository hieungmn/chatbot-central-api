window.initCentralChatbot = function (config) {
    const SITE_ID = (config && config.site_id) ? config.site_id.trim().toLowerCase() : "c-wing"; 
    const SITE_NAME = (config && config.site_name) ? config.site_name : "Central Chatbot"; 

    const oldWidget = document.getElementById('central-chatbot-widget');
    if (oldWidget) oldWidget.remove();

    // 1. STYLE CSS (CÓ KHU VỰC CHỨA NÚT GỢI Ý VUỐT NGANG)
    const styleId = 'central-chatbot-style';
    if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.innerHTML = `
            #central-chatbot-widget { position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
            #chatbot-bubble { width: 60px; height: 60px; background-color: #007bff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 26px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.25); transition: transform 0.2s ease; }
            #chatbot-bubble:hover { transform: scale(1.05); }
            #chatbot-box { display: none; width: 360px; height: 500px; background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); flex-direction: column; overflow: hidden; position: absolute; bottom: 80px; right: 0; border: 1px solid #e1e8ed; }
            #chatbot-header { background: #007bff; color: white; padding: 15px; font-weight: bold; font-size: 16px; display: flex; justify-content: space-between; align-items: center; }
            #chatbot-messages { flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: #f8f9fa; }
            .msg { padding: 10px 14px; border-radius: 12px; max-width: 80%; font-size: 14px; line-height: 1.4; word-break: break-word; }
            .msg.bot { background: white; align-self: flex-start; color: #333; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-bottom-left-radius: 2px; }
            .msg.user { background: #007bff; color: white; align-self: flex-end; border-bottom-right-radius: 2px; }
            
            /* Khu vực chứa nút gợi ý bấm nhanh */
            #chatbot-suggestions { display: flex; gap: 8px; padding: 10px; background: #fff; border-top: 1px solid #eee; overflow-x: auto; white-space: nowrap; }
            #chatbot-suggestions::-webkit-scrollbar { height: 4px; }
            #chatbot-suggestions::-webkit-scrollbar-thumb { background: #ccc; border-radius: 2px; }
            .suggest-btn { background: #f0f4f8; color: #007bff; border: 1px solid #d0e3ff; padding: 6px 14px; border-radius: 20px; font-size: 13px; cursor: pointer; transition: all 0.2s ease; font-weight: 500; }
            .suggest-btn:hover { background: #007bff; color: white; border-color: #007bff; }
            
            #chatbot-footer { display: flex; padding: 12px; border-top: 1px solid #eee; gap: 8px; background: white; }
            #chatbot-input { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 6px; outline: none; font-size: 14px; }
            #chatbot-input:focus { border-color: #007bff; }
            #chatbot-send { background: #007bff; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; }
            #chatbot-send:hover { background: #0056b3; }
            .chatbot-link { display: inline-block; margin-top: 8px; color: #007bff; text-decoration: underline; font-size: 13px; font-weight: bold; }
        `;
        document.head.appendChild(style);
    }

    // 2. HTML CẤU TRÚC KHUNG CHAT
    const widget = document.createElement('div');
    widget.id = 'central-chatbot-widget';
    widget.innerHTML = `
        <div id="chatbot-bubble">💬</div>
        <div id="chatbot-box">
            <div id="chatbot-header">
                <span>${SITE_NAME}</span>
                <span id="chatbot-close" style="cursor:pointer; font-size:18px;">×</span>
            </div>
            <div id="chatbot-messages">
                <div class="msg bot">こんにちは！何かご質問はありますか？</div>
            </div>
            
            <div id="chatbot-suggestions"></div>

            <div id="chatbot-footer">
                <input type="text" id="chatbot-input" placeholder="質問を入力してください...">
                <button id="chatbot-send">Gửi</button>
            </div>
        </div>
    `;
    document.body.appendChild(widget);

    const bubble = document.getElementById('chatbot-bubble');
    const box = document.getElementById('chatbot-box');
    const closeBtn = document.getElementById('chatbot-close');
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');
    const messagesContainer = document.getElementById('chatbot-messages');
    const suggestionsContainer = document.getElementById('chatbot-suggestions');

    const API_QUERY_URL = "https://chatbot-central-api.onrender.com/api/v1/chatbot/query"; 
    const API_SUGGEST_URL = `https://chatbot-central-api.onrender.com/api/v1/chatbot/suggestions?site_id=${SITE_ID}`;

    // 3. HÀM TỰ ĐỘNG LOAD VÀ VẼ NÚT GỢI Ý TỪ SERVER RENDER
    async function loadSuggestedPrompts() {
        if (!suggestionsContainer) return;
        try {
            const response = await fetch(API_SUGGEST_URL);
            const data = await response.json();
            suggestionsContainer.innerHTML = ''; // Reset vùng chứa nút

            if (data.categories && data.categories.length > 0) {
                data.categories.forEach(categoryText => {
                    const btn = document.createElement('button');
                    btn.className = 'suggest-btn';
                    btn.innerText = categoryText;
                    btn.addEventListener('click', () => {
                        sendMessage(categoryText); // Bấm nút gửi thẳng tên danh mục lên server
                    });
                    suggestionsContainer.appendChild(btn);
                });
            } else {
                suggestionsContainer.style.display = 'none'; // Ẩn vùng chứa nếu không có danh mục nào
            }
        } catch (e) {
            console.error("❌ Không thể tải danh sách nút gợi ý:", e);
        }
    }

    // Gọi hàm load nút gợi ý ngay khi chạy bot
    loadSuggestedPrompts();

    // 4. XỬ LÝ LOGIC ĐÓNG MỞ
    bubble.addEventListener('click', () => {
        box.style.display = (box.style.display === 'none' || box.style.display === '') ? 'flex' : 'none';
        if (box.style.display === 'flex') input.focus();
    });
    closeBtn.addEventListener('click', () => { box.style.display = 'none'; });

    // 5. HÀM GỬI TIN NHẮN VÀ NHẬN KẾT QUẢ VẠN NĂNG
    async function sendMessage(overrideText) {
        const text = overrideText ? overrideText.trim() : input.value.trim();
        if (!text) return;
        
        const uDiv = document.createElement('div'); uDiv.className = 'msg user'; uDiv.innerText = text;
        messagesContainer.appendChild(uDiv);
        if (!overrideText) input.value = ''; 
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const response = await fetch(API_QUERY_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_id: SITE_ID, question: text }) 
            });
            const data = await response.json();
            
            // Lấy cột answer_text từ server (đã bóc từ file CSV vạn năng)
            const botAnswer = data.answer_text ? data.answer_text : "申し訳ありません。エラーが発生しました。";
            const bDiv = document.createElement('div'); bDiv.className = 'msg bot'; bDiv.innerText = botAnswer;
            
            // Nếu bạn có thêm cột dữ liệu mới (ví dụ: cột tiêng anh english_answer) và mầm mống muốn dùng:
            // if(data.english_answer) { ... xử lý thêm tại đây tùy ý ... }

            if (data.redirect_url && data.redirect_url.trim() !== "") {
                const link = document.createElement('a');
                link.className = 'chatbot-link'; link.href = data.redirect_url.trim(); link.target = '_blank';
                link.innerText = '🔗 Chi tiết tại đây';
                bDiv.appendChild(link);
            }
            messagesContainer.appendChild(bDiv);
        } catch (error) {
            const eDiv = document.createElement('div'); eDiv.className = 'msg bot'; eDiv.innerText = "❌ Lỗi kết nối đến Server.";
            messagesContainer.appendChild(eDiv);
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendBtn.addEventListener('click', () => sendMessage());
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
};
