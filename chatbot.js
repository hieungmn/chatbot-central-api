(function () {
    // 1. TỰ ĐỘNG BƠM STYLE VÀO TRANG WEB (CSS)
    const style = document.createElement('style');
    style.innerHTML = `
        #central-chatbot-widget { position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: Arial, sans-serif; }
        #chatbot-bubble { width: 60px; height: 60px; background-color: #007bff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-size: 24px; cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.2); }
        #chatbot-box { display: none; width: 350px; height: 450px; background: white; border-radius: 10px; box-shadow: 0 5px 15px rgba(0,0,0,0.3); flex-direction: column; overflow: hidden; position: absolute; bottom: 80px; right: 0; }
        #chatbot-header { background: #007bff; color: white; padding: 15px; font-weight: bold; }
        #chatbot-messages { flex: 1; padding: 15px; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; }
        .msg { padding: 8px 12px; border-radius: 8px; max-width: 80%; font-size: 14px; word-break: break-word; }
        .msg.bot { background: #f1f5f9; align-self: flex-start; color: #333; }
        .msg.user { background: #007bff; color: white; align-self: flex-end; }
        #chatbot-footer { display: flex; padding: 10px; border-top: 1px solid #eee; gap: 5px; }
        #chatbot-input { flex: 1; padding: 8px; border: 1px solid #ccc; border-radius: 4px; outline: none; }
        #chatbot-send { background: #007bff; color: white; border: none; padding: 8px 15px; border-radius: 4px; cursor: pointer; }
    `;
    document.head.appendChild(style);

    // 2. LẤY NHÃN SITE_ID TỪ MÃ NHÚNG
    const currentScript = document.currentScript || document.querySelector('script[data-site]');
    const siteId = currentScript ? currentScript.getAttribute('data-site') : 'default';

    // 3. TẠO CẤU TRÚC GIAO DIỆN (HTML)
    const widget = document.createElement('div');
    widget.id = 'central-chatbot-widget';
    widget.innerHTML = `
        <div id="chatbot-bubble">💬</div>
        <div id="chatbot-box">
            <div id="chatbot-header">Trợ lý ảo (${siteId.toUpperCase()})</div>
            <div id="chatbot-messages">
                <div class="msg bot">Xin chào! Tôi có thể giúp gì cho bạn tại trang ${siteId} không?</div>
            </div>
            <div id="chatbot-footer">
                <input type="text" id="chatbot-input" placeholder="Nhập câu hỏi tại đây...">
                <button id="chatbot-send">Gửi</button>
            </div>
        </div>
    `;
    document.body.appendChild(widget);

    // 4. SỰ KIỆN ẨN / HIỆN HỘP THOẠI CHAT
    const bubble = document.getElementById('chatbot-bubble');
    const box = document.getElementById('chatbot-box');
    bubble.addEventListener('click', () => {
        box.style.display = box.style.display === 'none' || box.style.display === '' ? 'flex' : 'none';
    });

    // 5. XỬ LÝ GỬI TIN NHẮN LÊN CENTRAL API SERVER
    const input = document.getElementById('chatbot-input');
    const sendBtn = document.getElementById('chatbot-send');
    const messagesContainer = document.getElementById('chatbot-messages');

    // CẤU HÌNH ĐƯỜNG LINK SERVER THẬT CỦA BẠN Ở ĐÂY
    const API_URL = "https://chatbot-central-api.onrender.com/api/v1/chatbot/query"; 

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        // Vẽ tin nhắn của Người dùng lên màn hình
        appendMessage(text, 'user');
        input.value = '';

        try {
            // Gọi API lên Render
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ site_id: siteId, question: text })
            });
            const data = await response.json();

            // Vẽ tin nhắn trả lời của Bot lên màn hình
            appendMessage(data.answer, 'bot');

            // Nếu có link điều hướng kèm theo, tự động mở link sau 1.5 giây
            if (data.redirect_url) {
                appendMessage(`👉 Hệ thống đang chuyển hướng bạn đến: ${data.redirect_url}`, 'bot');
                setTimeout(() => { window.location.href = data.redirect_url; }, 1500);
            }

        } catch (error) {
            appendMessage("❌ Lỗi kết nối đến Server trung tâm.", 'bot');
        }
    }

    function appendMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = `msg ${sender}`;
        msgDiv.innerText = text;
        messagesContainer.appendChild(msgDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight; // Tự động cuộn xuống tin nhắn mới nhất
    }

    // Bắt sự kiện Click nút hoặc Ấn phím Enter
    sendBtn.addEventListener('click', sendMessage);
    input.addEventListener('keypress', (e) => { if (e.key === 'Enter') sendMessage(); });
})();