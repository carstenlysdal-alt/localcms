import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, PERMISSIONS } from "@/lib/permissions";
import { CategoryManager } from "@/components/admin/category-manager";

export const metadata = {
  title: "Sektioner — Redaktion",
};

export default async function SectionsAdminPage() {
  const session = await auth();
  if (!session?.user) return null;

  const hasAccess =
    can(session.user, PERMISSIONS.CATEGORY_MANAGE) ||
    can(session.user, PERMISSIONS.FRONTPAGE_EDIT) ||
    can(session.user, PERMISSIONS.ARTICLE_EDIT_ALL);

  if (!hasAccess) {
    return (
      <main className="admin-main">
        <div className="dialog inline-dialog">
          <h1 className="dialog-title">Ingen adgang</h1>
          <p className="dialog-body">Du har ikke rettigheder til at administrere sektioner.</p>
        </div>
      </main>
    );
  }

  const rawCategories = await db.category.findMany({
    where: {
      instansId: session.user.instansId,
      parentId: null,
    },
    orderBy: { sortering: "asc" },
    include: {
      _count: {
        select: { articles: true },
      },
      children: {
        orderBy: { sortering: "asc" },
        include: {
          _count: {
            select: { articles: true },
          },
        },
      },
    },
  });

  const categories = rawCategories.map((c) => ({
    id: c.id,
    navn: c.navn,
    slug: c.slug,
    beskrivelse: c.beskrivelse,
    sortering: c.sortering,
    iNavigation: c.iNavigation,
    parentId: c.parentId,
    articlesCount: c._count.articles,
    children: c.children.map((sub) => ({
      id: sub.id,
      navn: sub.navn,
      slug: sub.slug,
      beskrivelse: sub.beskrivelse,
      sortering: sub.sortering,
      iNavigation: sub.iNavigation,
      parentId: sub.parentId,
      articlesCount: sub._count.articles,
    })),
  }));

  return (
    <main className="admin-main">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Struktur & Taksonomi</span>
          <h1>Sektioner</h1>
        </div>
      </div>

      <CategoryManager categories={categories} />
    </main>
  );
}
