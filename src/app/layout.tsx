import type { Metadata, Viewport } from "next";
import "./globals.css";
import AOSProvider from "@/components/AOSProvider";
import { NotificationProvider } from "@/components/Notification";

export const viewport: Viewport = {
  themeColor: "#84D4FA",
};

export const metadata: Metadata = {
  title: { default: "ASIA-BOT", template: "%s | ASIA-BOT" },
  description: "แพลตฟอร์มบริหารจัดการระบบนักเรียนครบวงจร — ติดตามห้องเรียน, สแกนบัตร, จองห้อง, สหกรณ์",
  keywords: ["ASIA-BOT", "asialb", "abac", "Student Entry Scanner", "Class Track Room", "Centered101"],
  authors: [{ name: "Centered101" }],
  openGraph: {
    type: "website",
    url: "https://asia-lb.web.app",
    title: "ASIA-BOT",
    description: "แพลตฟอร์มบริหารจัดการระบบนักเรียนครบวงจร",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      </head>
      <body>
        <NotificationProvider>
          <AOSProvider>
            {children}
          </AOSProvider>
        </NotificationProvider>
      </body>
    </html>
  );
}
