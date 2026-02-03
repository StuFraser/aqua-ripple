import React from "react";

const Footer: React.FC = () => {
    return (
       
        <footer className="mt-auto p-5 text-center border-t border-aqua-dark">
            <p className="font-medium text-aqua-dark">&copy; 2026 Stuart Fraser</p>
            <div className="mx-auto mt-2 max-w-3xl text-[0.75rem] text-aqua-dark">
                <p>
                    <strong className="font-bold">Disclaimer:</strong> This is a hobby project. 
                    Water quality indicators are AI-generated and unverified by environmental 
                    professionals. This information is provided "as-is" for experimental 
                    purposes only. Use at your own risk.
                </p>
            </div>
        </footer>
    );
}
export default Footer;