export async function sendLineMessage(to: string, text: string): Promise<void> {
  const token = process.env.LINE_TOKEN;
  if (!token || !to) return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  }).catch(() => {});
}
