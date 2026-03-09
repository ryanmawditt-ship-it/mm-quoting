import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Home from "./pages/Home";
import ProjectsPage from "./pages/ProjectsPage";
import ProjectDetailPage from "./pages/ProjectDetailPage";
import SettingsPage from "./pages/SettingsPage";
import SuppliersPage from "./pages/SuppliersPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import PasswordLoginPage from "./pages/PasswordLoginPage";
import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";

function DashboardWrapper({ children }: { children: React.ReactNode }) {
  return <DashboardLayout>{children}</DashboardLayout>;
}

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/dashboard"}>
        {() => (
          <DashboardWrapper>
            <ProjectsPage />
          </DashboardWrapper>
        )}
      </Route>
      <Route path={"/dashboard/projects"}>
        {() => (
          <DashboardWrapper>
            <ProjectsPage />
          </DashboardWrapper>
        )}
      </Route>
      <Route path={"/dashboard/projects/:id"}>
        {() => (
          <DashboardWrapper>
            <ProjectDetailPage />
          </DashboardWrapper>
        )}
      </Route>
      <Route path={"/dashboard/suppliers"}>
        {() => (
          <DashboardWrapper>
            <SuppliersPage />
          </DashboardWrapper>
        )}
      </Route>
      <Route path={"/dashboard/analytics"}>
        {() => (
          <DashboardWrapper>
            <AnalyticsPage />
          </DashboardWrapper>
        )}
      </Route>
      <Route path={"/dashboard/settings"}>
        {() => (
          <DashboardWrapper>
            <SettingsPage />
          </DashboardWrapper>
        )}
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function PasswordGate({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/check", { credentials: "include" });
      const data = await res.json();
      setAuthenticated(data.authenticated === true);
    } catch {
      setAuthenticated(false);
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!authenticated) {
    return (
      <PasswordLoginPage
        onLoginSuccess={() => {
          setAuthenticated(true);
        }}
      />
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <PasswordGate>
            <Router />
          </PasswordGate>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
