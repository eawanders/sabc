import localFont from "next/font/local";

/**
 * Self-hosted Gilroy – Light (300) & ExtraBold (800)
 * Place files here:
 * /public/fonts/gilroy/Gilroy-Light.woff2
 * /public/fonts/gilroy/Gilroy-ExtraBold.woff2
 */
export const gilroy = localFont({
  src: [
    {
      path: "../../public/fonts/gilroy/Gilroy-Light.woff2",
      style: "normal",
      weight: "300",
    },
    {
      path: "../../public/fonts/gilroy/Gilroy-ExtraBold.woff2",
      style: "normal",
      weight: "800",
    },
  ],
  variable: "--font-gilroy",
  display: "swap",
});