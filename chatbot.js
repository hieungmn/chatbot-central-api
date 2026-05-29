window.initCentralChatbot = function (config) {
    const SITE_ID = (config && config.site_id) ? config.site_id.trim().toLowerCase() : "c-wing"; 
    const SERVER_BASE_URL = "https://chatbot-central-api.onrender.com";

    const oldWidget = document.getElementById("central-chatbot-widget");
    if (oldWidget) oldWidget.remove();

    async function injectChatbotUI() {
        try {
            const response = await fetch(`${SERVER_BASE_URL}/chatbot.html?v=${Date.now()}`);
            if (!response.ok) throw new Error("Không thể tải file chatbot.html");
            const htmlTemplate = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlTemplate, "text/html");
            
            const styleNode = doc.querySelector("style");
            const widgetNode = doc.getElementById("central-chatbot-widget");

            if (!widgetNode) return;

            if (styleNode) document.head.appendChild(styleNode);
            document.body.appendChild(widgetNode);

            setTimeout(() => { initializeLogic(); }, 50);
        } catch (error) {
            console.error("❌ Lỗi nạp giao diện Chatbot:", error);
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

        let PRIMARY_COLOR = "#007bff"; 

        async function loadChatbotConfig() {
            try {
                const res = await fetch(`${SERVER_BASE_URL}/api/v1/chatbot/config?site_id=${SITE_ID}&v=${Date.now()}`);
                const data = await res.json(); 

                if (data) {
                    if (data.site_name && siteNameSpan) siteNameSpan.innerText = data.site_name;
                    if (data.primary_color) {
                        PRIMARY_COLOR = data.primary_color;
                        if (bubble) { bubble.style.backgroundColor = PRIMARY_COLOR; bubble.style.display = "flex"; }
                        if (header) header.style.backgroundColor = PRIMARY_COLOR;
                        if (sendBtn) sendBtn.style.backgroundColor = PRIMARY_COLOR;
                    }

                    if (suggestionsContainer && data.faqs && data.faqs.length > 0) {
                        suggestionsContainer.innerHTML = "";
                        data.faqs.forEach(faq => {
                            const btn = document.createElement("button");
                            btn.className = "suggest-btn";
                            btn.innerText = faq.question;
                            btn.style.color = PRIMARY_COLOR;
                            btn.style.borderColor = PRIMARY_COLOR;

                            btn.addEventListener("click", (e) => {
                                e.stopPropagation();
                                sendFaqMessage(faq.question, faq.answer, faq.reference_url); 
                            });
                            suggestionsContainer.appendChild(btn);
                        });
                    } else if (suggestionsContainer) {
                        suggestionsContainer.style.display = "none";
                    }
                }
            } catch (e) {
                console.error("❌ Lỗi gọi dữ liệu cấu hình config:", e);
            }
        }

        loadChatbotConfig();

        if (bubble && box) {
            bubble.addEventListener("click", () => {
                box.style.display = (box.style.display === "none" || box.style.display === "") ? "flex" : "none";
                if (box.style.display === "flex" && input) input.focus();
            });
        }
        if (closeBtn && box) closeBtn.addEventListener("click", () => { box.style.display = "none"; });

        // LUỒNG 1: CLICK CÂU HỎI GỢI Ý CÓ SẴN (PHẢN HỒI NGAY LẬP TỨC)
        function sendFaqMessage(qText, aText, rUrl) {
            const uDiv = document.createElement("div"); uDiv.className = "msg user"; uDiv.innerText = qText;
            uDiv.style.backgroundColor = PRIMARY_COLOR; messagesContainer.appendChild(uDiv);
            
            setTimeout(() => {
                const bDiv = document.createElement("div"); bDiv.className = "msg bot"; bDiv.innerText = aText;
                if (rUrl && rUrl.trim() !== "") {
                    const link = document.createElement("a"); link.className = "chatbot-link"; link.href = rUrl.trim(); link.target = "_blank"; link.style.color = PRIMARY_COLOR; link.innerText = "🔗 Chi tiết tại đây";
                    bDiv.appendChild(link);
                }
                messagesContainer.appendChild(bDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 200);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        // LUỒNG 2: TỰ NHẬP CÂU HỎI TỰ DO (GỬI LÊN SERVER ĐỂ AI QUÉT TỪ KHÓA)
        async function sendAIMessage() {
            if (!input) return;
            const text = input.value.trim();
            if (!text) return;
            
            const uDiv = document.createElement("div"); uDiv.className = "msg user"; uDiv.innerText = text;
            uDiv.style.backgroundColor = PRIMARY_COLOR; messagesContainer.appendChild(uDiv);
            input.value = ""; 
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            try {
                const response = await fetch(`${SERVER_BASE_URL}/api/v1/chatbot/query`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ site_id: SITE_ID, question: text }) 
                });
                const data = await response.json();
                
                const bDiv = document.createElement("div"); bDiv.className = "msg bot"; bDiv.innerText = data.answer;
                if (data.reference_url && data.reference_url.trim() !== "") {
                    const link = document.createElement("a"); link.className = "chatbot-link"; link.href = data.reference_url.trim(); link.target = "_blank"; link.style.color = PRIMARY_COLOR; link.innerText = "🔗 Chi tiết tại đây";
                    bDiv.appendChild(link);
                }
                messagesContainer.appendChild(bDiv);
            } catch (error) {
                const eDiv = document.createElement("div"); eDiv.className = "msg bot"; eDiv.innerText = "❌ Lỗi kết nối AI.";
                messagesContainer.appendChild(eDiv);
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        if (sendBtn) sendBtn.addEventListener("click", sendAIMessage);
        if (input) input.addEventListener("keypress", (e) => { if (e.key === "Enter") sendAIMessage(); });
    }
};
