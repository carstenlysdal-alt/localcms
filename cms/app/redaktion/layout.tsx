import Link from "next/link";
import { LayoutGrid, LogOut, MessageSquare, UserRound } from "lucide-react";
import { getSessionState, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { NavLinks } from "@/components/admin/nav-links";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { can, PERMISSIONS } from "@/lib/permissions";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Databaseopslag (ikke JWT): slettet/deaktiveret bruger og sessioner udstedt før et kodeskift sendes til log ind.
  const state = await getSessionState();
  if (state.status === "anonymous") redirect("/login");
  const { user } = state;
  const logout = async () => {
    "use server";
    await signOut({ redirectTo: "/login" });
  };

  // Tvungen kodeskift (midlertidig adgangskode): ALLE /redaktion-sider vises som kodeskift — children (selve siden) renderes
  // slet ikke, så intet indhold kan nås. Server actions er spærret separat i getAuthorizedUser/getFreshSession.
  if (state.status === "must-change-password") {
    return (
      <main className="login-page">
        <div className="stack" style={{ width: "min(460px, 100%)" }}>
          <ChangePasswordForm email={user.email} name={user.name} forced />
          <form action={logout}>
            <button className="btn btn-secondary" type="submit"><LogOut size={14} aria-hidden="true" /> Log ud</button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/redaktion/artikler" className="sidebar-brand">
          <span className="sidebar-brand-mark"><LayoutGrid size={15} /></span>
          <span>
            <span className="sidebar-brand-name" style={{ display: "block" }}>Lysdals</span>
            <span className="sidebar-brand-sub">Redaktion</span>
          </span>
        </Link>
        <NavLinks canManageUsers={can(user, PERMISSIONS.USERS_MANAGE)} />
        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <Link href="/redaktion/chat" className="sidebar-cta"><MessageSquare size={16} /> AI Assistent</Link>
          <div className="sidebar-user">
            <strong>{user.name}</strong>
            <small>{user.roleName}</small>
          </div>
          <Link href="/redaktion/konto" className="sidebar-logout"><UserRound size={16} /> Min konto</Link>
          <form action={logout}>
            <button className="sidebar-logout" type="submit"><LogOut size={16} /> Log ud</button>
          </form>
        </div>
      </aside>
      <div className="app-content">{children}</div>
    </div>
  );
}
