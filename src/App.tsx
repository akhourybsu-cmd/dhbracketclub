import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

import LandingPage from "./pages/LandingPage";
import AuthPage from "./pages/AuthPage";
import DashboardPage from "./pages/DashboardPage";
import CreatePoolPage from "./pages/CreatePoolPage";
import JoinPoolPage from "./pages/JoinPoolPage";
import PoolDetailPage from "./pages/PoolDetailPage";
import PoolsListPage from "./pages/PoolsListPage";
import BracketEntryPage from "./pages/BracketEntryPage";
import BracketDetailPage from "./pages/BracketDetailPage";
import BracketComparePage from "./pages/BracketComparePage";
import LeaderboardPage from "./pages/LeaderboardPage";
import AdminToolsPage from "./pages/AdminToolsPage";
import ProfilePage from "./pages/ProfilePage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>{children}</AppLayout>
  </ProtectedRoute>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
            <Route path="/pools" element={<ProtectedPage><PoolsListPage /></ProtectedPage>} />
            <Route path="/pools/create" element={<ProtectedPage><CreatePoolPage /></ProtectedPage>} />
            <Route path="/pools/join" element={<ProtectedPage><JoinPoolPage /></ProtectedPage>} />
            <Route path="/pools/:poolId" element={<ProtectedPage><PoolDetailPage /></ProtectedPage>} />
            <Route path="/pools/:poolId/bracket/edit" element={<ProtectedPage><BracketEntryPage /></ProtectedPage>} />
            <Route path="/pools/:poolId/bracket/compare" element={<ProtectedPage><BracketComparePage /></ProtectedPage>} />
            <Route path="/pools/:poolId/bracket/:bracketId" element={<ProtectedPage><BracketDetailPage /></ProtectedPage>} />
            <Route path="/pools/:poolId/leaderboard" element={<ProtectedPage><LeaderboardPage /></ProtectedPage>} />
            <Route path="/pools/:poolId/admin" element={<ProtectedPage><AdminToolsPage /></ProtectedPage>} />
            <Route path="/leaderboard" element={<ProtectedPage><LeaderboardPage /></ProtectedPage>} />
            <Route path="/profile" element={<ProtectedPage><ProfilePage /></ProtectedPage>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
