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
      <html lang="en">
        <body
          className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        >
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function() {
                  // WebView detection - runs IMMEDIATELY before anything else loads
                  function detectWebView() {
                    const ua = navigator.userAgent;
                    const isLinkedIn = ua.includes('LinkedInApp');
                    const isFacebook = ua.includes('FBAN') || ua.includes('FBAV');
                    const isInstagram = ua.includes('Instagram');
                    const isTwitter = ua.includes('Twitter');
                    const isAndroidWebView = ua.includes('wv') && !ua.includes('Chrome');
                    const isIOSWebView = /iPhone|iPad|iPod/.test(ua) && ua.includes('Mobile') && !ua.includes('Safari');
                    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
                    const hasStandardBrowser = ua.includes('Chrome') || ua.includes('Safari') || ua.includes('Firefox');
                    const isGenericWebView = isMobile && !hasStandardBrowser;
                    
                    return isLinkedIn || isFacebook || isInstagram || isTwitter || isAndroidWebView || isIOSWebView || isGenericWebView;
                  }
                  
                  if (detectWebView()) {
                    // Hide body immediately
                    document.body.style.display = 'none';
                    document.body.style.visibility = 'hidden';
                    
                    // Show blocker as soon as DOM is ready
                    function showBlocker() {
                      const overlay = document.createElement('div');
                      overlay.id = 'webview-blocker';
                      overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:#fff;z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;text-align:center;box-sizing:border-box;';
                      
                      const title = document.createElement('h1');
                      title.textContent = 'Open in Your Browser';
                      title.style.cssText = 'font-size:24px;font-weight:600;margin-bottom:16px;color:#000;margin:0;';
                      
                      const message = document.createElement('p');
                      message.textContent = 'You\\'re viewing this in an in-app browser which doesn\\'t support Google sign-in. Please open this link in Safari, Chrome, or your device\\'s browser.';
                      message.style.cssText = 'font-size:16px;color:#666;margin-bottom:24px;max-width:400px;line-height:1.5;margin:0 0 24px 0;';
                      
                      const buttonContainer = document.createElement('div');
                      buttonContainer.style.cssText = 'display:flex;flex-direction:column;gap:12px;width:100%;max-width:300px;';
                      
                      const openButton = document.createElement('button');
                      openButton.textContent = 'Open in Browser';
                      openButton.style.cssText = 'background:#000;color:#fff;border:none;padding:12px 24px;border-radius:6px;font-size:16px;font-weight:500;cursor:pointer;width:100%;';
                      openButton.onclick = function() {
                        const currentUrl = window.location.href;
                        const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
                        const isAndroid = /Android/.test(navigator.userAgent);
                        
                        if (isAndroid) {
                          try {
                            window.open(currentUrl, '_system');
                          } catch(e) {
                            try {
                              const intentUrl = 'intent://' + currentUrl.replace(/https?:\\/\\//, '') + '#Intent;scheme=https;action=android.intent.action.VIEW;end';
                              window.location.href = intentUrl;
                            } catch(e2) {
                              navigator.clipboard.writeText(currentUrl);
                              openButton.textContent = 'URL Copied!';
                            }
                          }
                        } else if (isIOS) {
                          try {
                            const link = document.createElement('a');
                            link.href = currentUrl;
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                          } catch(e) {
                            navigator.clipboard.writeText(currentUrl);
                            openButton.textContent = 'URL Copied!';
                          }
                        } else {
                          window.open(currentUrl, '_blank');
                        }
                      };
                      
                      const copyButton = document.createElement('button');
                      copyButton.textContent = 'Copy URL';
                      copyButton.style.cssText = 'background:#f5f5f5;color:#000;border:1px solid #ddd;padding:12px 24px;border-radius:6px;font-size:16px;font-weight:500;cursor:pointer;width:100%;';
                      copyButton.onclick = function() {
                        navigator.clipboard.writeText(window.location.href).then(function() {
                          copyButton.textContent = 'URL Copied!';
                          setTimeout(function() {
                            copyButton.textContent = 'Copy URL';
                          }, 2000);
                        }).catch(function() {
                          copyButton.textContent = 'Failed - Please copy manually';
                        });
                      };
                      
                      buttonContainer.appendChild(openButton);
                      buttonContainer.appendChild(copyButton);
                      
                      overlay.appendChild(title);
                      overlay.appendChild(message);
                      overlay.appendChild(buttonContainer);
                      
                      document.body.insertBefore(overlay, document.body.firstChild);
                      document.body.style.display = 'block';
                      document.body.style.visibility = 'visible';
                      
                      // Hide all Clerk components
                      const hideClerk = function() {
                        const clerkElements = document.querySelectorAll('[class*="cl-"], [id*="clerk"]');
                        clerkElements.forEach(function(el) {
                          (el as HTMLElement).style.display = 'none';
                          (el as HTMLElement).style.pointerEvents = 'none';
                        });
                      };
                      
                      // Hide Clerk elements immediately and watch for new ones
                      hideClerk();
                      const observer = new MutationObserver(hideClerk);
                      observer.observe(document.body, { childList: true, subtree: true });
                      
                      // Prevent clicks on any Clerk buttons
                      document.addEventListener('click', function(e) {
                        const target = e.target as HTMLElement;
                        if (target && (target.closest('[class*="cl-"]') || target.closest('button[type="button"]'))) {
                          e.preventDefault();
                          e.stopPropagation();
                          e.stopImmediatePropagation();
                          return false;
                        }
                      }, { capture: true, passive: false });
                    }
                    
                    if (document.readyState === 'loading') {
                      document.addEventListener('DOMContentLoaded', showBlocker);
                    } else {
                      showBlocker();
                    }
                  }
                  
                  // Theme setup
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
