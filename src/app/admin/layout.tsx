import type { Metadata, Viewport } from "next";

export const viewport: Viewport = {
  themeColor: "#FF7070",
};

export const metadata: Metadata = {
  title: "ASIA-BOT Admin",
  icons: {
    icon: [{ url: "/admin/favicon.ico", type: "image/x-icon" }],
    shortcut: "/admin/favicon.ico",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`::selection { background: #FF707066; color: #fff; }`}</style>
      {children}
    </>
  );
}
