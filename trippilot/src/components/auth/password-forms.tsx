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
import { isSupabaseConfigured } from "@/lib/config";
import { hardNavigate } from "@/lib/utils";
import { DemoNotice } from "./auth-shell";

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState } = useForm<{ email: string }>({
    resolver: zodResolver(z.object({ email: z.email("Enter a valid email") })),
  });
  if (!isSupabaseConfigured) return <DemoNotice />;
  if (sent)
    return (
      <div className="card p-6 text-sm text-muted">
        If an account exists for that email, a reset link is on its way. <Link href="/login" className="font-semibold text-navy">Back to log in</Link>
      </div>
    );
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async ({ email }) => {
        setLoading(true);
        const { error } = await getSupabaseBrowser().auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        setLoading(false);
        if (error) toast.error(error.message);
        else setSent(true);
      })}
    >
      <Field label="Email" htmlFor="email" error={formState.errors.email?.message}>
        <Input id="email" type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        Send reset link
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-semibold text-navy">
          Back to log in
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm() {
  const [loading, setLoading] = useState(false);
  const schema = z
    .object({ password: z.string().min(8, "Use at least 8 characters"), confirm: z.string() })
    .refine((v) => v.password === v.confirm, { message: "Passwords don't match", path: ["confirm"] });
  const { register, handleSubmit, formState } = useForm<z.infer<typeof schema>>({ resolver: zodResolver(schema) });
  if (!isSupabaseConfigured) return <DemoNotice />;
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={handleSubmit(async ({ password }) => {
        setLoading(true);
        const { error } = await getSupabaseBrowser().auth.updateUser({ password });
        setLoading(false);
        if (error) {
          toast.error(error.message);
          return;
        }
        toast.success("Password updated");
        hardNavigate("/app");
      })}
    >
      <Field label="New password" htmlFor="password" error={formState.errors.password?.message}>
        <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
      </Field>
      <Field label="Confirm password" htmlFor="confirm" error={formState.errors.confirm?.message}>
        <Input id="confirm" type="password" autoComplete="new-password" {...register("confirm")} />
      </Field>
      <Button type="submit" loading={loading} className="w-full">
        Update password
      </Button>
    </form>
  );
}
