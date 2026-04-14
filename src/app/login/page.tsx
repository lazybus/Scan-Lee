import { AuthForm } from "@/components/auth-form";
import { hasSupabaseEnv } from "@/lib/supabase/config";

import {
  sendMagicLinkAction,
  signInWithPasswordAction,
} from "@/app/auth/actions";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function messageFromQuery(rawMessage: string | undefined) {
  switch (rawMessage) {
    case "auth-code-missing":
      return "The email link was missing its login token. Request a new magic link.";
    case "auth-code-invalid":
      return "The email link could not be verified. Request a new magic link or sign in with your password.";
    case "supabase-not-configured":
      return "Supabase is not configured yet for this environment.";
    default:
      return undefined;
  }
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = firstValue(params.next) ?? "/dashboard";
  const initialMessage = messageFromQuery(firstValue(params.message));

  return (
    <AuthForm
      action={signInWithPasswordAction}
      initialMessage={initialMessage}
      magicLinkAction={sendMagicLinkAction}
      mode="login"
      nextPath={nextPath}
      setupIncomplete={!hasSupabaseEnv()}
    />
  );
}
