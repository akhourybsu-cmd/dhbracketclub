import { lazy, Suspense } from "react";
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
import { useAppUpdate } from "@/hooks/useAppUpdate";

// Lazy-loaded pages for code splitting
const LandingPage = lazy(() => import("./pages/LandingPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const CreatePoolPage = lazy(() => import("./pages/CreatePoolPage"));
const JoinPoolPage = lazy(() => import("./pages/JoinPoolPage"));
const PoolDetailPage = lazy(() => import("./pages/PoolDetailPage"));
const PoolsListPage = lazy(() => import("./pages/PoolsListPage"));
const PoolSettingsPage = lazy(() => import("./pages/PoolSettingsPage"));
const BracketEntryPage = lazy(() => import("./pages/BracketEntryPage"));
const BracketDetailPage = lazy(() => import("./pages/BracketDetailPage"));
const BracketComparePage = lazy(() => import("./pages/BracketComparePage"));
const LeaderboardPage = lazy(() => import("./pages/LeaderboardPage"));
const AdminToolsPage = lazy(() => import("./pages/AdminToolsPage"));
const GameCenterPage = lazy(() => import("./pages/GameCenterPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const RankingsListPage = lazy(() => import("./pages/RankingsListPage"));
const CreateRankingPage = lazy(() => import("./pages/CreateRankingPage"));
const RankingDetailPage = lazy(() => import("./pages/RankingDetailPage"));
const PollsListPage = lazy(() => import("./pages/PollsListPage"));
const CreatePollPage = lazy(() => import("./pages/CreatePollPage"));
const PollDetailPage = lazy(() => import("./pages/PollDetailPage"));
const DraftsListPage = lazy(() => import("./pages/DraftsListPage"));
const CreateDraftPage = lazy(() => import("./pages/CreateDraftPage"));
const DraftDetailPage = lazy(() => import("./pages/DraftDetailPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const EventsPage = lazy(() => import("./pages/EventsPage"));
const EventDetailPage = lazy(() => import("./pages/EventDetailPage"));
const CompetePage = lazy(() => import("./pages/CompetePage"));
const LockboxPage = lazy(() => import("./pages/LockboxPage"));
const LockboxCrackPage = lazy(() => import("./pages/LockboxCrackPage"));
const FeedPage = lazy(() => import("./pages/FeedPage"));
const LorePage = lazy(() => import("./pages/LorePage"));
const LoreDetailPage = lazy(() => import("./pages/LoreDetailPage"));
const PostsPage = lazy(() => import("./pages/PostsPage"));
const PostDetailPage = lazy(() => import("./pages/PostDetailPage"));
const SharedMediaPage = lazy(() => import("./pages/SharedMediaPage"));
const PickemHomePage = lazy(() => import("./pages/PickemHomePage"));
const PickemWeekPage = lazy(() => import("./pages/PickemWeekPage"));
const PickemWeekResultsPage = lazy(() => import("./pages/PickemWeekResultsPage"));
const PickemStandingsPage = lazy(() => import("./pages/PickemStandingsPage"));
const PickemHistoryPage = lazy(() => import("./pages/PickemHistoryPage"));
const PickemRulesPage = lazy(() => import("./pages/PickemRulesPage"));
const PickemAdminPage = lazy(() => import("./pages/PickemAdminPage"));
const RuneDelveHomePage = lazy(() => import("./pages/RuneDelveHomePage"));
const RuneDelvePlayPage = lazy(() => import("./pages/RuneDelvePlayPage"));
const RuneDelveResultsPage = lazy(() => import("./pages/RuneDelveResultsPage"));
const RuneDelveLeaderboardPage = lazy(() => import("./pages/RuneDelveLeaderboardPage"));
const RuneDelveHeroPage = lazy(() => import("./pages/RuneDelveHeroPage"));
const RuneDelveHistoryPage = lazy(() => import("./pages/RuneDelveHistoryPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes — prevents redundant refetches
      gcTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Minimal loading fallback that matches the app's visual language
function PageFallback() {
  return (
    <div className="flex items-center justify-center py-24">
      <div className="loading-spinner-ring" />
    </div>
  );
}

const ProtectedPage = ({ children }: { children: React.ReactNode }) => (
  <ProtectedRoute>
    <AppLayout>
      <PageTransition>
        <Suspense fallback={<PageFallback />}>
          {children}
        </Suspense>
      </PageTransition>
    </AppLayout>
  </ProtectedRoute>
);

function AnimatedRoutes() {
  const location = useLocation();

  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Suspense fallback={<PageFallback />}><LandingPage /></Suspense>} />
        <Route path="/auth" element={<Suspense fallback={<PageFallback />}><AuthPage /></Suspense>} />
        <Route path="/reset-password" element={<Suspense fallback={<PageFallback />}><ResetPasswordPage /></Suspense>} />

        {/* Dashboard / Home */}
        <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />

        {/* Chat */}
        <Route path="/chat" element={<ProtectedPage><ChatPage /></ProtectedPage>} />
        <Route path="/shared" element={<ProtectedPage><SharedMediaPage /></ProtectedPage>} />

        {/* Events */}
        <Route path="/events" element={<ProtectedPage><EventsPage /></ProtectedPage>} />
        <Route path="/events/:eventId" element={<ProtectedPage><EventDetailPage /></ProtectedPage>} />

        {/* Compete hub */}
        <Route path="/compete" element={<ProtectedPage><CompetePage /></ProtectedPage>} />

        {/* Lockbox module */}
        <Route path="/lockbox" element={<ProtectedPage><LockboxPage /></ProtectedPage>} />
        <Route path="/lockbox/:lockId" element={<ProtectedPage><LockboxCrackPage /></ProtectedPage>} />

        {/* DH Lore */}
        <Route path="/lore" element={<ProtectedPage><LorePage /></ProtectedPage>} />
        <Route path="/lore/:loreId" element={<ProtectedPage><LoreDetailPage /></ProtectedPage>} />

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

        {/* NFL Pick'em module */}
        <Route path="/pickem" element={<ProtectedPage><PickemHomePage /></ProtectedPage>} />
        <Route path="/pickem/week/:weekNumber" element={<ProtectedPage><PickemWeekPage /></ProtectedPage>} />
        <Route path="/pickem/week/:weekNumber/results" element={<ProtectedPage><PickemWeekResultsPage /></ProtectedPage>} />
        <Route path="/pickem/standings" element={<ProtectedPage><PickemStandingsPage /></ProtectedPage>} />
        <Route path="/pickem/history" element={<ProtectedPage><PickemHistoryPage /></ProtectedPage>} />
        <Route path="/pickem/rules" element={<ProtectedPage><PickemRulesPage /></ProtectedPage>} />
        <Route path="/pickem/admin" element={<ProtectedPage><PickemAdminPage /></ProtectedPage>} />

        {/* Rune Delve module */}
        <Route path="/rune-delve" element={<ProtectedPage><RuneDelveHomePage /></ProtectedPage>} />
        <Route path="/rune-delve/play" element={<ProtectedPage><RuneDelvePlayPage /></ProtectedPage>} />
        <Route path="/rune-delve/results" element={<ProtectedPage><RuneDelveResultsPage /></ProtectedPage>} />
        <Route path="/rune-delve/leaderboard" element={<ProtectedPage><RuneDelveLeaderboardPage /></ProtectedPage>} />
        <Route path="/rune-delve/hero" element={<ProtectedPage><RuneDelveHeroPage /></ProtectedPage>} />
        <Route path="/rune-delve/history" element={<ProtectedPage><RuneDelveHistoryPage /></ProtectedPage>} />

        <Route path="/profile" element={<ProtectedPage><ProfilePage /></ProtectedPage>} />
        <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
      </Routes>
    </AnimatePresence>
  );
}

function AppWithUpdate() {
  useAppUpdate();
  return <AnimatedRoutes />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <TooltipProvider>
          <Sonner />
          <BrowserRouter>
            <AppWithUpdate />
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
