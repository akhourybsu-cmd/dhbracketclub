import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ClubProvider } from "@/contexts/ClubContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ClubGate } from "@/components/ClubGate";
import { AppLayout } from "@/components/AppLayout";
import { PageTransition } from "@/components/PageTransition";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "next-themes";
import { useAppUpdate } from "@/hooks/useAppUpdate";
import { useOfflineIndicator } from "@/hooks/useOfflineIndicator";
import { useRoutePrefetch } from "@/hooks/useRoutePrefetch";

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
const RuneDelveAnalyticsPage = lazy(() => import("./pages/RuneDelveAnalyticsPage"));
const RuneDelveSimulatorPage = lazy(() => import("./pages/RuneDelveSimulatorPage"));
const RuneDelveBalanceReportPage = lazy(() => import("./pages/RuneDelveBalanceReportPage"));
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
const SeasonsArchivePage = lazy(() => import("./pages/SeasonsArchivePage"));
const SeasonArchiveDetailPage = lazy(() => import("./pages/SeasonArchiveDetailPage"));
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
const RuneDelveLevelMapPage = lazy(() => import("./pages/RuneDelveLevelMapPage"));
const RuneDelvePlayPage = lazy(() => import("./pages/RuneDelvePlayPage"));
const RuneDelveResultsPage = lazy(() => import("./pages/RuneDelveResultsPage"));
const RuneDelveLeaderboardPage = lazy(() => import("./pages/RuneDelveLeaderboardPage"));
const RuneDelveHeroPage = lazy(() => import("./pages/RuneDelveHeroPage"));
const RuneDelveHistoryPage = lazy(() => import("./pages/RuneDelveHistoryPage"));
const RuneDelveShopPage = lazy(() => import("./pages/RuneDelveShopPage"));
const RuneDelveArmoryPage = lazy(() => import("./pages/RuneDelveArmoryPage"));
const RuneDelveBestiaryPage = lazy(() => import("./pages/RuneDelveBestiaryPage"));
const RuneDelveDailyPage = lazy(() => import("./pages/RuneDelveDailyPage"));
const RuneDelveEndlessPage = lazy(() => import("./pages/RuneDelveEndlessPage"));
const RuneDelveQuestsPage = lazy(() => import("./pages/RuneDelveQuestsPage"));
const RequestClubPage = lazy(() => import("./pages/RequestClubPage"));
const AdminClubsPage = lazy(() => import("./pages/AdminClubsPage"));
const ClubSettingsPage = lazy(() => import("./pages/ClubSettingsPage"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/AdminUsersPage"));
const AdminCompetitionsPage = lazy(() => import("./pages/AdminCompetitionsPage"));
const AdminAuditPage = lazy(() => import("./pages/AdminAuditPage"));
const AdminDiagnosticsPage = lazy(() => import("./pages/AdminDiagnosticsPage"));
const AdminAnnouncementsPage = lazy(() => import("./pages/AdminAnnouncementsPage"));
const AdminFeatureFlagsPage = lazy(() => import("./pages/AdminFeatureFlagsPage"));
const AdminNotesPage = lazy(() => import("./pages/AdminNotesPage"));
import { AdminRoute } from "./components/auth/AdminRoute";
import { ClubAdminRoute } from "./components/auth/ClubAdminRoute";
const NexusHomePage = lazy(() => import("./pages/NexusHomePage"));
const NexusMissionsPage = lazy(() => import("./pages/NexusMissionsPage"));
const NexusLoadoutPage = lazy(() => import("./pages/NexusLoadoutPage"));
const NexusBattlePage = lazy(() => import("./pages/NexusBattlePage"));
const NexusResultsPage = lazy(() => import("./pages/NexusResultsPage"));
const NexusLeaderboardPage = lazy(() => import("./pages/NexusLeaderboardPage"));
const NexusCodexPage = lazy(() => import("./pages/NexusCodexPage"));
const NexusBalancePage = lazy(() => import("./pages/NexusBalancePage"));
const NexusCalibrationPage = lazy(() => import("./pages/NexusCalibrationPage"));
const NexusOperationPage = lazy(() => import("./pages/NexusOperationPage"));
const NexusSigilVaultPage = lazy(() => import("./pages/NexusSigilVaultPage"));
const NexusSimulatorPage = lazy(() => import("./pages/NexusSimulatorPage"));
const NexusMissionWorkshopPage = lazy(() => import("./pages/NexusMissionWorkshopPage"));
const PortfolioWarsPage = lazy(() => import("./pages/PortfolioWarsPage"));
import { PwLayout } from "./components/portfolioWars/PwLayout";
import { RuneDelveLayout } from "./components/runedelve/RuneDelveLayout";
import { NexusLayout } from "./components/nexus/NexusLayout";
import { PickemLayout } from "./components/pickem/PickemLayout";
import { DraftArenaLayout } from "./components/drafts/DraftArenaLayout";
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
    <ClubGate>
      <AppLayout>
        <PageTransition>
          <Suspense fallback={<PageFallback />}>
            {children}
          </Suspense>
        </PageTransition>
      </AppLayout>
    </ClubGate>
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

        {/* Portfolio Wars — weekly stock-picking challenge */}
        <Route path="/portfolio-wars" element={<ProtectedPage><PwLayout><PortfolioWarsPage /></PwLayout></ProtectedPage>} />

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

        {/* Drafts module — standalone Draft Arena shell (own boot, HUD, no DH chrome) */}
        <Route path="/drafts" element={<ProtectedPage><DraftArenaLayout><DraftsListPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/seasons" element={<ProtectedPage><DraftArenaLayout><SeasonsArchivePage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/seasons/:seasonId" element={<ProtectedPage><DraftArenaLayout><SeasonArchiveDetailPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/create" element={<ProtectedPage><DraftArenaLayout><CreateDraftPage /></DraftArenaLayout></ProtectedPage>} />
        <Route path="/drafts/:draftId" element={<ProtectedPage><DraftArenaLayout><DraftDetailPage /></DraftArenaLayout></ProtectedPage>} />

        {/* NFL Pick'em module — standalone shell (own boot, HUD, no DH chrome) */}
        <Route path="/pickem" element={<ProtectedPage><PickemLayout><PickemHomePage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/week/:weekNumber" element={<ProtectedPage><PickemLayout><PickemWeekPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/week/:weekNumber/results" element={<ProtectedPage><PickemLayout><PickemWeekResultsPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/standings" element={<ProtectedPage><PickemLayout><PickemStandingsPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/history" element={<ProtectedPage><PickemLayout><PickemHistoryPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/rules" element={<ProtectedPage><PickemLayout><PickemRulesPage /></PickemLayout></ProtectedPage>} />
        <Route path="/pickem/admin" element={<ProtectedPage><PickemLayout><PickemAdminPage /></PickemLayout></ProtectedPage>} />

        {/* Rune Delve module — campaign */}
        <Route path="/rune-delve" element={<ProtectedPage><RuneDelveLayout><RuneDelveHomePage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/levels" element={<ProtectedPage><RuneDelveLayout><RuneDelveLevelMapPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/play/:levelNumber" element={<ProtectedPage><RuneDelveLayout><RuneDelvePlayPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/results/:levelNumber" element={<ProtectedPage><RuneDelveLayout><RuneDelveResultsPage /></RuneDelveLayout></ProtectedPage>} />
        {/* Back-compat redirects from old daily routes */}
        <Route path="/rune-delve/play" element={<Navigate to="/rune-delve/levels" replace />} />
        <Route path="/rune-delve/results" element={<Navigate to="/rune-delve" replace />} />
        <Route path="/rune-delve/leaderboard" element={<ProtectedPage><RuneDelveLayout><RuneDelveLeaderboardPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/hero" element={<ProtectedPage><RuneDelveLayout><RuneDelveHeroPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/history" element={<ProtectedPage><RuneDelveLayout><RuneDelveHistoryPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/shop" element={<ProtectedPage><RuneDelveLayout><RuneDelveShopPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/armory" element={<ProtectedPage><RuneDelveLayout><RuneDelveArmoryPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/bestiary" element={<ProtectedPage><RuneDelveLayout><RuneDelveBestiaryPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/daily" element={<ProtectedPage><RuneDelveLayout><RuneDelveDailyPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/endless" element={<ProtectedPage><RuneDelveLayout><RuneDelveEndlessPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/quests" element={<ProtectedPage><RuneDelveLayout><RuneDelveQuestsPage /></RuneDelveLayout></ProtectedPage>} />
        <Route path="/rune-delve/analytics" element={<ProtectedPage><RuneDelveAnalyticsPage /></ProtectedPage>} />
        <Route path="/rune-delve/simulator" element={<ProtectedPage><RuneDelveSimulatorPage /></ProtectedPage>} />
        <Route path="/rune-delve/balance" element={<ProtectedPage><RuneDelveBalanceReportPage /></ProtectedPage>} />

        {/* Nexus Defense — sci-fi tower defense (full-screen game shell) */}
        <Route path="/nexus" element={<ProtectedPage><NexusLayout><NexusHomePage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/missions" element={<ProtectedPage><NexusLayout><NexusMissionsPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/loadout/:missionId" element={<ProtectedPage><NexusLayout><NexusLoadoutPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/battle/:missionId" element={<ProtectedPage><NexusLayout><NexusBattlePage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/results/:missionId" element={<ProtectedPage><NexusLayout><NexusResultsPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/leaderboard" element={<ProtectedPage><NexusLayout><NexusLeaderboardPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/codex" element={<ProtectedPage><NexusLayout><NexusCodexPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/balance" element={<ProtectedPage><NexusLayout><NexusBalancePage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/calibration" element={<ProtectedPage><NexusLayout><NexusCalibrationPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/operation" element={<ProtectedPage><NexusLayout><NexusOperationPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/sigils" element={<ProtectedPage><NexusLayout><NexusSigilVaultPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/simulator" element={<ProtectedPage><NexusLayout><NexusSimulatorPage /></NexusLayout></ProtectedPage>} />
        <Route path="/nexus/mission-workshop" element={<ProtectedPage><NexusLayout><NexusMissionWorkshopPage /></NexusLayout></ProtectedPage>} />

        <Route path="/profile" element={<ProtectedPage><ProfilePage /></ProtectedPage>} />

        {/* Clubs (multi-tenant) */}
        <Route path="/club/request" element={<ProtectedRoute><Suspense fallback={<PageFallback />}><RequestClubPage /></Suspense></ProtectedRoute>} />
        <Route path="/club/settings" element={<ProtectedPage><ClubSettingsPage /></ProtectedPage>} />
        <Route path="/admin/clubs" element={<ProtectedPage><AdminClubsPage /></ProtectedPage>} />
        {/* Legacy aliases — keep deep links working after navigation cleanup */}
        <Route path="/admin" element={<Navigate to="/admin/clubs" replace />} />
        <Route path="/club-settings" element={<Navigate to="/club/settings" replace />} />

        <Route path="*" element={<Suspense fallback={<PageFallback />}><NotFound /></Suspense>} />
      </Routes>
    </AnimatePresence>
  );
}

function AppWithUpdate() {
  useAppUpdate();
  useOfflineIndicator();
  useRoutePrefetch();
  return <AnimatedRoutes />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <ClubProvider>
          <TooltipProvider>
            <Sonner />
            <BrowserRouter>
              <AppWithUpdate />
            </BrowserRouter>
          </TooltipProvider>
        </ClubProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
