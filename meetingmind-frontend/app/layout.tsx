import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://meetingmind-frontend.vercel.app"),
  title: "MeetingMind AI",
  description: "Turn every meeting into clear next steps.",
  openGraph: {
    title: "MeetingMind AI",
    description: "Turn every meeting into clear next steps.",
    url: "https://meetingmind-frontend.vercel.app",
    siteName: "MeetingMind AI",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "MeetingMind AI",
    description: "Turn every meeting into clear next steps.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
