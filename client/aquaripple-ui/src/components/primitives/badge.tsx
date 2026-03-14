import React from "react";

type BadgeVariant = "water" | "land" | "warning" | "info";

interface BadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
    water:   "bg-aqua-brand/10   text-aqua-brand  border border-aqua-brand/30",
    land:    "bg-ripple/10        text-ripple      border border-ripple/30",
    warning: "bg-amber-50         text-amber-700   border border-amber-200",
    info:    "bg-aqua-accent/10   text-aqua-dark   border border-aqua-accent/30",
};

const Badge: React.FC<BadgeProps> = ({ variant = "info", children, className = "" }) => {
    return (
        <span className={`
            inline-flex items-center gap-1.5
            px-2.5 py-1 rounded-full
            text-xs font-semibold
            ${variantClasses[variant]}
            ${className}
        `}>
            {children}
        </span>
    );
};

export default Badge;