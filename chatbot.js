window.initCentralChatbot = function (config) {
    const SITE_ID = (config && config.site_id) ? config.site_id.trim().toLowerCase() : "c-wing"; 
    const SERVER_BASE_URL = "https://chatbot-central-api.onrender.com";

    // Xóa widget cũ nếu có để tránh trùng lặp
    const oldWidget = document.getElementById("central-chatbot-widget");
    if (oldWidget) oldWidget.remove();

    // 1. Hàm tải giao diện HTML từ Server Render
    async function injectChatbotUI() {
        try {
            const response = await fetch(`${SERVER_BASE_URL}/chatbot.html?v=${Date.now()}`);
            if (!response.ok) throw new Error("Không thể fetch file chatbot.html");
            const htmlTemplate = await response.text();

            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlTemplate, "text/html");
            
            const styleNode = doc.querySelector("style");
            const widgetNode = doc.getElementById("central-chatbot-widget");

            if (!widgetNode) {
                console.error("❌ Không tìm thấy thẻ #central-chatbot-widget!");
                return;
            }

            if (styleNode) document.head.appendChild(styleNode);
            document.body.appendChild(widgetNode);

            // Chờ DOM cập nhật rồi cấu hình dữ liệu động từ Database CSV
            setTimeout(() => {
                initializeLogic();
            }, 50);

        } catch (error) {
            console.error("❌ Không thể nạp file template:", error);
        }
    }

    injectChatbotUI();

    // 2. HÀM KHỞI TẠO LOGIC VÀ ĐỒNG BỘ DATA NEW
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

        let PRIMARY_COLOR = "#007bff"; // Màu mặc định dự phòng

        // TẢI CẤU HÌNH VÀ CÂU HỎI GỢI Ý TỪ DATABASE MỚI
        async function loadChatbotConfig() {
            try {
                // Gọi API lấy dữ liệu đã lọc theo site_id từ file CSV mới
                const res = await fetch(`${SERVER_BASE_URL}/api/v1/chatbot/config?site_id=${SITE_ID}`);
                const data = await res.json(); 
                // Kỳ vọng data trả về dạng: { site_name: "...", primary_color: "...", faqs: [...] }

                if (data) {
                    // Cập nhật tên site và màu sắc động từ chính file CSV, không lo phải sửa cứng trong code nữa!
                    if (data.site_name && siteNameSpan) siteNameSpan.innerText = data.site_name;
                    if (data.primary_color) {
                        PRIMARY_COLOR = data.primary_color;
                        if (bubble) { bubble.style.backgroundColor = PRIMARY_COLOR; bubble.style.display = "flex"; }
                        if (header) header.style.backgroundColor = PRIMARY_COLOR;
                        if (sendBtn) sendBtn.style.backgroundColor = PRIMARY_COLOR;
                    }

                    // Đổ dữ liệu câu hỏi vào các nút gợi ý nhanh (Chỉ lấy các câu có valid = 1)
                    if (suggestionsContainer && data.faqs && data.faqs.length > 0) {
                        suggestionsContainer.innerHTML = "";
                        data.faqs.forEach(faq => {
                            if (faq.valid == 1 || faq.valid == "1") {
                                const btn = document.createElement("button");
                                btn.className = "suggest-btn";
                                btn.innerText = faq.question; // Lấy cột question từ file dữ liệu mới
                                btn.style.color = PRIMARY_COLOR;
                                btn.style.borderColor = PRIMARY_COLOR;

                                // Khi click nút gợi ý, tự động gửi câu hỏi và lấy câu trả lời tương ứng
                                btn.addEventListener("click", (e) => {
                                    e.stopPropagation();
                                    sendFaqMessage(faq.question, faq.answer, faq.reference_url); 
                                });
                                suggestionsContainer.appendChild(btn);
                            }
                        });
                    } else if (suggestionsContainer) {
                        suggestionsContainer.style.display = "none";
                    }
                }
            } catch (e) {
                console.error("❌ Không thể tải cấu hình từ database:", e);
            }
        }

        loadChatbotConfig();

        // Xử lý hiệu ứng focus input
        if (input && wrapper) {
            input.addEventListener("focus", () => { wrapper.style.borderColor = PRIMARY_COLOR; });
            input.addEventListener("blur", () => { wrapper.style.borderColor = "#ccc"; });
        }

        // Đóng mở khung chat
        if (bubble && box) {
            bubble.addEventListener("click", () => {
                box.style.display = (box.style.display === "none" || box.style.display === "") ? "flex" : "none";
                if (box.style.display === "flex" && input) input.focus();
            });
        }
        if (closeBtn && box) { closeBtn.addEventListener("click", () => { box.style.display = "none"; }); }

        // Hàm xử lý khi bấm nút gợi ý nhanh (Có sẵn câu trả lời tĩnh từ database)
        function sendFaqMessage(questionText, answerText, redirectUrl) {
            if (!messagesContainer) return;

            // 1. Hiển thị tin nhắn User
            const uDiv = document.createElement("div"); 
            uDiv.className = "msg user"; 
            uDiv.innerText = questionText;
            uDiv.style.backgroundColor = PRIMARY_COLOR; 
            messagesContainer.appendChild(uDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            // 2. Hiển thị câu trả lời tương ứng ngay lập tức
            setTimeout(() => {
                const bDiv = document.createElement("div"); 
                bDiv.className = "msg bot"; 
                bDiv.innerText = answerText;

                if (redirectUrl && redirectUrl.trim() !== "") {
                    const link = document.createElement("a");
                    link.className = "chatbot-link"; 
                    link.href = redirectUrl.trim(); 
                    link.target = "_blank";
                    link.style.color = PRIMARY_COLOR; 
                    link.innerText = "🔗 Chi tiết tại đây";
                    bDiv.appendChild(link);
                }
                messagesContainer.appendChild(bDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }, 300);
        }

        // 3. XỬ LÝ PHẦN B (AI): Khi người dùng tự nhập câu hỏi bất kỳ và nhấn Enter
        async function sendAIMessage() {
            if (!input || !messagesContainer) return;
            const text = input.value.trim();
            if (!text) return;
            
            // Vẽ tin nhắn User nhập
            const uDiv = document.createElement("div"); 
            uDiv.className = "msg user"; 
            uDiv.innerText = text;
            uDiv.style.backgroundColor = PRIMARY_COLOR; 
            messagesContainer.appendChild(uDiv);
            
            input.value = ""; 
            messagesContainer.scrollTop = messagesContainer.scrollHeight;

            try {
                // Gửi tin nhắn lên API xử lý AI. 
                // Server sẽ quét câu hỏi này với `keywords` và `ai_context` trong file CSV để trả về đáp án thông minh nhất.
                const response = await fetch(`${SERVER_BASE_URL}/api/v1/chatbot/query`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ site_id: SITE_ID, question: text }) 
                });
                const data = await response.json();
                
                const bDiv = document.createElement("div"); 
                bDiv.className = "msg bot"; 
                bDiv.innerText = data.answer || "申し訳ありません。 thông tin chưa rõ ràng.";

                if (data.reference_url) {
                    const link = document.createElement("a");
                    link.className = "chatbot-link"; 
                    link.href = data.reference_url; 
                    link.target = "_blank";
                    link.style.color = PRIMARY_COLOR;
                    link.innerText = "🔗 Chi tiết tại đây";
                    bDiv.appendChild(link);
                }
                messagesContainer.appendChild(bDiv);
            } catch (error) {
                const eDiv = document.createElement("div"); 
                eDiv.className = "msg bot"; 
                eDiv.innerText = "❌ Không kết nối được tới AI Server.";
                messagesContainer.appendChild(eDiv);
            }
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }

        if (sendBtn) sendBtn.addEventListener("click", () => sendAIMessage());
        if (input) input.addEventListener("keypress", (e) => { if (e.key === "Enter") sendAIMessage(); });
    }
};
