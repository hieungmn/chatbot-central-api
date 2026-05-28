window.initCentralChatbot = function (config) {
    const SITE_ID = (config && config.site_id) ? config.site_id.trim().toLowerCase() : "c-wing"; 
    const SITE_NAME = (config && config.site_name) ? config.site_name : "Central Chatbot"; 

    const oldWidget = document.getElementById('central-chatbot-widget');
    if (oldWidget) oldWidget.remove();

    // 1. STYLE CSS MỚI: ĐƯA NÚT VÀO TRONG Ô INPUT
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
            
            /* TOÀN BỘ KHU VỰC KHUNG CHỨA FOOTER & Ô NHẬP LIỆU MỚI */
            #chatbot-footer { display: flex; flex-direction: column; padding: 10px; background: white; border-top: 1px solid #eee; }
            
            /* Khối bao bọc toàn bộ ô nhập và nút nổi */
            .input-wrapper { position: relative; display: flex; flex-direction: column; background: #f8f9fa; border: 1px solid #ccc; border-radius: 8px; transition: border-color 0.2s; }
            .input-wrapper:focus-within { border-color: #007bff; background: white; }
            
            /* Ô nhập chữ (bỏ viền bọc ngoài vì đã có wrapper bọc) */
            #chatbot-input { width: 100%; box-sizing: border-box; border: none; background: transparent; padding: 10px 45px 40px 10px; outline: none; font-size: 14px; resize: none; }
            
            /* Vùng chứa các nút gợi ý NỔI LÊN ở góc dưới bên trong ô input */
            #chatbot-suggestions { position: absolute; bottom: 8px; left: 8px; right: 45px; display: flex; gap: 6px; overflow-x: auto; white-space: nowrap; max-width: calc(100% - 15px); }
            #chatbot-suggestions::-webkit-scrollbar { display: none; } /* Ẩn thanh cuộn cho đẹp */
            
            /* Style nút gợi ý nhỏ gọn, tinh tế hơn */
            .suggest-btn { background: #ffffff; color: #495057; border: 1px solid #dee2e6; padding: 4px 10px; border-radius: 12px; font-size: 11px; cursor: pointer; transition: all 0.15s ease; font-weight: 500; box-shadow: 0 1px 2px rgba(0,0,0,0.05); }
            .suggest-btn:hover { background: #007bff; color: white; border-color: #007bff; }
            
            /* Nút Gửi nằm nổi ở góc phải trong ô input */
            #chatbot-send { position: absolute; bottom: 6px; right: 8px; background: #007bff; color: white; border: none; width: 30px; height: 30px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; display: flex; align-items: center; justify-content: center; padding: 0; }
            #chatbot-send:hover { background: #0056b3; }
            .chatbot-link { display: inline-block; margin-top: 8px; color: #007bff; text-decoration: underline; font-size: 13px; font-weight: bold; }
        `;
        document.head.appendChild(style);
    }

    // 2. HTML CẤU TRÚC: ĐƯA SỰ KIỆN NÚT VÀO TRONG WRAPPER
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
            
            <div id="chatbot-footer">
                <div class="input-wrapper">
                    <input type="text" id="chatbot-input" placeholder="質問を入力してください...">
                    
                    <div id="chatbot-suggestions"></div>
                    
                    <button id="chatbot-send">➔</button>
                </div>
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

    // 3. HÀM TỰ ĐỘNG LOAD VÀ VẼ NÚT GỢI Ý NỔI TỪ SERVER
    async function loadSuggestedPrompts() {
        if (!suggestionsContainer) return;
        try {
            const response = await fetch(API_SUGGEST_URL);
            const data = await response.json();
            suggestionsContainer.innerHTML = ''; 

            if (data.categories && data.categories.length > 0) {
                data.categories.forEach(categoryText => {
                    const btn = document.createElement('button');
                    btn.className = 'suggest-btn';
                    btn.innerText = categoryText;
                    btn.addEventListener('click', (e) => {
                        e.stopPropagation(); // Ngăn chặn sự kiện click lan ra ngoài làm mất focus
                        sendMessage(categoryText); 
                    });
                    suggestionsContainer.appendChild(btn);
                });
            } else {
                suggestionsContainer.style.display = 'none';
                input.style.paddingBottom = "10px"; // Trả lại padding bình thường nếu không có nút gợi ý
            }
        } catch (e) {
            console.error("❌ Không thể tải danh sách nút gợi ý:", e);
        }
    }

    loadSuggestedPrompts();

    // 4. LOGIC ĐÓNG MỞ
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
            
            const botAnswer = data.answer_text ? data.answer_text : "申し訳ありません。エラーが発生しました。";
            const bDiv = document.createElement('div'); bDiv.className = 'msg bot'; bDiv.innerText = botAnswer;

            if (data.redirect_url && data.redirect_url.trim() !== "") {
                const link = document.createElement('a');
                link.className = 'chatbot-link'; link.href = data.redirect_url.trim(); link.target = '_blank';
                link.innerText = '🔗 Chi tiết tại đây';
                bDiv.appendChild(link);
            }
            messagesContainer.appendChild(bDiv);
        } catch (error) {
            const eDiv = document.createElement('div'); eDiv.appendChild(eDiv);
            eDiv.className = 'msg bot'; eDiv.innerText = "❌ Lỗi kết nối đến Server.";
        }
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    sendBtn.addEventListener('click', () => sendMessage());
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
};
