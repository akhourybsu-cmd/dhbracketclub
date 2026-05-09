import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';
import { ClubAssetLibrary } from '@/components/clubAssets/ClubAssetLibrary';

export default function ClubAssetsPage() {
  return (
    <div className="min-h-screen bg-background px-4 py-6" style={{ paddingTop: 'max(1.5rem, env(safe-area-inset-top))' }}>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg mx-auto"
      >
        <Link
          to="/club/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-5 btn-press"
        >
          <ArrowLeft className="w-4 h-4" /> Club Settings
        </Link>

        <ClubAssetLibrary />
      </motion.div>
    </div>
  );
}
