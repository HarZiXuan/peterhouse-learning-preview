import type { Metadata } from "next";
import { Jost, Nunito_Sans, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin"], weight: ["400", "500", "600", "700"] });
const jost = Jost({ variable: "--font-jost", subsets: ["latin"], weight: ["400", "500"] });
const nunito = Nunito_Sans({ variable: "--font-nunito", subsets: ["latin"], weight: ["300", "400", "600", "700"] });

export const metadata: Metadata = {
  title: "Peterhouse Learning Review",
  description: "June and December learning reviews for Peterhouse Preschool",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB" className={`${poppins.variable} ${jost.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
