const PUSH_URL = "https://api.line.me/v2/bot/message/push";
const BROADCAST_URL = "https://api.line.me/v2/bot/message/broadcast";

export async function sendLineNotify(message: string): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) {
    console.warn("LINE_CHANNEL_ACCESS_TOKEN 未設定，跳過通知");
    return false;
  }

  const targetId = process.env.LINE_PUSH_TARGET_ID;
  const url = targetId ? PUSH_URL : BROADCAST_URL;

  const body: Record<string, unknown> = {
    messages: [{ type: "text", text: message.trim() }],
  };
  if (targetId) {
    body.to = targetId;
  }

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`LINE 推播失敗: ${res.status} ${detail}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("LINE 推播錯誤:", err);
    return false;
  }
}
