"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { clearDemoCookie } from "@/lib/data/provider";
import { DemoNotice } from "./auth-shell";
import { isSupabaseConfigured } from "@/lib/config";
import { hardNavigate } from "@/lib/utils";

const schema = z.object({
  full_name: z.string().min(2, "Tell us your name"),
  email: z.email("Enter a valid email"),
  password: z.string().min(8, "Use at least 8 characters"),
});

export function SignupForm() {
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  if (!isSupabaseConfigured) return <DemoNotice />;

  if (sentTo) {
    return (
      <div className="card p-6 text-center">
        <MailCheck className="mx-auto h-10 w-10 text-pilot" />
        <h2 className="mt-3 font-display text-2xl">Check your inbox</h2>
        <p className="mt-2 text-sm text-muted">We sent a confirmation link to {sentTo}. Open it to activate your account.</p>
      </div>
    );
  }

  const onSubmit = handleSubmit(async ({ full_name, email, password }) => {
    setLoading(true);
    const { data, error } = await getSupabaseBrowser().auth.signUp({
      email,
      password,
      options: {
        data: { full_name },
        emailRedirectTo: `${window.location.origin}/auth/callback?next=/onboarding`,
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    clearDemoCookie();
    if (data.session) {
      hardNavigate("/onboarding");
    } else {
      setSentTo(email);
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Your name" htmlFor="full_name" error={formState.errors.full_name?.message}>
        <Input id="full_name" autoComplete="name" aria-invalid={!!formState.errors.full_name} {...register("full_name")} />
      </Field>
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!formState.errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={formState.errors.password?.message} hint="At least 8 characters.">
        <Input id="password" type="password" autoComplete="new-password" aria-invalid={!!formState.errors.password} {...register("password")} />
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        Create account
      </Button>
      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-navy">
          Log in
        </Link>
      </p>
    </form>
  );
}
