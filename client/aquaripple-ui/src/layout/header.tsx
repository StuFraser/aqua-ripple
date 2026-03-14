import React from "react";
import banner from "../assets/aqua-ripple-banner.png";

const Header: React.FC = () => {
    return (
        <header className="bg-white border-b-2 border-aqua-brand shadow-sm shrink-0">
            <div className="max-w-screen-2xl mx-auto px-4 h-16 flex items-center justify-between">
                <img
                    src={banner}
                    alt="AquaRipple"
                    className="h-10 w-auto"
                />
                <nav className="flex items-center gap-3 text-sm font-semibold text-aqua-dark">
                    <a href="#" className="hover:text-aqua-brand transition-colors">Map</a>
                    <a href="#" className="hover:text-aqua-brand transition-colors">About</a>
                </nav>
            </div>
        </header>
    );
};

export default Header;