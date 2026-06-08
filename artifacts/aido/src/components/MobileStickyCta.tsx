import { ArrowRight } from "lucide-react";
import { Link } from "wouter";

type MobileStickyCtaProps = {
  buttonLabel?: string;
  detail?: string;
  href?: string;
  label?: string;
  onClick?: () => void;
};

const actionClass =
  "inline-flex h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-[#8D294D] px-4 text-sm font-bold text-white shadow-[0_12px_24px_rgba(141,41,77,0.22)] transition hover:bg-[#6F1D3D] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#E6A6B7]/50";

export function MobileStickyCta({
  buttonLabel = "Start free",
  detail = "No credit card",
  href,
  label = "Create your wedding workspace",
  onClick,
}: MobileStickyCtaProps) {
  return (
    <div data-testid="mobile-sticky-cta" className="fixed inset-x-0 bottom-0 z-50 border-t border-[#E6A6B7]/55 bg-[#FFF7F2]/95 px-3 pb-[calc(0.65rem+env(safe-area-inset-bottom))] pt-2 shadow-[0_-18px_44px_rgba(141,41,77,0.16)] backdrop-blur-md md:hidden">
      <div className="mx-auto flex max-w-md items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold leading-5 text-[#5B2035]">{label}</p>
          <p className="truncate text-xs font-semibold leading-4 text-[#7A5062]">{detail}</p>
        </div>
        {href ? (
          <Link href={href} onClick={onClick} className={actionClass}>
            {buttonLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        ) : (
          <button type="button" onClick={onClick} className={actionClass}>
            {buttonLabel}
            <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
