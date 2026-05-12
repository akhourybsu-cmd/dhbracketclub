import { forwardRef, AnchorHTMLAttributes } from 'react';

/**
 * Renders an external link with hardened defaults:
 *  - `rel="noopener noreferrer"` prevents the linked page from controlling
 *    the opener via `window.opener` and strips the Referer header.
 *  - `target="_blank"` opens in a new tab (override via prop if needed).
 *  - Blocks dangerous URL schemes (`javascript:`, `data:`, `vbscript:`)
 *    by refusing to render the href when not http(s) or relative.
 *
 * Usage:
 *   <SafeLink href={url}>{title}</SafeLink>
 */
type Props = AnchorHTMLAttributes<HTMLAnchorElement>;

const SAFE_SCHEME = /^(https?:|\/|#|mailto:|tel:)/i;

export const SafeLink = forwardRef<HTMLAnchorElement, Props>(function SafeLink(
  { href, target = '_blank', rel, children, ...rest },
  ref,
) {
  const safeHref = href && SAFE_SCHEME.test(href) ? href : undefined;
  const mergedRel = (() => {
    const base = ['noopener', 'noreferrer'];
    if (rel) for (const r of rel.split(/\s+/)) if (!base.includes(r)) base.push(r);
    return base.join(' ');
  })();

  return (
    <a ref={ref} href={safeHref} target={target} rel={mergedRel} {...rest}>
      {children}
    </a>
  );
});
