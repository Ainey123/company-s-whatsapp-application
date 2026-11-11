import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { SocketProvider } from "@/components/providers/SocketProvider";
import { CallProvider } from "@/components/providers/CallProvider";

export const metadata: Metadata = {
  title: "ConnectPro - Enterprise Company Messaging",
  description: "Secure, private, modern enterprise company messaging, voice notes and audio/video calling.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-[#F0F2F5] dark:bg-[#0C1317]">
        <AuthProvider>
          <SocketProvider>
            <CallProvider>
              {children}
            </CallProvider>
          </SocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
