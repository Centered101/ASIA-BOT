import type { Metadata, Viewport } from "next";
import "./globals.css";
import AOSProvider from "@/components/AOSProvider";
import { Toaster } from "sonner";

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

const toasterOptions = {
  unstyled: true,
  classNames: {
    toast: "slide-up flex items-center gap-2 bg-[color:var(--white-smoker)] border border-slate-200 rounded-xl shadow-xl px-3 py-2 w-72 cursor-grab active:cursor-grabbing font-['Kanit']",
    content: "flex-1 min-w-0",
    title: "font-['Kanit'] font-medium text-sm text-slate-700 line-clamp-2",
    icon: "flex-shrink-0",
  },
} as const;

const toasterIcons = {
  success: <i className="fa-solid fa-circle-check text-green-500 text-sm" />,
  error:   <i className="fa-solid fa-circle-exclamation text-red-500 text-sm" />,
  info:    <i className="fa-solid fa-circle-info text-blue-400 text-sm" />,
  warning: <i className="fa-solid fa-circle-info text-yellow-500 text-sm" />,
  loading: <i className="fa-solid fa-spinner text-slate-400 text-sm animate-spin" />,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" suppressHydrationWarning>
      <head>
        <link rel="shortcut icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      </head>
      <body>
        <AOSProvider>
          {children}
        </AOSProvider>
        <Toaster
          position="bottom-right"
          swipeDirections={["right", "bottom"]}
          toastOptions={toasterOptions}
          icons={toasterIcons}
        />
      </body>
    </html>
  );
}
