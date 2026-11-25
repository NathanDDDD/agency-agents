import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = { title: "Create your account" };

export default function SignupPage() {
  return (
    <AuthShell title="Start planning" subtitle="Create a free account. Your first AI-planned trip is minutes away.">
      <SignupForm />
    </AuthShell>
  );
}
