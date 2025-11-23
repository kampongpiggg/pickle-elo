import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import NavBar from "@/app/components/NavBar";
import Image from "next/image";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Victorian Throne",
  description: "Powered by boredom and Chat-GPT",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} relative min-h-screen text-gray-900`}
      >
        {/* 🐎 Knight in bottom-right corner */}
        <div className="pointer-events-none fixed bottom-0 right-0 z-0 select-none">
          <Image
            src="/knight.png" // make sure this file exists in /public
            alt=""
            width={380}
            height={380}
            priority
            className="w-[260px] sm:w-[320px] md:w-[380px] h-auto"
          />
        </div>

        {/* App content above background/knight */}
        <div className="relative z-10">
          <NavBar />
          {children}
        </div>
      </body>
    </html>
  );
}
