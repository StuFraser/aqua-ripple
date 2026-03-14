import React from "react";

interface CardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
}

const Card: React.FC<CardProps> = ({ children, className = "", title }) => {
    return (
        <div className={`bg-white rounded-2xl shadow-md overflow-hidden ${className}`}>
            {title && (
                <div className="bg-aqua-dark px-4 py-3">
                    <h2 className="text-white font-semibold text-sm uppercase tracking-wider">
                        {title}
                    </h2>
                </div>
            )}
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};

export default Card;