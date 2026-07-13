import type { Metadata, Viewport } from "next";
import "./globals.css";
import AOSProvider from "@/components/AOSProvider";
import NoRightClick from "@/components/NoRightClick";
import ChatBubble from "@/components/ChatBubble";
import { Toaster } from "sonner";
import { Analytics } from "@vercel/analytics/next";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://asia-bot.xyz";
const metaImage = "/hero.png";

export const viewport: Viewport = {
  themeColor: "#84D4FA",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "ASIA-BOT",
  title: {
    default: "ASIA-BOT — แพลตฟอร์มบริหารจัดการระบบนักเรียน",
    template: "%s | ASIA-BOT",
  },
  description:
    "ASIA-BOT แพลตฟอร์มบริหารจัดการระบบนักเรียนครบวงจร สำหรับ ABAC — ติดตาม Class Track Room จองห้อง สหกรณ์ออนไลน์ และอีกมากมาย",
  keywords: [
    "ASIA-BOT", "asialb", "abac", "Assumption University",
    "Class Track Room", "ติดตามห้องเรียน", "จองห้อง",
    "สหกรณ์", "สหกรณ์ออนไลน์", "ระบบนักเรียน",
    "student management", "Centered101", "asia-bot.xyz",
  ],
  authors: [{ name: "Centered101", url: siteUrl }],
  creator: "Centered101",
  publisher: "Centered101",
  category: "Education Technology",
  alternates: { canonical: siteUrl },
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon" },
      { url: "/favicon.png", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/favicon.png",
  },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "ASIA-BOT",
    locale: "th_TH",
    title: "ASIA-BOT — แพลตฟอร์มบริหารจัดการระบบนักเรียน",
    description:
      "แพลตฟอร์มบริหารจัดการระบบนักเรียนครบวงจร — ติดตามห้องเรียน จองห้อง สหกรณ์",
    images: [{ url: metaImage, width: 1200, height: 630, alt: "ASIA-BOT Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    site: "@centered101",
    creator: "@centered101",
    title: "ASIA-BOT — แพลตฟอร์มบริหารจัดการระบบนักเรียน",
    description:
      "แพลตฟอร์มบริหารจัดการระบบนักเรียนครบวงจร — ติดตามห้องเรียน จองห้อง สหกรณ์",
    images: [metaImage],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

const toasterOptions = {
  unstyled: true,
  classNames: {
    toast: "slide-up flex items-center gap-2 bg-[color:var(--white-smoker)] border border-slate-200 rounded-xl shadow-xl px-3 py-2 w-full cursor-grab active:cursor-grabbing font-['Kanit']",
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
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/favicon.png" />

        {/* Preconnect to font/icon CDNs so non-blocking loads start ASAP */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://cdnjs.cloudflare.com" crossOrigin="anonymous" />

        {/* Preload Kanit + Font Awesome CSS (non-blocking fetch). The actual
            stylesheet <link>s are injected by the script below — outside React's
            tree — so they never block first paint and don't cause hydration drift. */}
        <link
          rel="preload"
          as="style"
          href="https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800&display=swap"
        />
        <link
          rel="preload"
          as="style"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css"
        />
      </head>
      <body suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){var u=['https://fonts.googleapis.com/css2?family=Kanit:wght@300;400;500;600;700;800&display=swap','https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css'];function l(){u.forEach(function(h){var k=document.createElement('link');k.rel='stylesheet';k.href=h;document.head.appendChild(k);});}if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',l);else l();})();",
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Organization",
              name: "ASIA-BOT",
              url: siteUrl,
              logo: `${siteUrl}/favicon.png`,
              description: "แพลตฟอร์มบริหารจัดการระบบนักเรียนครบวงจร สำหรับ ABAC",
              creator: { "@type": "Person", name: "Centered101" },
              sameAs: [siteUrl],
            }),
          }}
        />
        <NoRightClick />
        <AOSProvider>
          {children}
        </AOSProvider>
        <ChatBubble />
        <Toaster
          position="top-right"
          swipeDirections={["top", "left", "right"]}
          toastOptions={toasterOptions}
          icons={toasterIcons}
        />
        <Analytics />
      </body>
    </html>
  );
}
