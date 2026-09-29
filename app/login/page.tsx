import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string; error?: string }> }) {
  if ((await auth())?.user) redirect("/redaktion/artikler");
  const params = await searchParams;
  const callbackUrl = typeof params.callbackUrl === "string" && params.callbackUrl.startsWith("/") ? params.callbackUrl : "/redaktion/artikler";
  return <main className="login-page"><LoginForm callbackUrl={callbackUrl} /></main>;
}
