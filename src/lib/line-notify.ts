const PUSH_URL = "https://api.line.me/v2/bot/message/push";
const BROADCAST_URL = "https://api.line.me/v2/bot/message/broadcast";

function getSiteUrl(): string {
  if (process.env.SITE_URL) return process.env.SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return "https://ricehouse-modbus-dryer-monitor.vercel.app";
}

interface FlexSection {
  label: string;
  value: string;
}

interface FlexNotifyOptions {
  title: string;
  icon: string;
  headerColor: string;
  sections: FlexSection[];
  buttonLabel: string;
  buttonUri?: string;
  altText: string;
}

function buildFlexBubble(opts: FlexNotifyOptions): Record<string, unknown> {
  const siteUrl = getSiteUrl();
  const uri = opts.buttonUri ?? siteUrl;

  return {
    type: "flex",
    altText: opts.altText,
    contents: {
      type: "bubble",
      size: "kilo",
      header: {
        type: "box",
        layout: "horizontal",
        contents: [
          { type: "text", text: opts.icon, size: "xl", flex: 0 },
          {
            type: "text",
            text: opts.title,
            weight: "bold",
            size: "md",
            color: "#ffffff",
            flex: 1,
            margin: "sm",
          },
        ],
        backgroundColor: opts.headerColor,
        paddingAll: "12px",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: opts.sections.map((s) => ({
          type: "box",
          layout: "horizontal",
          contents: [
            {
              type: "text",
              text: s.label,
              size: "sm",
              color: "#888888",
              flex: 0,
              wrap: true,
            },
            {
              type: "text",
              text: s.value,
              size: "sm",
              color: "#333333",
              align: "end",
              weight: "bold",
              flex: 1,
              wrap: true,
            },
          ],
          margin: "md",
        })),
        paddingAll: "16px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            action: {
              type: "uri",
              label: opts.buttonLabel,
              uri,
            },
            style: "primary",
            color: opts.headerColor,
            height: "sm",
          },
        ],
        paddingAll: "12px",
      },
    },
  };
}

async function sendLineMessage(
  message: Record<string, unknown>
): Promise<boolean> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return false;

  const targetId = process.env.LINE_PUSH_TARGET_ID;
  const url = targetId ? PUSH_URL : BROADCAST_URL;

  const body: Record<string, unknown> = { messages: [message] };
  if (targetId) body.to = targetId;

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

export async function sendLineNotify(message: string): Promise<boolean> {
  return sendLineMessage({ type: "text", text: message.trim() });
}

export async function sendLineFlexNotify(
  opts: FlexNotifyOptions
): Promise<boolean> {
  return sendLineMessage(buildFlexBubble(opts));
}

export { getSiteUrl };
export type { FlexNotifyOptions, FlexSection };
