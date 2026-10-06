import localFont from "next/font/local";

export const serif = localFont({
  src: "./fonts/source-serif-4-variable-roman.woff2",
  variable: "--font-serif",
  display: "swap",
  weight: "400 500",
});

export const sans = localFont({
  src: "./fonts/geist-variable.woff2",
  variable: "--font-sans",
  display: "swap",
  weight: "400 500",
});
