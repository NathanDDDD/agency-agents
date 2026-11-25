"use client";

import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import { clearDemoCookie } from "@/lib/data/provider";
import { DemoNotice } from "./auth-shell";
import { isSupabaseConfigured } from "@/lib/config";
import { hardNavigate } from "@/lib/utils";

const schema = z.object({
  email: z.email("Enter a valid email"),
  password: z.string().min(6, "At least 6 characters"),
});

function nextPath() {
  const n = new URLSearchParams(window.location.search).get("next");
  return n && n.startsWith("/") && !n.startsWith("//") ? n : "/app";
}

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });

  if (!isSupabaseConfigured) return <DemoNotice />;

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    const { error } = await getSupabaseBrowser().auth.signInWithPassword(values);
    if (error) {
      setLoading(false);
      toast.error(error.message === "Invalid login credentials" ? "Email or password is incorrect" : error.message);
      return;
    }
    clearDemoCookie();
    hardNavigate(nextPath());
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" aria-invalid={!!formState.errors.email} {...register("email")} />
      </Field>
      <Field label="Password" htmlFor="password" error={formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="current-password" aria-invalid={!!formState.errors.password} {...register("password")} />
      </Field>
      <div className="text-right">
        <Link href="/forgot-password" className="text-sm font-semibold text-pilot">
          Forgot password?
        </Link>
      </div>
      <Button type="submit" loading={loading} className="w-full">
        Log in
      </Button>
      <p className="text-center text-sm text-muted">
        New to TripPilot?{" "}
        <Link href="/signup" className="font-semibold text-navy">
          Create an account
        </Link>
      </p>
      <p className="text-center text-sm">
        <a href="/demo" className="text-muted underline-offset-4 hover:underline">
          Or explore the demo without an account
        </a>
      </p>
    </form>
  );
}
