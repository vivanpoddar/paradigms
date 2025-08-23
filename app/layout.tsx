import type { Metadata } from "next";
import { Sarabun, Lato } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Professional",
  icons: {
    icon: "/favicon.ico", 
  },
};

const sarabun = Sarabun({
  variable: "--font-sarabun",
  display: "swap",
  subsets: ["latin"],
  weight: ["100", "200", "300", "400", "500", "600", "700", "800"],
});

const lato = Lato({
  variable: "--font-lato",
  display: "swap",
  subsets: ["latin"],
  weight: ["100", "300", "400", "700", "900"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${sarabun.className} ${lato.variable} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
