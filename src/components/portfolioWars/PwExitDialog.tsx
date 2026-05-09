import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

/**
 * "Exit Portfolio Wars?" confirmation. Mirrors the Pick'em / Nexus exit
 * pattern so leaving the standalone module always feels deliberate.
 */
export function PwExitDialog({
  open, onOpenChange, onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent
        style={{
          background: 'linear-gradient(180deg, hsl(220 45% 8%), hsl(220 50% 4%))',
          borderColor: 'hsl(152 80% 50% / 0.3)',
        }}
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white text-lg font-black tracking-tight">
            Exit Portfolio Wars?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-white/65 text-sm">
            You'll head back to DH Club. Your picks are locked in — come back anytime to track the leaderboard.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="bg-white/5 border-white/15 text-white hover:bg-white/10">
            Stay on the Floor
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="font-extrabold text-black hover:opacity-90"
            style={{ background: 'hsl(152 80% 50%)' }}
          >
            Exit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
