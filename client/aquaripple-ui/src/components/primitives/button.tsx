import React from "react";

type ButtonVariant = "primary" | "secondary";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: ButtonVariant;
    size?: ButtonSize;
    children: React.ReactNode;
    isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
    primary: `
        bg-aqua-brand text-white border-2 border-aqua-brand
        hover:bg-aqua-dark hover:border-aqua-dark
        disabled:opacity-50 disabled:cursor-not-allowed
    `,
    secondary: `
        bg-transparent text-aqua-brand border-2 border-aqua-brand
        hover:bg-aqua-brand hover:text-white
        disabled:opacity-50 disabled:cursor-not-allowed
    `,
};

const sizeClasses: Record<ButtonSize, string> = {
    sm:  "px-3 py-1.5 text-xs",
    md:  "px-4 py-2   text-sm",
    lg:  "px-6 py-3   text-base",
};

const Button: React.FC<ButtonProps> = ({
    variant = "primary",
    size = "md",
    isLoading = false,
    children,
    className = "",
    disabled,
    ...props
}) => {
    return (
        <button
            className={`
                inline-flex items-center justify-center gap-2
                rounded-lg font-semibold tracking-wide
                transition-colors duration-200 cursor-pointer
                ${variantClasses[variant]}
                ${sizeClasses[size]}
                ${className}
            `}
            disabled={disabled || isLoading}
            {...props}
        >
            {isLoading && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
            )}
            {children}
        </button>
    );
};

export default Button;