"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Bell, Compass, RotateCcw, Shield, User } from "lucide-react";
import { useData } from "@/lib/data/provider";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Toggle } from "@/components/ui/field";
import { ConfirmDialog } from "@/components/ui/modal";
import { PreferenceFields } from "@/components/forms/preferences-form";
import { DEFAULT_PREFERENCES } from "@/lib/options";
import { preferencesSchema } from "@/lib/schemas";
import { LocalRepository } from "@/lib/data/local";
import { getSupabaseBrowser } from "@/lib/supabase/client";
import type { NotificationPreferences, TravelPreferences } from "@/lib/types";
import { cn, CURRENCIES, hardNavigate } from "@/lib/utils";

const SECTIONS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "preferences", label: "Travel preferences", icon: Compass },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "account", label: "Account", icon: Shield },
] as const;

type Section = (typeof SECTIONS)[number]["id"];

export default function SettingsPage() {
  const [section, setSection] = useState<Section>("profile");
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 lg:px-8">
      <h1 className="font-display text-4xl">Settings</h1>
      <div className="mt-6 grid gap-6 md:grid-cols-[220px_1fr]">
        <nav className="no-scrollbar -mx-4 flex gap-1 overflow-x-auto px-4 md:mx-0 md:flex-col md:px-0" aria-label="Settings sections">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              aria-current={section === s.id ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-semibold transition",
                section === s.id ? "bg-navy text-ivory" : "text-navy/70 hover:bg-navy/5",
              )}
            >
              <s.icon className="h-4 w-4" /> {s.label}
            </button>
          ))}
        </nav>
        <div className="card p-5 sm:p-7">
          {section === "profile" && <ProfileSection />}
          {section === "preferences" && <PreferencesSection />}
          {section === "notifications" && <NotificationsSection />}
          {section === "account" && <AccountSection />}
        </div>
      </div>
    </div>
  );
}

function ProfileSection() {
  const { repo, profile, refreshProfile } = useData();
  const [name, setName] = useState(profile.full_name ?? "");
  const [currency, setCurrency] = useState(profile.home_currency);
  const [saving, setSaving] = useState(false);
  return (
    <form
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
          await repo.updateProfile({ full_name: name.trim(), home_currency: currency });
          await refreshProfile();
          toast.success("Profile saved");
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Could not save");
        } finally {
          setSaving(false);
        }
      }}
    >
      <h2 className="text-xl font-bold">Profile</h2>
      <Field label="Full name" htmlFor="p-name">
        <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      </Field>
      <Field label="Email" htmlFor="p-email" hint={repo.mode === "demo" ? "Demo account" : "Contact support to change your email."}>
        <Input id="p-email" value={profile.email ?? ""} disabled />
      </Field>
      <Field label="Home currency" htmlFor="p-cur" hint="Used as the default for new trips.">
        <Select id="p-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
          {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
        </Select>
      </Field>
      <Button type="submit" loading={saving}>Save profile</Button>
    </form>
  );
}

function PreferencesSection() {
  const { repo, preferences, setPreferences } = useData();
  const [prefs, setPrefs] = useState<TravelPreferences>(preferences ?? DEFAULT_PREFERENCES);
  const [saving, setSaving] = useState(false);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Travel preferences</h2>
        <p className="text-sm text-muted">Used for every new itinerary and by the concierge.</p>
      </div>
      <PreferenceFields value={prefs} onChange={setPrefs} />
      <Button
        loading={saving}
        onClick={async () => {
          const parsed = preferencesSchema.safeParse(prefs);
          if (!parsed.success) return toast.error("Please check your preferences");
          setSaving(true);
          try {
            await repo.savePreferences(parsed.data);
            setPreferences(parsed.data);
            toast.success("Preferences saved");
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Could not save");
          } finally {
            setSaving(false);
          }
        }}
      >
        Save preferences
      </Button>
    </div>
  );
}

function NotificationsSection() {
  const { repo, profile, refreshProfile } = useData();
  const [n, setN] = useState<NotificationPreferences>(profile.notifications);
  const update = async (patch: Partial<NotificationPreferences>) => {
    const next = { ...n, ...patch };
    setN(next);
    try {
      await repo.updateProfile({ notifications: next });
      await refreshProfile();
      toast.success("Notification preferences saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save");
    }
  };
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold">Notifications</h2>
        <p className="text-sm text-muted">Email notifications launch soon. Your choices are saved now.</p>
      </div>
      <div className="divide-y divide-line">
        <Toggle checked={n.trip_reminders} onChange={(v) => void update({ trip_reminders: v })} label="Trip reminders" description="Countdown and pre-departure checklist." />
        <Toggle checked={n.itinerary_changes} onChange={(v) => void update({ itinerary_changes: v })} label="Itinerary changes" description="When something in your plan changes." />
        <Toggle checked={n.product_updates} onChange={(v) => void update({ product_updates: v })} label="Product updates" description="New features and travel inspiration." />
      </div>
    </div>
  );
}

function AccountSection() {
  const { repo, profile, signOut } = useData();
  const [confirmReset, setConfirmReset] = useState(false);
  const [sending, setSending] = useState(false);
  const isDemo = repo.mode === "demo";
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Account</h2>
      {isDemo ? (
        <div className="space-y-3">
          <p className="text-sm text-muted">You’re exploring TripPilot in demo mode. Data lives only in this browser.</p>
          <Button variant="secondary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => setConfirmReset(true)}>
            Reset demo data
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">Signed in as <b>{profile.email}</b></p>
          <Button
            variant="secondary"
            loading={sending}
            onClick={async () => {
              if (!profile.email) return;
              setSending(true);
              const { error } = await getSupabaseBrowser().auth.resetPasswordForEmail(profile.email, {
                redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
              });
              setSending(false);
              if (error) toast.error(error.message);
              else toast.success("Password reset email sent");
            }}
          >
            Send password reset email
          </Button>
          <p className="text-xs text-muted">To delete your account and all trip data, contact support. Self-serve deletion is coming soon.</p>
        </div>
      )}
      <div className="border-t border-line pt-5">
        <Button variant="outline" onClick={() => void signOut()}>{isDemo ? "Exit demo" : "Log out"}</Button>
      </div>
      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Reset demo data?"
        message="All demo trips and changes in this browser will be replaced with the original sample trip."
        confirmLabel="Reset"
        onConfirm={() => {
          LocalRepository.reset();
          hardNavigate("/app");
        }}
      />
    </div>
  );
}
