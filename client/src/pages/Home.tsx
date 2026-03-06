import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Home page simply redirects to the dashboard.
 * Authentication is handled by DashboardLayout which shows
 * the password login page if the user is not authenticated.
 */
export default function Home() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/dashboard");
  }, [setLocation]);

  return null;
}
