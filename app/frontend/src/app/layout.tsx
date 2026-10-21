import type { Metadata } from "next";
import { Jost, Noto_Sans_SC, Nunito_Sans, Poppins } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Staff screens use the school's own type: Jost for headings, Nunito Sans for text, Noto Sans SC for Chinese names and comments.
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], weight: ["500", "600", "700"] });
const notoSc = Noto_Sans_SC({ variable: "--font-noto-sc", weight: ["400", "500", "700"], preload: false });
// The printed family report keeps the Peterhouse print type.
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"], preload: false });
const nunito = Nunito_Sans({ variable: "--font-nunito", subsets: ["latin"], weight: ["300", "400", "600", "700"] });

export const metadata: Metadata = {
  title: "Peterhouse Learning Review",
  description: "Semester learning reviews for Peterhouse Preschool",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${jost.variable} ${notoSc.variable} ${poppins.variable} ${nunito.variable}`}>
      <body>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
