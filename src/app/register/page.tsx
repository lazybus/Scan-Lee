import { AuthForm } from "@/components/auth-form";
import { hasSupabaseEnv } from "@/lib/supabase/config";

import { signUpWithPasswordAction } from "@/app/auth/actions";

export const dynamic = "force-dynamic";

type RegisterPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const nextPath = firstValue(params.next) ?? "/dashboard";

  return (
    <AuthForm
      action={signUpWithPasswordAction}
      mode="register"
      nextPath={nextPath}
      setupIncomplete={!hasSupabaseEnv()}
    />
  );
}
