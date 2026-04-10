import { AppProps } from 'next/app';
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import "./globals.css";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata = {
  title: 'YouTube WebGPU Analyzer',
  description: 'AI-powered YouTube video frame analyzer using WebGPU',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={cn("font-sans", geist.variable)}>
      <body className="antialiased bg-zinc-50 text-zinc-900">
        {children}
      </body>
    </html>
  );
}
