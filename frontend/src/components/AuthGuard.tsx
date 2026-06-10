"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const PUBLIC_PATHS = ["/login", "/register"];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // SSR: render nothing initially, no spinner
  if (!mounted) {
    return null;
  }

  // Client-side: check auth
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) {
    return <>{children}</>;
  }

  const token = localStorage.getItem("access_token");
  if (!token) {
    // Use useEffect to avoid setState during render
    // Use setTimeout to defer redirect after this render cycle
    setTimeout(() => router.replace("/login"), 0);
    return null;
  }

  return <>{children}</>;
}
