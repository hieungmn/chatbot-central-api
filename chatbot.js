(function () {

    window.initCentralChatbot = function (config) {

        const SITE_ID =
            config?.site_id?.trim().toLowerCase() || 'c-wing';

        const SITE_NAME =
            config?.site_name || 'Central Chatbot';

        const oldWidget =
            document.getElementById('central-chatbot-widget');

        if (oldWidget) oldWidget.remove();

        // ===============================
        // CSS
        // ===============================

        const styleId = 'central-chatbot-style';

        if (!document.getElementById(styleId)) {

            const style = document.createElement('style');

            style.id = styleId;

            style.innerHTML = `
                #central-chatbot-widget{
                    position:fixed;
                    bottom:20px;
                    right:20px;
                    z-index:999999;
                    font-family:Arial,sans-serif;
                }

                #chatbot-bubble{
                    width:60px;
                    height:60px;
                    border-radius:50%;
                    background:#007bff;
                    color:white;
                    display:flex;
                    align-items:center;
                    justify-content:center;
                    cursor:pointer;
                    font-size:28px;
                }

                #chatbot-box{
                    display:none;
                    width:360px;
                    height:500px;
                    background:white;
                    border-radius:12px;
                    overflow:hidden;
                    position:absolute;
                    bottom:80px;
                    right:0;
                    box-shadow:0 5px 20px rgba(0,0,0,0.2);
                    flex-direction:column;
                }

                #chatbot-header{
                    background:#007bff;
                    color:white;
                    padding:15px;
                    font-weight:bold;
                    display:flex;
                    justify-content:space-between;
                }

                #chatbot-messages{
                    flex:1;
                    overflow-y:auto;
                    padding:15px;
                    background:#f5f5f5;
                    display:flex;
                    flex-direction:column;
                    gap:10px;
                }

                .msg{
                    padding:10px 14px;
                    border-radius:12px;
                    max-width:80%;
                    font-size:14px;
                    line-height:1.5;
                    word-break:break-word;
                }

                .msg.user{
                    background:#007bff;
                    color:white;
                    align-self:flex-end;
                }

                .msg.bot{
                    background:white;
                    color:#333;
                    align-self:flex-start;
                }

                #chatbot-footer{
                    display:flex;
                    padding:10px;
                    gap:10px;
                    border-top:1px solid #ddd;
                }

                #chatbot-input{
                    flex:1;
                    padding:10px;
                }

                #chatbot-send{
                    background:#007bff;
                    color:white;
                    border:none;
                    padding:10px 16px;
                    cursor:pointer;
                }

                .chatbot-link{
                    display:block;
                    margin-top:8px;
                    color:#007bff;
                }
            `;

            document.head.appendChild(style);
        }

        // ===============================
        // HTML
        // ===============================

        const widget = document.createElement('div');

        widget.id = 'central-chatbot-widget';

        widget.innerHTML = `
            <div id="chatbot-bubble">💬</div>

            <div id="chatbot-box">

                <div id="chatbot-header">
                    <span>${SITE_NAME}</span>
                    <span id="chatbot-close" style="cursor:pointer;">✕</span>
                </div>

                <div id="chatbot-messages">
                    <div class="msg bot">
                        こんにちは！ご質問はありますか？
                    </div>
                </div>

                <div id="chatbot-footer">
                    <input id="chatbot-input" placeholder="Nhập câu hỏi..." />
                    <button id="chatbot-send">Gửi</button>
                </div>

            </div>
        `;

        document.body.appendChild(widget);

        // ===============================
        // ELEMENTS
        // ===============================

        const bubble = document.getElementById('chatbot-bubble');
        const box = document.getElementById('chatbot-box');
        const closeBtn = document.getElementById('chatbot-close');
        const input = document.getElementById('chatbot-input');
        const sendBtn = document.getElementById('chatbot-send');
        const messages = document.getElementById('chatbot-messages');

        // ===============================
        // API
        // ===============================

        const API_URL =
            'https://chatbot-central-api.onrender.com/api/v1/chatbot/query';

        // ===============================
        // OPEN/CLOSE
        // ===============================

        bubble.onclick = () => {

            box.style.display =
                box.style.display === 'flex'
                    ? 'none'
                    : 'flex';
        };

        closeBtn.onclick = () => {
            box.style.display = 'none';
        };

        // ===============================
        // SEND MESSAGE
        // ===============================

        async function sendMessage() {

            const text = input.value.trim();

            if (!text) return;

            const userDiv = document.createElement('div');

            userDiv.className = 'msg user';
            userDiv.innerText = text;

            messages.appendChild(userDiv);

            input.value = '';

            messages.scrollTop = messages.scrollHeight;

            try {

                const response = await fetch(API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        site_id: SITE_ID,
                        question: text
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const data = await response.json();

                const botDiv = document.createElement('div');

                botDiv.className = 'msg bot';

                botDiv.innerText =
                    data.answer || 'Không có phản hồi';

                if (data.redirect_url) {

                    const link = document.createElement('a');

                    link.className = 'chatbot-link';
                    link.href = data.redirect_url;
                    link.target = '_blank';

                    link.innerText = '🔗 Xem chi tiết';

                    botDiv.appendChild(link);
                }

                messages.appendChild(botDiv);

            } catch (err) {

                console.error(err);

                const errDiv = document.createElement('div');

                errDiv.className = 'msg bot';

                errDiv.innerText =
                    '❌ Server đang offline hoặc lỗi API';

                messages.appendChild(errDiv);
            }

            messages.scrollTop = messages.scrollHeight;
        }

        sendBtn.onclick = sendMessage;

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                sendMessage();
            }
        });
    };

})();
