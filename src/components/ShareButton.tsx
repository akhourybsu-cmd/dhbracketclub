import { useState } from 'react';
import { Share2, Link2, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  buildSharePayload,
  shareContent,
  copyShareLink,
  copyShareTextWithLink,
  type ShareableContentType,
} from '@/lib/share';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface ShareButtonProps {
  contentType: ShareableContentType;
  contentId: string;
  title: string;
  description?: string;
  /** For brackets that need a poolId in the URL */
  poolId?: string;
  /** Render as icon-only button (default) or with label */
  variant?: 'icon' | 'labeled';
  className?: string;
}

export default function ShareButton({
  contentType,
  contentId,
  title,
  description,
  poolId,
  variant = 'icon',
  className,
}: ShareButtonProps) {
  const [justCopied, setJustCopied] = useState(false);

  const payload = buildSharePayload(contentType, contentId, title, {
    description,
    poolId,
  });

  const handleShare = async () => {
    // On mobile with native share, use it directly
    if (navigator.share) {
      await shareContent(payload);
      return;
    }
    // On desktop, the popover handles options — this is the primary action
    const result = await copyShareLink(payload.url);
    if (result === 'copied') {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    }
  };

  const handleCopyLink = async () => {
    const result = await copyShareLink(payload.url);
    if (result === 'copied') {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    }
  };

  const handleCopyWithText = async () => {
    const result = await copyShareTextWithLink(payload.text, payload.url);
    if (result === 'copied') {
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
    }
  };

  // If native share is available, just render a simple button
  if (navigator.share) {
    return (
      <button
        onClick={handleShare}
        className={cn(
          "p-2 rounded-xl transition-all duration-150",
          "text-muted-foreground/60 hover:text-primary hover:bg-primary/5 active:scale-95",
          variant === 'labeled' && "flex items-center gap-1.5 px-3 text-xs font-semibold",
          className
        )}
        title="Share"
      >
        <Share2 className="w-4 h-4" />
        {variant === 'labeled' && <span>Share</span>}
      </button>
    );
  }

  // Desktop fallback: popover with copy options
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "p-2 rounded-xl transition-all duration-150",
            "text-muted-foreground/60 hover:text-primary hover:bg-primary/5 active:scale-95",
            variant === 'labeled' && "flex items-center gap-1.5 px-3 text-xs font-semibold",
            className
          )}
          title="Share"
        >
          {justCopied ? (
            <Check className="w-4 h-4 text-primary" />
          ) : (
            <Share2 className="w-4 h-4" />
          )}
          {variant === 'labeled' && <span>{justCopied ? 'Copied!' : 'Share'}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-52 p-1.5 bg-card border-border/60"
        sideOffset={6}
      >
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-xs font-medium text-foreground/80 hover:bg-secondary transition-colors"
        >
          <Link2 className="w-3.5 h-3.5 text-muted-foreground/60" />
          Copy link
        </button>
        <button
          onClick={handleCopyWithText}
          className="flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-xs font-medium text-foreground/80 hover:bg-secondary transition-colors"
        >
          <Copy className="w-3.5 h-3.5 text-muted-foreground/60" />
          Copy with message
        </button>
      </PopoverContent>
    </Popover>
  );
}
