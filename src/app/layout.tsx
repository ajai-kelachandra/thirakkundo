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
  title: "തിരക്കുണ്ടോ? | Thirakkundo - Live BEVCO Queue & Crowd Status Tracker Kerala",
  description: "Check live crowd density, queue length, and stock availability at BEVCO (liquor outlets) and local stores across Kerala. Get real-time crowd-sourced wait times from fellow citizens. ഒഴിവാക്കൂ നീണ്ട ക്യൂകൾ!",
  keywords: [
    "thirakkundo", 
    "തിരക്കുണ്ടോ", 
    "bevco queue tracker", 
    "bevco crowd status", 
    "kerala liquor shop queue online", 
    "kerala bevco wait times", 
    "bevco stock availability", 
    "kerala liquor outlet tracker", 
    "live crowd queue tracker", 
    "bevco kochi trivandrum thrissur calicut",
    "kerala bevco booking status"
  ],
  authors: [{ name: "Thirakkundo Community" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Thirakkundo? | Live BEVCO Queue & Wait Time Tracker Kerala",
    description: "Check live crowd density and queue lengths at local BEVCO liquor outlets across Kerala before stepping out. ഒഴിവാക്കൂ നീണ്ട ക്യൂകൾ!",
    url: "https://thirakkundo.in",
    siteName: "Thirakkundo",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Thirakkundo? | Live BEVCO Queue & Wait Time Tracker",
    description: "Check real-time crowd density and queue lengths at BEVCO outlets in Kerala before stepping out.",
  },
  alternates: {
    canonical: "https://thirakkundo.in",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={`${geistSans.variable} ${geistMono.variable} min-h-full flex flex-col bg-[#09090b] text-[#f4f4f5] antialiased`}>
        {/* Google Schema Markup (JSON-LD) for #1 Search Engine Optimization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              "name": "Thirakkundo",
              "url": "https://thirakkundo.in",
              "description": "Live crowd status, queue wait times, and stock availability tracker for BEVCO liquor outlets across Kerala.",
              "potentialAction": {
                "@type": "SearchAction",
                "target": "https://thirakkundo.in/?search={search_term_string}",
                "query-input": "required name=search_term_string"
              },
              "inLanguage": ["en", "ml"]
            })
          }}
        />
        <StoreProvider>
          {children}
        </StoreProvider>
      </body>
    </html>
  );
}
