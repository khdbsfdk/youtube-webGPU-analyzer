import { AppProps } from 'next/app';

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
    <html lang="ko">
      <body className="antialiased dark">
        {children}
      </body>
    </html>
  );
}
