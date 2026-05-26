// BIẾN FILE CHATBOT THÀNH MỘT HÀM KHỞI TẠO ĐỘNG TOÀN CỤC
window.initCentralChatbot = function (config) {
    // Tự động lấy cấu hình truyền vào, nếu không truyền sẽ mặc định là c-wing
    const SITE_ID = config.site_id || "c-wing"; 
    const SITE_NAME = config.site_name || "C-Wing Chatbot"; 

    // 1. TẠO CSS (Giữ nguyên form cũ chuyên nghiệp của bạn)
    const style = document.createElement('style');
    style.innerHTML = `
        #central-chatbot-widget { position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; }
        #chatbot-bubble { width: 60px; height: 60px; background-color: #007bff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 26px; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.25); transition: transform 0.2s ease; }
        #chatbot-bubble:hover { transform: scale(1.05); }
        #chatbot-box { display: none; width: 360px; height: 480px; background: white; border-radius: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.15); flex-direction: column; overflow: hidden; position: absolute; bottom: 80px; right: 0; border: 1px solid #e1e8ed; }
        #chatbot-header { background: #007bff; color: white; padding: 15px; font-weight: bold; font-size: 16px; display: flex; justify-content: space-between; align-items: center; }
        #chatbot-messages { flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 12px; background: #f8f9fa; }
        .msg { padding: 10px 14px; border-radius: 12px; max-width: 80%; font-size: 14px; line-height: 1.4; word-break: break-word; }
        .msg.bot { background: white; align-self: flex-start; color: #333; box-shadow: 0 1px 3px rgba(0,0,0,0.1); border-bottom-left-radius: 2px; }
        .msg.user { background: #007bff; color: white; align-self: flex-end; border-bottom-right-radius: 2px; }
        #chatbot-footer { display: flex; padding: 12px; border-top: 1px solid #eee; gap: 8px; background: white; }
        #chatbot-input { flex: 1; padding: 10px; border: 1px solid #ccc; border-radius: 6px; outline: none; font-size: 14px; }
        #chatbot-input:focus { border-color: #007bff; }
        #chatbot-send { background: #007bff; color: white; border: none; padding: 10px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; }
        #chatbot-send:hover { background: #0056b3; }
        .chatbot-link { display: inline-block; margin-top: 8px; color: #007bff; text-decoration: underline; font-size: 13px; font-weight: bold; }
    `;
    document.head.appendChild(style);

    // 2. CHÈN GIAO DIỆN HTML (Thay chữ c-wing cố định thành tên động SITE_NAME)
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
                <input type="text" id="chatbot-input" placeholder="質問を入力してください...">
                <button id="chatbot-send">Gửi</button>
            </div>
        </div>
    `;
    document.body.appendChild(widget);

    const bubble = document.getElementById('chatbot-bubble');
    const box = document.getElementById('chatbot-box');
    const closeBtn = document.getElementById('chatbot-close');

    bubble.addEventListener('click', () => {
        box.style.display = (box.style.display === 'none' || box.style.display === '') ? 'flex' : 'none';
        if (box.style.display === 'flex') document.getElementById('chatbot-input').focus();
    });
    closeBtn.addEventListener('click', () => { box.style.display = 'none'; });

    // 3. KẾT NỐI API ĐẾN SERVER LOCAL HOẶC RENDER CỦA BẠN
    // (Bạn nhớ sửa lại link này đúng với link Server thực tế của bạn nhé)
    const API_URL = "https://chatbot-central-api.onrender.com/"; 
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');
    const messagesContainer = document.getElementById('chatbot-messages');

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;
        
        const uDiv = document.createElement('div'); uDiv.className = 'msg user'; uDiv.innerText = text;
        messagesContainer.appendChild(uDiv); input.value = '';
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_id: SITE_ID, question: text }) // Truyền SITE_ID động
            });
            const data = await response.json();
            
            const bDiv = document.createElement('div'); bDiv.className = 'msg bot'; bDiv.innerText = data.answer;
            
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

    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
};
