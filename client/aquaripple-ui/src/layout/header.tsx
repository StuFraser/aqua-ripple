import React from "react";
import banner from "../assets/aqua-ripple-banner.png";

interface HeaderProps {
    currentView: "map" | "about";
    onNavigate: (view: "map" | "about") => void;
}

const Header: React.FC<HeaderProps> = ({ currentView, onNavigate }) => {
    return (
        <header className="bg-white border-b-2 border-aqua-brand shadow-sm shrink-0">
            <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between">
                <img
                    src={banner}
                    alt="AquaRipple"
                    className="h-10 w-auto"
                />
                <nav className="flex items-center gap-3 text-sm font-semibold text-aqua-dark">
                    <button
                        onClick={() => onNavigate("map")}
                        className={`hover:text-aqua-brand transition-colors ${currentView === "map" ? "text-aqua-brand" : ""}`}
                    >
                        Map
                    </button>
                    <button
                        onClick={() => onNavigate("about")}
                        className={`hover:text-aqua-brand transition-colors ${currentView === "about" ? "text-aqua-brand" : ""}`}
                    >
                        About
                    </button>
                </nav>
            </div>
        </header>
    );
};

export default Header;