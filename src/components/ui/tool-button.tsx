import type { ButtonHTMLAttributes } from "react";

interface ToolButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  children: React.ReactNode;
}

export function ToolButton({
  variant = "primary",
  className = "",
  children,
  ...props
}: ToolButtonProps) {
  const baseClasses =
    "px-4 py-3 min-h-[44px] rounded-lg font-medium transition-colors";

  const variantClasses = {
    primary: "bg-accent hover:bg-accent-dark text-white",
    secondary: "bg-blue-600 hover:bg-blue-700 text-white",
    danger: "bg-red-600 hover:bg-red-700 text-white",
  };

  return (
    <button
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
