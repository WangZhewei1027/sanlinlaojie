"use client";

import { useEffect, useState, useRef } from "react";

export default function PostMessageTest() {
  const [messages, setMessages] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [sentCount, setSentCount] = useState(0);
  const [receivedCount, setReceivedCount] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    // 监听来自 iframe 的消息
    const handleMessage = (event: MessageEvent) => {
      // 安全检查：验证消息来源
      // 在生产环境中，应该检查 event.origin
      console.log("收到来自 iframe 的消息:", event.data);

      if (event.data.type === "IFRAME_READY") {
        setMessages((prev) => [...prev, `系统: ${event.data.message}`]);
        setReceivedCount((c) => c + 1);
      } else if (event.data.type === "IFRAME_TO_PARENT") {
        setMessages((prev) => [...prev, `Iframe: ${event.data.message}`]);
        setReceivedCount((c) => c + 1);

        // 自动回复
        setTimeout(() => {
          sendAutoReply();
        }, 500);
      } else if (event.data.type === "IFRAME_REPLY") {
        setMessages((prev) => [...prev, `Iframe 确认: ${event.data.message}`]);
        setReceivedCount((c) => c + 1);
      }
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  // 向 iframe 发送消息
  const sendToIframe = () => {
    if (!inputValue.trim() || !iframeRef.current?.contentWindow) return;

    iframeRef.current.contentWindow.postMessage(
      {
        type: "PARENT_TO_IFRAME",
        message: inputValue,
        timestamp: new Date().toISOString(),
      },
      "*" // 在生产环境中应该指定具体的 origin
    );

    setMessages((prev) => [...prev, `我发送: ${inputValue}`]);
    setSentCount((c) => c + 1);
    setInputValue("");
  };

  // 自动回复
  const sendAutoReply = () => {
    if (!iframeRef.current?.contentWindow) return;

    const replies = [
      "收到你的消息了！",
      "明白了，谢谢！",
      "好的，我知道了",
      "感谢分享！",
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];

    iframeRef.current.contentWindow.postMessage(
      {
        type: "PARENT_TO_IFRAME",
        message: reply,
        timestamp: new Date().toISOString(),
      },
      "*"
    );

    setMessages((prev) => [...prev, `自动回复: ${reply}`]);
    setSentCount((c) => c + 1);
  };

  const clearMessages = () => {
    setMessages([]);
    setSentCount(0);
    setReceivedCount(0);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-pink-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <h1 className="text-3xl font-bold text-purple-600 mb-2">
            🚀 PostMessage 通信演示 - Next.js 父窗口
          </h1>
          <div className="bg-purple-50 border-l-4 border-purple-500 p-4 mt-4">
            <p className="text-sm text-purple-700">
              这个示例演示了如何使用 <strong>postMessage API</strong> 在 Next.js
              页面和 iframe 之间进行安全的跨域通信。
            </p>
          </div>
        </div>

        {/* 统计和控制面板 */}
        <div className="bg-white rounded-lg shadow-xl p-6 mb-6">
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg text-center">
              <div className="text-3xl font-bold text-purple-600">
                {sentCount}
              </div>
              <div className="text-sm text-gray-600 mt-1">已发送</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg text-center">
              <div className="text-3xl font-bold text-green-600">
                {receivedCount}
              </div>
              <div className="text-sm text-gray-600 mt-1">已接收</div>
            </div>
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendToIframe()}
              placeholder="输入消息发送给 iframe..."
              className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-lg focus:outline-none focus:border-purple-500 transition-colors"
            />
            <button
              onClick={sendToIframe}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold"
            >
              📤 发送
            </button>
            <button
              onClick={clearMessages}
              className="px-6 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-semibold"
            >
              🗑️ 清空
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 消息历史 */}
          <div className="bg-white rounded-lg shadow-xl p-6">
            <h2 className="text-xl font-bold mb-4 text-gray-700">
              📬 消息历史
            </h2>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {messages.length === 0 ? (
                <p className="text-gray-400 text-center py-8">
                  暂无消息，发送一条消息开始通信吧！
                </p>
              ) : (
                messages.map((msg, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg ${
                      msg.startsWith("Iframe") || msg.startsWith("系统")
                        ? "bg-green-50 border-l-4 border-green-500"
                        : "bg-purple-50 border-l-4 border-purple-500"
                    }`}
                  >
                    <p className="text-sm text-gray-800">{msg}</p>
                    <span className="text-xs text-gray-500">
                      {new Date().toLocaleTimeString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Iframe */}
          <div className="bg-white rounded-lg shadow-xl p-4">
            <div className="mb-2">
              <h2 className="text-xl font-bold text-gray-700">
                📱 Iframe 窗口
              </h2>
              <p className="text-sm text-gray-500">HTML 页面嵌入在这里</p>
            </div>
            <iframe
              ref={iframeRef}
              src="/js/post-message-test/index.html"
              title="PostMessage Test Iframe"
              className="w-full h-[500px] border-2 border-gray-200 rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
