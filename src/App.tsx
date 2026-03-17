import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
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
import PoolSettingsPage from "./pages/PoolSettingsPage";
import BracketEntryPage from "./pages/BracketEntryPage";
import BracketDetailPage from "./pages/BracketDetailPage";
import BracketComparePage from "./pages/BracketComparePage";
import LeaderboardPage from "./pages/LeaderboardPage";
import AdminToolsPage from "./pages/AdminToolsPage";
import GameCenterPage from "./pages/GameCenterPage";
import ProfilePage from "./pages/ProfilePage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import RankingsListPage from "./pages/RankingsListPage";
import CreateRankingPage from "./pages/CreateRankingPage";
import RankingDetailPage from "./pages/RankingDetailPage";
import PollsListPage from "./pages/PollsListPage";
import DraftsListPage from "./pages/DraftsListPage";
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
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* Dashboard */}
            <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />

            {/* Brackets module */}
            <Route path="/brackets" element={<ProtectedPage><PoolsListPage /></ProtectedPage>} />
            <Route path="/pools" element={<Navigate to="/brackets" replace />} />
            <Route path="/pools/create" element={<ProtectedPage><CreatePoolPage /></ProtectedPage>} />
            <Route path="/pools/join" element={<ProtectedPage><JoinPoolPage /></ProtectedPage>} />
            <Route path="/pools/:poolId" element={<ProtectedPage><PoolDetailPage /></ProtectedPage>} />
            <Route path="/pools/:poolId/settings" element={<ProtectedPage><PoolSettingsPage /></ProtectedPage>} />
            <Route path="/pools/:poolId/bracket/edit" element={<ProtectedPage><BracketEntryPage /></ProtectedPage>} />
            <Route path="/pools/:poolId/bracket/compare" element={<ProtectedPage><BracketComparePage /></ProtectedPage>} />
            <Route path="/pools/:poolId/bracket/:bracketId" element={<ProtectedPage><BracketDetailPage /></ProtectedPage>} />
            <Route path="/pools/:poolId/leaderboard" element={<ProtectedPage><LeaderboardPage /></ProtectedPage>} />
            <Route path="/pools/:poolId/admin" element={<ProtectedPage><AdminToolsPage /></ProtectedPage>} />
            <Route path="/pools/:poolId/games" element={<ProtectedPage><GameCenterPage /></ProtectedPage>} />

            {/* Rankings module */}
            <Route path="/rankings" element={<ProtectedPage><RankingsListPage /></ProtectedPage>} />
            <Route path="/rankings/create" element={<ProtectedPage><CreateRankingPage /></ProtectedPage>} />
            <Route path="/rankings/:rankingId" element={<ProtectedPage><RankingDetailPage /></ProtectedPage>} />

            {/* Polls module */}
            <Route path="/polls" element={<ProtectedPage><PollsListPage /></ProtectedPage>} />

            {/* Drafts module */}
            <Route path="/drafts" element={<ProtectedPage><DraftsListPage /></ProtectedPage>} />

            <Route path="/profile" element={<ProtectedPage><ProfilePage /></ProtectedPage>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
