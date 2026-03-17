import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';

export default function PollsListPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="page-header mb-0">
          <div className="page-header-icon"><MessageCircle /></div>
          <div>
            <h1 className="page-header-title">Polls</h1>
            <p className="page-header-subtitle">Quick votes & group decisions</p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="empty-state"
      >
        <div className="empty-state-icon"><MessageCircle /></div>
        <p className="empty-state-title">Polls coming soon</p>
        <p className="empty-state-desc mb-6">Create quick polls and settle debates with your crew.</p>
      </motion.div>
    </div>
  );
}
