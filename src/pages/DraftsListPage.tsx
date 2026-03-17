import { motion } from 'framer-motion';
import { Bookmark } from 'lucide-react';

export default function DraftsListPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="page-header mb-0">
          <div className="page-header-icon"><Bookmark /></div>
          <div>
            <h1 className="page-header-title">Drafts</h1>
            <p className="page-header-subtitle">Snake drafts & picks</p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="empty-state"
      >
        <div className="empty-state-icon"><Bookmark /></div>
        <p className="empty-state-title">Drafts coming soon</p>
        <p className="empty-state-desc mb-6">Run snake drafts on any topic with your crew.</p>
      </motion.div>
    </div>
  );
}
