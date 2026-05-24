import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ASIA-BOT Admin",
  icons: {
    icon: [{ url: "/admin/favicon.ico", type: "image/x-icon" }],
    shortcut: "/admin/favicon.ico",
  },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
