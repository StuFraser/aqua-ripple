import React from "react";

const Footer: React.FC = () => {
    return (
        <footer className="bg-aqua-dark text-white shrink-0">
            <div className="max-w-screen-2xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-2">
                <p className="text-sm font-medium">
                    &copy; 2026 Stuart Fraser
                </p>
                <div className="text-center text-xs text-white/60 max-w-xl">
                    <span className="font-semibold text-white/80">Disclaimer: </span>
                    Water quality indicators are AI-generated and unverified by environmental professionals.
                    Provided for experimental purposes only — use at your own risk.
                </div>
                <p className="text-xs text-white/60 text-right">
                    Sentinel-2 imagery © ESA / Microsoft Planetary Computer
                </p>
            </div>
        </footer>
    );
};

export default Footer;