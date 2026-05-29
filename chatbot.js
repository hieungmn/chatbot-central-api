window.initCentralChatbot = function (config) {
    const SITE_ID = (config && config.site_id) ? config.site_id.trim().toLowerCase() : "c-wing"; 
    const SITE_NAME = (config && config.site_name) ? config.site_name : "Central Chatbot"; 

    // Bảng màu cấu hình theo thương hiệu
    const colorMap = {
        "c-wing": "#396e11",   // Xanh lá
        "cansuke": "#359DD2",  // Cam
        "account": "#940A3B",  // Xanh dương
        "s-wing": "#0f50c1"    //　
    };
    const PRIMARY_COLOR = colorMap[SITE_ID] || "#007bff";
    const SERVER_BASE_URL = "https://chatbot-central-api.onrender.com";

    // Xóa widget cũ để tránh lặp lại giao diện khi init nhiều lần
    const oldWidget = document.getElementById("central-chatbot-widget");
    if (oldWidget) oldWidget.remove();

    // Hàm tải giao diện HTML, ép trình duyệt render trước khi chạy logic
    async function injectChatbotUI() {
        try {
            const response = await fetch(`${SERVER_BASE_URL}/chatbot.html`);
            if (!response.ok) throw new Error("Không thể fetch file chatbot.html");
            const htmlTemplate = await response.text();

            // Sử dụng DOMParser để biến chuỗi String thành phần tử DOM Node thực tế
            const parser = new DOMParser();
            const doc = parser.parseFromString(htmlTemplate, "text/html");
            const widgetNode = doc.getElementById("central-chatbot-widget");

            if (!widgetNode) {
                console.error("❌ Không tìm thấy thẻ #central-chatbot-widget trong file html!");
                return;
            }

            // Chèn thẳng khối giao diện vào cuối thẻ body
            document.body.appendChild(widgetNode);

            // Chờ 50ms để trình duyệt cập nhật DOM xong xuôi rồi mới chạy logic sự kiện
            setTimeout(() => {
                initializeLogic();
            }, 50);

        } catch (error) {
            console.error("❌ Không thể nạp file template chatbot.html:", error);
        }
    }

    // Tiến hành kích hoạt nạp giao diện
    injectChatbotUI();

    // HÀM KHỞI TẠO LOGIC VÀ ÁP MÀU ĐỘNG BẰNG JAVASCRIPT
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

        // Gán màu sắc và tên dự án động trực tiếp từ Javascript
        if (bubble) bubble.style.backgroundColor = PRIMARY_COLOR;
        if (header) header.style.backgroundColor = PRIMARY_COLOR;
        if (sendBtn) sendBtn.style.backgroundColor = PRIMARY_COLOR;
        if (siteNameSpan) siteNameSpan.innerText = SITE_NAME;

        // Đổi màu viền khung nhập liệu khi trỏ chuột vào (focus)
        if (input && wrapper) {
            input.addEventListener("focus", () => { 
                wrapper.style.borderColor = PRIMARY_COLOR; 
                wrapper.style.backgroundColor = "#fff"; 
            });
            input.addEventListener("blur", () => { 
                wrapper.style.borderColor = "#ccc"; 
                wrapper.style.backgroundColor = "#f8f9fa"; 
            });
        }

        // Tải danh mục gợi ý làm nút nhanh bên dưới ô chat
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
                    if (input) input.style.paddingBottom = "10px"; 
                }
            } catch (e) {
                console.error("❌ Không thể tải danh sách nút gợi ý:", e);
            }
        }

        loadSuggestedPrompts();

        // Xử lý sự kiện đóng mở khung chat khi nhấn bong bóng chat
        if (bubble && box) {
            bubble.addEventListener("click", () => {
                box.style.display = (box.style.display === "none" || box.style.display === "") ? "flex" : "none";
                if (box.style.display === "flex" && input) input.focus();
            });
        }
        if (closeBtn && box) {
            closeBtn.addEventListener("click", () => { box.style.display = "none"; });
        }

        // Hàm xử lý gửi tin nhắn lên API vạn năng
        async function sendMessage(overrideText) {
            if (!input || !messagesContainer) return;
            const text = overrideText ? overrideText.trim() : input.value.trim();
            if (!text) return;
            
            // Vẽ tin nhắn của User
            const uDiv = document.createElement("div"); 
            uDiv.className = "msg user"; 
            uDiv.innerText = text;
            uDiv.style.backgroundColor = PRIMARY_COLOR; 
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

                // Thêm link điều hướng nếu server trả về URL
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

        if (sendBtn) sendBtn.addEventListener("click", () => sendMessage());
        if (input) input.addEventListener("keypress", (e) => { if (e.key === "Enter") sendMessage(); });
    }
};
