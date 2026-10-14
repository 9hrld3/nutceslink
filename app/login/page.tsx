"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Credits from "@/components/Credits";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) return setError(error.message);
    router.push("/clients");
    router.refresh();
  }

  return (
    <>
    <main className="mx-auto max-w-md px-4 py-16">
      <div className="bg-primary p-10 text-paper">
        <p className="label text-accent">NutcesLink</p>
        <h1 className="mt-2 text-5xl">{mode === "in" ? "Entrar" : "Crear cuenta"}</h1>
      </div>
      <form onSubmit={submit} className="space-y-4 border-2 border-t-0 border-primary bg-white p-10">
        <label className="block">
          <span className="label">Correo</span>
          <input className="field mt-1" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="block">
          <span className="label">Contraseña</span>
          <input className="field mt-1" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <p role="alert" className="border-l-4 border-accent bg-paper p-2 text-sm">{error}</p>}
        <button className="btn btn-primary w-full" disabled={busy}>{busy ? "..." : mode === "in" ? "Entrar" : "Registrarme"}</button>
        <button type="button" className="text-sm underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>
          {mode === "in" ? "No tengo cuenta" : "Ya tengo cuenta"}
        </button>
      </form>
    </main>
      <Credits />
    </>
  );
}
