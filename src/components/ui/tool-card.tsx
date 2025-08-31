import type { Tool } from "@/config/tools";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface ToolCardProps {
  tool: Tool;
  className?: string;
}

export function ToolCard({ tool, className }: ToolCardProps) {
  const isComingSoon = tool.status === "coming_soon";

  const card = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border-light bg-card-light p-6 transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02] hover:shadow-2xl hover:shadow-accent/20 dark:border-border-dark dark:bg-card-dark",
        isComingSoon
          ? "cursor-not-allowed opacity-75"
          : "hover:border-accent/50",
        className
      )}
    >
      {/* Coming Soon Badge */}
      {isComingSoon && (
        <div className="absolute right-3 top-3 rounded-full bg-accent px-2 py-1 text-xs font-medium text-white">
          Coming Soon
        </div>
      )}

      {/* Icon */}
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-accent/10 text-accent transition-all duration-300 group-hover:rotate-3 group-hover:scale-110 group-hover:bg-accent/20">
        <tool.icon className="h-6 w-6" />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold tracking-tight">{tool.title}</h3>
        <p className="text-sm text-foreground-light-secondary dark:text-foreground-dark-secondary">
          {tool.description}
        </p>
      </div>

      {/* Category Badge */}
      <div className="mt-4">
        <span className="inline-flex items-center rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
          {tool.category === "developer" && "Developer"}
          {tool.category === "design" && "Design"}
          {tool.category === "utility" && "Utility"}
          {tool.category === "converter" && "Converter"}
        </span>
      </div>

      {/* Hover Arrow */}
      {!isComingSoon && (
        <div className="absolute bottom-4 right-4 -translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100">
          <svg
            className="h-5 w-5 text-accent"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M7 17 17 7" />
            <path d="M7 7h10v10" />
          </svg>
        </div>
      )}
    </div>
  );

  if (isComingSoon) {
    return card;
  }

  return (
    <Link href={tool.href} className="block">
      {card}
    </Link>
  );
}
