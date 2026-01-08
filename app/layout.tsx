import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "@/components/providers";
import { PublicRouteWrapper } from "@/components/public-route-wrapper";
import { Toaster } from "sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Cell Dashboard",
  description: "Manage your SMS agents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        elements: {
          rootBox: "mx-auto",
        },
      }}
      signInUrl="/"
      signUpUrl="/"
    >
      <html lang="en" suppressHydrationWarning>
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  // Theme setup - runs before React hydration to prevent flash
                  const theme = localStorage.getItem('theme');
                  if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                    document.documentElement.classList.add('dark');
                  }
                })();
              `,
            }}
          />
          <Providers>
            <Toaster />
            <PublicRouteWrapper>
              {children}
            </PublicRouteWrapper>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  );
}
