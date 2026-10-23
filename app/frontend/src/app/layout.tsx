import type { Metadata } from "next";
import { Caveat, Fredoka, Inter, Noto_Sans_SC, Nunito, Poppins, ZCOOL_KuaiLe } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// Staff screens use Inter for everything (docs/DESIGN-SYSTEM.md), Noto Sans SC for Chinese names and comments.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const notoSc = Noto_Sans_SC({ variable: "--font-noto-sc", weight: ["400", "500", "700"], preload: false });
// The printed family report keeps the Peterhouse print type.
const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"], preload: false });
// The family report is a keepsake for small children: rounded Fredoka titles, Nunito text, Caveat for the child's own words,
// and ZCOOL KuaiLe for playful Chinese lettering.
const fredoka = Fredoka({ variable: "--font-fredoka", subsets: ["latin"], weight: ["500", "600", "700"] });
const nunitoRound = Nunito({ variable: "--font-nunito-round", subsets: ["latin"], weight: ["400", "600", "700", "800"] });
const caveat = Caveat({ variable: "--font-caveat", subsets: ["latin"], weight: ["600", "700"] });
const zcool = ZCOOL_KuaiLe({ variable: "--font-zcool", weight: "400", preload: false });

export const metadata: Metadata = {
  title: "Peterhouse Learning Review",
  description: "Semester learning reviews for Peterhouse Preschool",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${inter.variable} ${notoSc.variable} ${poppins.variable} ${fredoka.variable} ${nunitoRound.variable} ${caveat.variable} ${zcool.variable}`}>
      <body>
        {children}
        <Toaster position="bottom-right" />
      </body>
    </html>
  );
}
