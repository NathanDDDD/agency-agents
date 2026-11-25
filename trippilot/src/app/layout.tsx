import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin"] });
const fraunces = Fraunces({ variable: "--font-fraunces", subsets: ["latin"], axes: ["opsz"] });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "TripPilot — Your personal AI travel agent",
    template: "%s · TripPilot",
  },
  description:
    "Plan, organize and manage your entire trip in one intelligent place. AI itineraries, maps, bookings, budget and a concierge that knows your trip.",
  keywords: ["AI travel planner", "itinerary generator", "trip planner", "travel concierge", "travel budget"],
  openGraph: {
    title: "TripPilot — Explore freely. Plan intelligently.",
    description: "One intelligent travel companion for everything before, during and after your journey.",
    type: "website",
    siteName: "TripPilot",
  },
  twitter: { card: "summary_large_image", title: "TripPilot", description: "Your personal AI travel agent." },
};

export const viewport: Viewport = {
  themeColor: "#101C33",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jakarta.variable} ${fraunces.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            style: { borderRadius: 16, border: "1px solid #e4e0d6", fontFamily: "var(--font-jakarta)" },
          }}
        />
      </body>
    </html>
  );
}
