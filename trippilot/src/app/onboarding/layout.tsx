import type { Metadata } from "next";
import { DataProvider } from "@/lib/data/provider";
import { PageLoader } from "@/components/ui/spinner";

export const metadata: Metadata = { title: "Your travel style", robots: { index: false } };

export default function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  return <DataProvider fallback={<PageLoader />}>{children}</DataProvider>;
}
