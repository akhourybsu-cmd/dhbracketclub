import { motion } from 'framer-motion';
import { ReactNode } from 'react';

const pageVariants = {
  initial: { opacity: 0, y: 8, scale: 0.99 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: -4, scale: 0.99 },
};

const pageTransition = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 30,
  mass: 0.8,
};

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      transition={pageTransition}
    >
      {children}
    </motion.div>
  );
}
