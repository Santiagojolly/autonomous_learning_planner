import { BrowserRouter, Routes, Route } from "react-router";
import { LandingPage } from "./pages/LandingPage";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { DashboardLayout } from "./components/DashboardLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { DashboardHome } from "./pages/DashboardHome";
import { StudyPlanner } from "./pages/StudyPlanner";
import { Calendar } from "./pages/Calendar";
import { AIInsights } from "./pages/AIInsights";
import { AICommandCenter } from "./pages/AICommandCenter";
import { Profile } from "./pages/Profile";
import { Settings } from "./pages/Settings";
import { AuthProvider } from "./context/AuthContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Toaster } from "sonner";
import { useGuardianAgent } from "./lib/hooks/useGuardianAgent";

function GuardianAgentProvider() {
  useGuardianAgent();
  return null;
}

export default function App() {
  console.log("=".repeat(60));
  console.log("🎓 HALO - Autonomous Learning Core");
  console.log("=".repeat(60));

  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <GuardianAgentProvider />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardHome />} />
              <Route path="planner" element={<StudyPlanner />} />
              <Route path="calendar" element={<Calendar />} />
              <Route path="insights" element={<AIInsights />} />
              <Route path="ai-agents" element={<AICommandCenter />} />
              <Route path="profile" element={<Profile />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}