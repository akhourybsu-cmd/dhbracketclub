import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BarChart3, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function RankingsListPage() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="page-header mb-0">
          <div className="page-header-icon"><BarChart3 /></div>
          <div>
            <h1 className="page-header-title">Rankings</h1>
            <p className="page-header-subtitle">Power rankings & tier lists</p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="empty-state"
      >
        <div className="empty-state-icon"><BarChart3 /></div>
        <p className="empty-state-title">Rankings coming soon</p>
        <p className="empty-state-desc mb-6">Create power rankings, tier lists, and ranked votes with your crew.</p>
      </motion.div>
    </div>
  );
}
