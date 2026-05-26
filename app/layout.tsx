import './globals.css';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'LORDE AI | Premium Trading Bot Platform',
  description: 'Automated 24/7 execution for Deriv Synthetic Indices',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        variables: {
          colorPrimary: '#FFD700',
          colorBackground: '#132F4C',
          colorText: '#FFFFFF',
          colorInputBackground: '#000814',
          colorInputText: '#FFFFFF',
        },
        elements: {
          card: 'border border-gold/20 shadow-2xl shadow-gold/5 rounded-xl bg-navy',
          headerTitle: 'text-white font-bold tracking-wide',
          socialButtonsBlockButton: 'bg-navy-dark border border-slate-800 text-white hover:bg-slate-900',
          formButtonPrimary: 'bg-gold text-navy-dark hover:bg-gold-light transition-all font-bold',
          footerActionLink: 'text-gold hover:text-gold-light',
        }
      }}
    >
      <html lang="en">
        <head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet" />
        </head>
        <body className="bg-[#000814] text-white antialiased">
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
