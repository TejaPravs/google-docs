import { redirect } from "next/navigation";

// Middleware normally handles this; fallback in case it is bypassed.
export default function Home() {
  redirect("/docs");
}
