import React, { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

interface IndicatorCardProps {
    icon: string;
    title: string;
    description: string;
    levels: { label: string; color: string; description: string }[];
}

interface ActivityCardProps {
    icon: string;
    title: string;
    description: string;
    note?: string;
}

interface StatusBadgeProps {
    status: "safe" | "caution" | "unsafe";
}

// ── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
    const config = {
        safe:   { bg: "bg-emerald-50",  text: "text-emerald-700", border: "border-emerald-200", dot: "bg-emerald-500", label: "Safe"   },
        caution:{ bg: "bg-amber-50",    text: "text-amber-700",   border: "border-amber-200",   dot: "bg-amber-400",   label: "Caution"},
        unsafe: { bg: "bg-red-50",      text: "text-red-700",     border: "border-red-200",     dot: "bg-red-500",     label: "Unsafe" },
    }[status];

    return (
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${config.bg} ${config.text} ${config.border}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
            {config.label}
        </span>
    );
};

const IndicatorCard: React.FC<IndicatorCardProps> = ({ icon, title, description, levels }) => {
    const [open, setOpen] = useState(false);

    return (
        <div className="border border-gray-100 rounded-xl overflow-hidden hover:border-aqua-brand/30 hover:shadow-sm transition-all duration-200">
            <button
                onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-3 p-4 text-left bg-white hover:bg-gray-50/80 transition-colors"
            >
                <span className="text-2xl shrink-0">{icon}</span>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-aqua-dark">{title}</p>
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
                </div>
                <svg
                    className={`shrink-0 h-4 w-4 text-gray-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {open && (
                <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 flex flex-col gap-2">
                    {levels.map((level) => (
                        <div key={level.label} className="flex items-start gap-3">
                            <span
                                className="mt-0.5 shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{ background: level.color + "20", color: level.color }}
                            >
                                {level.label}
                            </span>
                            <p className="text-xs text-gray-600 leading-relaxed">{level.description}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ActivityCard: React.FC<ActivityCardProps> = ({ icon, title, description, note }) => (
    <div className="flex gap-3 p-4 bg-white border border-gray-100 rounded-xl hover:border-aqua-brand/30 hover:shadow-sm transition-all duration-200">
        <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
        <div>
            <p className="text-sm font-semibold text-aqua-dark">{title}</p>
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
            {note && (
                <p className="text-xs text-aqua-brand mt-1.5 leading-relaxed font-medium">{note}</p>
            )}
        </div>
    </div>
);

// ── Section wrapper ──────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; subtitle?: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <section className="flex flex-col gap-4">
        <div>
            <h2 className="text-base font-bold text-aqua-dark uppercase tracking-wider">{title}</h2>
            {subtitle && <p className="text-xs text-gray-500 mt-1 leading-relaxed">{subtitle}</p>}
            <div className="mt-2 h-0.5 w-10 rounded-full bg-aqua-brand" />
        </div>
        {children}
    </section>
);

// ── Main component ───────────────────────────────────────────────────────────

const About: React.FC = () => {
    return (
        <div className="flex flex-col gap-8 p-5 max-w-prose">

            {/* Intro */}
            <div className="flex flex-col gap-2">
                <h1 className="text-xl font-bold text-aqua-dark leading-snug">
                    How AquaRipple Works
                </h1>
                <p className="text-sm text-gray-600 leading-relaxed">
                    AquaRipple uses real Sentinel-2 satellite imagery analysed by AI to give you
                    a plain-English picture of water quality at any location. Here's what the
                    indicators mean and how to read the results.
                </p>
                <div className="mt-1 p-3 bg-amber-50 border border-amber-200 rounded-lg flex gap-2">
                    <span className="text-base shrink-0">⚠️</span>
                    <p className="text-xs text-amber-800 leading-relaxed">
                        Results are AI-generated from satellite imagery and are not verified by
                        environmental professionals. Always check official advisories before
                        making decisions about water use.
                    </p>
                </div>
            </div>

            {/* How it works */}
            <Section
                title="How It Works"
                subtitle="Four satellite images are analysed each time you drop a pin."
            >
                <div className="grid grid-cols-2 gap-2">
                    {[
                        { icon: "🛰️", label: "True Colour",       desc: "Natural RGB view for context" },
                        { icon: "🔴", label: "False Colour",       desc: "Highlights vegetation & algae" },
                        { icon: "🔵", label: "Water Mask",         desc: "Identifies water extent" },
                        { icon: "🟢", label: "Chlorophyll Index",  desc: "Maps algae concentration" },
                    ].map(item => (
                        <div key={item.label} className="flex gap-2 p-3 bg-white border border-gray-100 rounded-lg">
                            <span className="text-lg shrink-0">{item.icon}</span>
                            <div>
                                <p className="text-xs font-semibold text-aqua-dark">{item.label}</p>
                                <p className="text-xs text-gray-500">{item.desc}</p>
                            </div>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                    The clearest available image from the past 12 months is used. The AI
                    reads all four views together to estimate each indicator below.
                </p>
            </Section>

            {/* Indicators */}
            <Section
                title="Water Quality Indicators"
                subtitle="Tap any indicator to see what each level means in plain English."
            >
                <IndicatorCard
                    icon="🌿"
                    title="Chlorophyll-a"
                    description="A measure of algae in the water. More algae means more nutrients — often from agricultural runoff."
                    levels={[
                        { label: "Low",       color: "#10b981", description: "Healthy water, minimal algae present." },
                        { label: "Moderate",  color: "#f59e0b", description: "Some algae present, worth keeping an eye on." },
                        { label: "High",      color: "#f97316", description: "Elevated algae, may affect water clarity and smell." },
                        { label: "Very High", color: "#ef4444", description: "Significant algae growth, likely affecting water quality." },
                    ]}
                />
                <IndicatorCard
                    icon="☁️"
                    title="Turbidity"
                    description="How murky or cloudy the water appears. Caused by sediment, algae, or runoff after rain."
                    levels={[
                        { label: "Low",       color: "#10b981", description: "Clear water, good light penetration." },
                        { label: "Moderate",  color: "#f59e0b", description: "Slightly cloudy but generally fine." },
                        { label: "High",      color: "#f97316", description: "Noticeably murky, reduced visibility underwater." },
                        { label: "Very High", color: "#ef4444", description: "Very cloudy water, likely after heavy rain or disturbance." },
                    ]}
                />
                <IndicatorCard
                    icon="🌸"
                    title="Algae Bloom"
                    description="Whether a visible algae bloom has been detected. Blooms can develop quickly and pose health risks."
                    levels={[
                        { label: "None",     color: "#10b981", description: "No bloom detected in the imagery." },
                        { label: "Minor",    color: "#f59e0b", description: "Small patches detected, monitor for changes." },
                        { label: "Moderate", color: "#f97316", description: "Visible bloom present, take care with water contact." },
                        { label: "Severe",   color: "#ef4444", description: "Significant bloom, avoid all contact with the water." },
                    ]}
                />
                <IndicatorCard
                    icon="👁️"
                    title="Water Clarity"
                    description="How far light can penetrate the water, estimated from surface reflectance. Includes a Secchi depth estimate in metres."
                    levels={[
                        { label: "Clear",    color: "#10b981", description: "Good visibility, healthy light levels for aquatic life." },
                        { label: "Moderate", color: "#f59e0b", description: "Some reduction in clarity, still generally acceptable." },
                        { label: "Turbid",   color: "#f97316", description: "Poor clarity, likely affecting aquatic ecosystems." },
                        { label: "Opaque",   color: "#ef4444", description: "Very low light penetration, significant water quality concern." },
                    ]}
                />
                <IndicatorCard
                    icon="🦠"
                    title="Cyanobacteria Risk"
                    description="The risk of toxic blue-green algae being present. Cyanobacteria can produce toxins that are harmful to people and animals."
                    levels={[
                        { label: "Low",       color: "#10b981", description: "No signs of cyanobacteria activity." },
                        { label: "Moderate",  color: "#f59e0b", description: "Conditions could support cyanobacteria, exercise caution." },
                        { label: "High",      color: "#f97316", description: "Likely cyanobacteria present, avoid water contact." },
                        { label: "Very High", color: "#ef4444", description: "Strong indicators of toxic bloom, keep people and animals away." },
                    ]}
                />
            </Section>

            {/* Activity ratings */}
            <Section
                title="Activity Ratings"
                subtitle="Each activity is rated Safe, Caution, or Unsafe based on the indicators most relevant to that activity."
            >
                <div className="flex items-center gap-3 flex-wrap">
                    <StatusBadge status="safe" />
                    <StatusBadge status="caution" />
                    <StatusBadge status="unsafe" />
                </div>
                <p className="text-xs text-gray-500 leading-relaxed">
                    When indicators give conflicting signals, the worst result always wins —
                    AquaRipple always errs on the side of caution.
                </p>
                <ActivityCard
                    icon="🏊"
                    title="Swimming"
                    description="Direct water contact including swimming, wading, and water sports. Cyanobacteria and algae bloom are the critical indicators here."
                />
                <ActivityCard
                    icon="🎣"
                    title="Fishing"
                    description="Rated separately for the activity itself and for eating your catch. Water can be safe to fish in but the catch unsafe to eat — particularly relevant for shellfish."
                />
                <ActivityCard
                    icon="⛵"
                    title="Boating"
                    description="Covers everything from kayaks to larger vessels. Includes a biosecurity advisory for cleaning your boat before moving to other waterways."
                    note="Even with a safe rating, always clean, drain and dry if a biosecurity advisory is shown."
                />
                <ActivityCard
                    icon="🌱"
                    title="Irrigation"
                    description="Use of water on crops and gardens. Algae-contaminated water on edible plants is a food safety concern — extra caution applies to vegetables and herbs."
                />
                <ActivityCard
                    icon="🐄"
                    title="Animal Watering"
                    description="Livestock and domestic animal access. Animals are often more sensitive to cyanobacteria than humans — thresholds here are tighter than for irrigation."
                />
            </Section>

            {/* Limitations */}
            <Section title="Limitations & Data Sources">
                <div className="flex flex-col gap-2">
                    {[
                        { icon: "📅", text: "Imagery is from the clearest available pass in the past 12 months — conditions may have changed." },
                        { icon: "☁️", text: "Heavy cloud cover or haze can affect indicator accuracy, even in images that appear cloud-free." },
                        { icon: "🔬", text: "Bacterial contamination, chemical pollutants, and pH cannot be detected from satellite imagery." },
                        { icon: "🗺️", text: "Indicator accuracy is best for open water bodies. Small streams and narrow channels may have lower confidence." },
                    ].map((item, i) => (
                        <div key={i} className="flex gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                            <span className="text-base shrink-0">{item.icon}</span>
                            <p className="text-xs text-gray-600 leading-relaxed">{item.text}</p>
                        </div>
                    ))}
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                    Sentinel-2 satellite imagery © ESA / Microsoft Planetary Computer.
                    Water quality analysis powered by Google Gemini.
                </p>
            </Section>

        </div>
    );
};

export default About;