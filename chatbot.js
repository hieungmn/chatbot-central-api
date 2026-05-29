window.initCentralChatbot = function (config) {
    const SITE_ID = (config && config.site_id) ? config.site_id.trim().toLowerCase() : "c-wing"; 
    const SITE_NAME = (config && config.site_name) ? config.site_name : "Central Chatbot"; 

    const colorMap = {
        "c-wing": "#28a745",   // Xanh lá
        "cansuke": "#fd7e14",  // Cam
        "account": "#007bff",  // Xanh dương
        "s-wing": "#6f42c1"    // Tím
    };
    const PRIMARY_COLOR = colorMap[SITE_ID] || "#007bff";
    const SERVER_BASE_URL = "https://chatbot-central-api.onrender.com";

    const oldWidget = document.getElementById("central-chatbot-widget");
    if (oldWidget) oldWidget.remove();

    async function injectChatbotUI() {
        try {
            // Tải file HTML thuần túy về
            const response = await fetch(`${SERVER_BASE_URL}/chatbot.html`);
            const htmlTemplate = await response.text();

            const tempDiv = document.createElement("div");
            tempDiv.innerHTML = htmlTemplate;
            document.body.appendChild(tempDiv.firstElementChild);

            // Giao diện đã lên, chạy tiếp hàm cài đặt màu sắc và logic bằng JS
            initializeLogic();

        } catch (error) {
            console.error("❌ Không thể nạp file template chatbot.html:", error);
        }
    }

    injectChatbotUI();

    function initializeLogic() {
        const bubble = document.getElementById("chatbot-bubble");
        const box = document.getElementById("chatbot-box");
        const closeBtn = document.getElementById("chatbot-close");
        const input = document.getElementById("chatbot-input");
        const wrapper = document.getElementById("chatbot-input-wrapper");
        const sendBtn = document.getElementById("chatbot-send");
        const header = document.getElementById("chatbot-header");
        const siteNameSpan = document.getElementById("chatbot-site-name");
        const messagesContainer = document.getElementById("chatbot-messages");
        const suggestionsContainer = document.getElementById("chatbot-suggestions");

        // [MỚI]: Ép màu trực tiếp bằng JS cho các khối giao diện chính để triệt tiêu lỗi HTML
        if (bubble) bubble.style.backgroundColor = PRIMARY_COLOR;
        if (header) header.style.backgroundColor = PRIMARY_COLOR;
        if (sendBtn) sendBtn.style.backgroundColor = PRIMARY_COLOR;
        if (siteNameSpan) siteNameSpan.innerText = SITE_NAME;

        if (input && wrapper) {
            input.addEventListener("focus", () => { wrapper.style.borderColor = PRIMARY_COLOR; wrapper.style.backgroundColor = "#fff"; });
            input.addEventListener("blur", () => { wrapper.style.borderColor = "#ccc"; wrapper.style.backgroundColor = "#f8f9fa"; });
        }

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
                        btn.style.color = PRIMARY_COLOR;
                        btn.style.borderColor = PRIMARY_COLOR;

                        btn.addEventListener("click", (e) => {
                            e.stopPropagation();
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

        bubble.addEventListener("click", () => {
            box.style.display = (box.style.display === "none" || box.style.display === "") ? "flex" : "none";
            if (box.style.display === "flex") input.focus();
        });
        closeBtn.addEventListener("click", () => { box.style.display = "none"; });

        async function sendMessage(overrideText) {
            const text = overrideText ? overrideText.trim() : input.value.trim();
            if (!text) return;
            
            const uDiv = document.createElement("div"); 
            uDiv.className = "msg user"; 
            uDiv.innerText = text;
            uDiv.style.backgroundColor = PRIMARY_COLOR; 
            messagesContainer.appendChild(uDiv);
            
            if (!overrideText) input.value = ""; 
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            try {
                const response = await fetch(SERVER_BASE_URL + "/api/v1/chatbot/query", {
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
                    link.style.color = PRIMARY_COLOR; 
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
