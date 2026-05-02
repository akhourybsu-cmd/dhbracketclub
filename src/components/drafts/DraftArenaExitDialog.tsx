import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * "Leave the Draft Arena?" confirmation. Mirrors the Pick'em / Nexus exit
 * pattern so stepping out of the standalone Draft shell is deliberate.
 */
export function DraftArenaExitDialog({
  open, onOpenChange, onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        className="border-gold/30"
        style={{
          background: 'linear-gradient(180deg, hsl(160 35% 7%), hsl(160 50% 4%))',
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-lg font-black tracking-tight">
            Leave the Draft Arena?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/65 text-sm">
            You'll head back to the league hub. Drafts in progress keep running — come back anytime to make your pick.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
            Stay in the Arena
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-gold text-black font-extrabold hover:bg-gold/90"
          >
            Exit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
