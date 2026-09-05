"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Btn } from "@/components/win";

export default function SessionPanel() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login"); router.refresh();
  }

  return (
    <>
      {email && <p className="mb-3">Signed in as <b>{email}</b></p>}
      <Btn onClick={signOut}>Log Off Personal OS…</Btn>
    </>
  );
}
