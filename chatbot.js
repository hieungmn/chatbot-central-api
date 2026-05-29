window.initCentralChatbot = function (config) {
    const SITE_ID = (config && config.site_id) ? config.site_id.trim().toLowerCase() : "c-wing"; 
    const SITE_NAME = (config && config.site_name) ? config.site_name : "Central Chatbot"; 

    // Bảng cấu hình màu sắc thương hiệu theo yêu cầu
    const colorMap = {
        "c-wing": "#28a745",
        "cansuke": "#fd7e14",
        "account": "#007bff",
        "s-wing": "#6f42c1"
    };
    const PRIMARY_COLOR = colorMap[SITE_ID] || "#007bff";
    const SERVER_BASE_URL = "https://chatbot-central-api.onrender.com";

    // Xóa widget cũ để tránh trùng lặp giao diện
    const oldWidget = document.getElementById("central-chatbot-widget");
    if (oldWidget) oldWidget.remove();

    // Hàm tải giao diện HTML từ server và đổi màu động
    async function injectChatbotUI() {
        try {
            const response = await fetch(`${SERVER_BASE_URL}/chatbot.html`);
            let htmlTemplate = await response.text();

            // Thay thế các biến chờ bằng dữ liệu cấu hình thực tế
            htmlTemplate = htmlTemplate.replace(/{{PRIMARY_COLOR}}/g, PRIMARY_COLOR);
            htmlTemplate = htmlTemplate.replace(/{{SITE_NAME}}/g, SITE_NAME);

            // Tạo thẻ Div tạm để chuyển chuỗi thành DOM Node
            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlTemplate;
            
            // Đẩy giao diện vào cuối thẻ body
            document.body.appendChild(tempDiv.firstElementChild);

            // Kích hoạt toàn bộ sự kiện logic sau khi HTML xuất hiện
            initializeLogic();

        } catch (error) {
            console.error("❌ Không thể nạp file template chatbot.html:", error);
        }
    }

    // Chạy tải giao diện
    injectChatbotUI();

    // Hàm khởi tạo toàn bộ sự kiện logic của khung chat
    function initializeLogic() {
        const bubble = document.getElementById("chatbot-bubble");
        const box = document.getElementById("chatbot-box");
        const closeBtn = document.getElementById("chatbot-close");
        const input = document.getElementById("chatbot-input");
        const sendBtn = document.getElementById("chatbot-send");
        const messagesContainer = document.getElementById("chatbot-messages");
        const suggestionsContainer = document.getElementById("chatbot-suggestions");

        // Tự động load danh mục từ CSV để làm nút bấm nổi trong ô Input
        async function loadSuggestedPrompts() {
            if (!suggestionsContainer) return;
            try {
                const res = await fetch(`${SERVER_BASE_URL}/api/v1/chatbot/suggestions?site_id=${SITE_ID}`);
                const data = await res.json();
                suggestionsContainer.innerHTML = ""; 

                if (data.categories && data.categories.length > 0) {
                    data.categories.forEach(categoryText => {
                        const btn = document.createElement("button");
                        btn.className = "suggest-btn";
                        btn.innerText = categoryText;
                        btn.addEventListener("click", (e) => {
                            e.stopPropagation(); // Giữ focus cho ô Input
                            sendMessage(categoryText); 
                        });
                        suggestionsContainer.appendChild(btn);
                    });
                } else {
                    suggestionsContainer.style.display = "none";
                    input.style.paddingBottom = "10px"; 
                }
            } catch (e) {
                console.error("❌ Không thể tải danh sách nút gợi ý:", e);
            }
        }

        loadSuggestedPrompts();

        // Sự kiện đóng mở khung chat
        bubble.addEventListener("click", () => {
            box.style.display = (box.style.display === "none" || box.style.display === "") ? "flex" : "none";
            if (box.style.display === "flex") input.focus();
        });
        closeBtn.addEventListener("click", () => { box.style.display = "none"; });

        // Hàm xử lý gửi tin nhắn vạn năng
        async function sendMessage(overrideText) {
            const text = overrideText ? overrideText.trim() : input.value.trim();
            if (!text) return;
            
            const uDiv = document.createElement("div"); 
            uDiv.className = "msg user"; 
            uDiv.innerText = text;
            messagesContainer.appendChild(uDiv);
            
            if (!overrideText) input.value = ""; 
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            try {
                const response = await fetch(`${SERVER_BASE_URL}/api/v1/chatbot/query`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ site_id: SITE_ID, question: text }) 
                });
                const data = await response.json();
                
                const botAnswer = data.answer_text ? data.answer_text : "申し訳ありません。エラーが発生しました。";
                const bDiv = document.createElement("div"); 
                bDiv.className = "msg bot"; 
                bDiv.innerText = botAnswer;

                if (data.redirect_url && data.redirect_url.trim() !== "") {
                    const link = document.createElement("a");
                    link.className = "chatbot-link"; 
                    link.href = data.redirect_url.trim(); 
                    link.target = "_blank";
                    link.innerText = "🔗 Chi tiết tại đây";
                    bDiv.appendChild(link);
                }
                messagesContainer.appendChild(bDiv);
            } catch (error) {
                const eDiv = document.createElement("div"); 
                eDiv.className = "msg bot"; 
                eDiv.innerText = "❌ Lỗi kết nối đến Server.";
                messagesContainer.appendChild(eDiv);
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        sendBtn.addEventListener("click", () => sendMessage());
        input.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });
    }
};
