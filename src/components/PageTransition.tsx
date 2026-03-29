import { motion } from 'framer-motion';
import { ReactNode, forwardRef } from 'react';

const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -4 },
};

const pageTransition = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 30,
  mass: 0.8,
};

export const PageTransition = forwardRef<HTMLDivElement, { children: ReactNode }>(
  ({ children }, ref) => {
    return (
      <motion.div
        ref={ref}
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
);

PageTransition.displayName = 'PageTransition';
