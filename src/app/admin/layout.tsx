import type { Metadata, Viewport } from "next";
import { SITE_NAME } from "@/lib/config";

export const viewport: Viewport = {
  themeColor: "#FF7070",
};

export const metadata: Metadata = {
  title: `${SITE_NAME} Admin`,
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
