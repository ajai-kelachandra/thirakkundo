import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import StoreProvider from "./StoreProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Thirakkundo? | Live Crowd & Wait Time Tracker",
  description: "Check live crowds and queue wait times at BEVCO outlets, supermarkets, cafes, and public spots across Kerala. Powered by real-time citizen reporting, Redux state, and Firebase syncing.",
  keywords: ["kerala crowd status", "bevco wait times", "bevco queue tracker", "thirakkundo", "is it busy kochi", "live crowd queue"],
  authors: [{ name: "Thirakkundo Community" }],
  openGraph: {
    title: "Thirakkundo? | Live Crowd & Wait Time Tracker",
    description: "Check real-time queue lengths and crowd density at local spots before stepping out.",
    type: "website",
  }
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-[#09090b] text-[#f4f4f5] antialiased`}>
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
