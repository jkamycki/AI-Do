import { Wrench } from "lucide-react";

export const DEFAULT_MAINTENANCE_MESSAGE =
  "This experience is temporarily unavailable. Please check back soon.";

export function MaintenanceNotice({
  title = "Temporarily unavailable",
  message = DEFAULT_MAINTENANCE_MESSAGE,
  preview = false,
}: {
  title?: string;
  message?: string;
  preview?: boolean;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10 bg-[#FFF7F2]">
      <div className="w-full max-w-md text-center">
        <img
          src="/logo-optimized.jpg"
          alt="A.IDO"
          className="mx-auto mb-5 h-24 w-auto object-contain"
        />
        <div className="rounded-2xl border border-[#E6A6B7]/70 bg-[#F8EEDB] p-7 shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#8D294D]/10 text-[#8D294D] ring-1 ring-[#8D294D]/20">
            <Wrench className="h-6 w-6" />
          </div>
          {preview && (
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#8D294D]">
              Guest preview
            </p>
          )}
          <h1 className="font-serif text-3xl font-semibold leading-tight text-[#3B1C2B]">
            {title}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#6F3E54]">
            {message || DEFAULT_MAINTENANCE_MESSAGE}
          </p>
        </div>
        <p className="mt-5 text-xs text-[#6F3E54]/70">
          Powered by A.IDO
        </p>
      </div>
    </div>
  );
}
