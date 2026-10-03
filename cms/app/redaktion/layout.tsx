import Link from "next/link";
import { headers } from "next/headers";
import { LayoutGrid, LogOut } from "lucide-react";
import { getSessionState, signOut } from "@/lib/auth";
import { redirect } from "next/navigation";
import { loadNavCities } from "@/lib/shell-cities";
import { can, PERMISSIONS } from "@/lib/permissions";
import { ChangePasswordForm } from "@/components/admin/change-password-form";
import { NavLinks } from "@/components/admin/nav-links";
import { CitySwitcher } from "@/components/admin/city-switcher";
import { ShellFrame } from "@/components/admin/shell-frame";
import { BottomNav } from "@/components/admin/bottom-nav";
import { UserMenu } from "@/components/admin/user-menu";
import { GlobalSearch } from "@/components/admin/global-search";
import { AiOperatorButton, MobileMenuButton } from "@/components/admin/topbar";
import { bottomNavItems, buildNav, canSeeOperator, countsPartnerBriefs } from "@/components/admin/nav-model";
import { countNewIntake } from "@/components/admin/nav-counts";
import { OperatorPanel } from "@/components/operator/operator-panel";

/** Sendes sidens anmodning fra en iframe (forside-forhåndsvisning)? Uden for en request (fx i tests) er svaret nej. */
async function isIframeRequest(): Promise<boolean> {
  try {
    return (await headers()).get("sec-fetch-dest") === "iframe";
  } catch {
    return false;
  }
}

/** Redaktionens skal: grupperet sidebar (rettighedsfiltreret), topbar med søgning og AI-operatør, mobil-drawer + bundnavigation. */
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
      <main className="login-page cms-root">
        <div className="stack login-stack">
          <ChangePasswordForm email={user.email} name={user.name} forced />
          <form action={logout}>
            <button className="btn btn-secondary" type="submit"><LogOut size={14} aria-hidden="true" /> Log ud</button>
          </form>
        </div>
      </main>
    );
  }

  // Forside-forhåndsvisningen indlæses i en iframe i forside-editoren: der skal ikke ligge en ekstra skal omkring den.
  if (await isIframeRequest()) return <div className="cms-root">{children}</div>;

  const [inboxCount, cities] = await Promise.all([
    countNewIntake(user.instansId, countsPartnerBriefs(user)),
    // De byer brugeren må redigere (hjem + adgangsrækker) — altid fra databasen. Den aktive by er user.instansId (valideret).
    loadNavCities(user),
  ]);
  const groups = buildNav(user, { inbox: inboxCount });
  const currentCity = cities.find((c) => c.current)?.by;
  const searchPages = groups.flatMap((g) => g.items.map((i) => ({ href: i.href, label: i.label, group: g.label, icon: i.icon })));
  const operator = can(user, PERMISSIONS.OPERATOR_USE);

  return (
    <div className="cms-root">
      <a className="shell-skip" href="#main-content">Spring til indhold</a>
      <ShellFrame>
        <aside id="shell-sidebar" className="shell-sidebar" aria-label="Sidebar">
          <Link href="/redaktion/artikler" className="shell-brand">
            <span className="shell-brand-mark" aria-hidden="true"><LayoutGrid size={18} /></span>
            <span>
              <span className="shell-brand-name">Lysdals</span>
              <span className="shell-brand-sub">Redaktion{currentCity ? ` · ${currentCity}` : ""}</span>
            </span>
          </Link>
          <NavLinks groups={groups} cities={cities} />
          <UserMenu
            name={user.name}
            roleName={user.roleName}
            canManageUsers={can(user, PERMISSIONS.USERS_MANAGE)}
            canUseOperator={canSeeOperator(user)}
            logoutAction={logout}
          />
        </aside>
        <div className="shell-main">
          <header className="shell-topbar" data-shell-inert>
            <MobileMenuButton />
            <Link href="/redaktion/artikler" className="shell-topbar-brand">Lysdals</Link>
            <GlobalSearch pages={searchPages} />
            <div className="shell-topbar-spacer" />
            <CitySwitcher cities={cities} />
            <AiOperatorButton hasPanel={operator} />
          </header>
          <div id="main-content" tabIndex={-1} className="shell-content" data-shell-inert>{children}</div>
        </div>
        <BottomNav items={bottomNavItems(groups)} />
      </ShellFrame>
      {/* AI-operatør: flydende knap + Cmd/Ctrl+K på alle /redaktion-sider (components/operator). Lytter på cms:operator-open fra topbaren. */}
      <OperatorPanel user={user} />
    </div>
  );
}
