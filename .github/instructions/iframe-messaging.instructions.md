## iframe Messaging Protocol

Follow this structure when sending messages between iframes by postmessage:

{
type: "SET_WORKSPACE", // 必须：事件类型
payload: { ... }, // 必须：数据主体
source: "nextjs", // 可选：来源标识
version: 1 // 可选：协议版本
}
