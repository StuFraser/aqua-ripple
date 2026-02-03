import React from "react";

const Header: React.FC = () => {

    return (
        <header className="border-b border-aqua-dark h-[6em]">
            <img className="h-full py-2" 
                src="src/assets/aqua-ripple-banner.png" 
                alt="AquaRipple" />
        </header>
    )

}

export default Header;