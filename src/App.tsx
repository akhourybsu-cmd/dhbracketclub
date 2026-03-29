import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import { PageTransition } from "@/components/PageTransition";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "next-themes";

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
import CreatePollPage from "./pages/CreatePollPage";
import PollDetailPage from "./pages/PollDetailPage";
import DraftsListPage from "./pages/DraftsListPage";
import CreateDraftPage from "./pages/CreateDraftPage";
import DraftDetailPage from "./pages/DraftDetailPage";
import ChatPage from "./pages/ChatPage";
import EventsPage from "./pages/EventsPage";
import EventDetailPage from "./pages/EventDetailPage";
import CompetePage from "./pages/CompetePage";
import FeedPage from "./pages/FeedPage";
import PostsPage from "./pages/PostsPage";
import PostDetailPage from "./pages/PostDetailPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout><PageTransition>{children}</PageTransition></AppLayout>
  </ProtectedRoute>
);

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<LandingPage />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* Dashboard / Home */}
        <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />

        {/* Chat */}
        <Route path="/chat" element={<ProtectedPage><ChatPage /></ProtectedPage>} />

        {/* Events */}
        <Route path="/events" element={<ProtectedPage><EventsPage /></ProtectedPage>} />
        <Route path="/events/:eventId" element={<ProtectedPage><EventDetailPage /></ProtectedPage>} />

        {/* Compete hub */}
        <Route path="/compete" element={<ProtectedPage><CompetePage /></ProtectedPage>} />

        {/* Feed + Posts */}
        <Route path="/feed" element={<ProtectedPage><FeedPage /></ProtectedPage>} />
        <Route path="/posts" element={<ProtectedPage><PostsPage /></ProtectedPage>} />
        <Route path="/posts/create" element={<ProtectedPage><PostsPage /></ProtectedPage>} />
        <Route path="/posts/:postId" element={<ProtectedPage><PostDetailPage /></ProtectedPage>} />

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
        <Route path="/polls/create" element={<ProtectedPage><CreatePollPage /></ProtectedPage>} />
        <Route path="/polls/:pollId" element={<ProtectedPage><PollDetailPage /></ProtectedPage>} />

        {/* Drafts module */}
        <Route path="/drafts" element={<ProtectedPage><DraftsListPage /></ProtectedPage>} />
        <Route path="/drafts/create" element={<ProtectedPage><CreateDraftPage /></ProtectedPage>} />
        <Route path="/drafts/:draftId" element={<ProtectedPage><DraftDetailPage /></ProtectedPage>} />

        <Route path="/profile" element={<ProtectedPage><ProfilePage /></ProtectedPage>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </AnimatePresence>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Sonner />
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
