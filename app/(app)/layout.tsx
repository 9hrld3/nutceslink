import Link from "next/link";
import { getContext } from "@/lib/auth";
import { signOutAction } from "./actions";
import Credits from "@/components/Credits";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { coach, studioName } = await getContext();
  return (
    <>
      <header className="no-print bg-primary text-paper">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/clients" className="font-display text-3xl font-black uppercase">
            Nutces<span className="text-accent">Link</span>
          </Link>
          <nav className="flex items-center gap-6 text-sm">
            <Link href="/clients" className="underline">Clientes</Link>
            <Link href="/groups" className="underline">Grupos</Link>
            <span className="label hidden sm:inline">{studioName} · {coach.full_name}</span>
            <form action={signOutAction}>
              <button className="underline">Salir</button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-10">{children}</main>
      <Credits />
    </>
  );
}
