import { createContext, useContext, useState, ReactNode } from 'react';

interface NavDrawerCtx {
  open: boolean;
  setOpen: (o: boolean) => void;
  toggle: () => void;
}

const Ctx = createContext<NavDrawerCtx>({ open: false, setOpen: () => {}, toggle: () => {} });

export function NavDrawerProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Ctx.Provider value={{ open, setOpen, toggle: () => setOpen((v) => !v) }}>
      {children}
    </Ctx.Provider>
  );
}

export const useNavDrawer = () => useContext(Ctx);
