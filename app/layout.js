import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

// подключаем основной шрифт geist sans
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

// подключаем моноширинный шрифт geist mono
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// метаданные сайта, они попадают в head страницы
export const metadata = {
  title: "Hryunlandia",
  description: "Auction game",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ru">
      <body
        // добавляем переменные шрифтов и сглаживание текста
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {/* сюда next.js подставляет текущую страницу */}
        {children}

        {/* аналитика vercel для просмотров сайта */}
        <Analytics />
      </body>
    </html>
  );
}