import React, { useCallback, useRef, useState } from "react";
import { apiClient } from "../api/client";

const MIN_QUERY_LEN = 2;

interface GeoSearchResult {
    name: string;
    displayName: string;
    latitude: number;
    longitude: number;
    isWater: boolean;
    featureType: string;
}

interface MapSearchProps {
    onResultSelect: (lat: number, lng: number) => void;
}

// ── Icons ────────────────────────────────────────────────────────────

function SearchIcon({ spinning }: { spinning: boolean }) {
    if (spinning) {
        return (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
        );
    }
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
    );
}

function ClearIcon() {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
    );
}

// ── Main component ──────────────────────────────────────────────────────────

const MapSearch: React.FC<MapSearchProps> = ({ onResultSelect }) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GeoSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
    const [hasSearched, setHasSearched] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);
    const listRef = useRef<HTMLUListElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const abortRef = useRef<AbortController | null>(null);

    // ── Click outside to close ─────────────────────────────────────────────

    React.useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Scroll active item into view ───────────────────────────────────────

    React.useEffect(() => {
        if (activeIndex >= 0 && listRef.current) {
            const item = listRef.current.children[activeIndex] as HTMLElement;
            item?.scrollIntoView({ block: 'nearest' });
        }
    }, [activeIndex]);

    // ── Fetch using apiClient ──────────────────────────────────────────────

    const fetchResults = useCallback(async (q: string) => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = new AbortController();

        setIsLoading(true);
        setHasSearched(false);
        try {
            const data: GeoSearchResult[] = await apiClient.get(
                `/api/geonames/search?q=${encodeURIComponent(q)}&maxRows=8`
            );
            setHasSearched(true);

            if (data.length === 1) {
                handleSelect(data[0]);
            } else {
                setResults(data);
                setIsOpen(data.length > 0);
                setActiveIndex(-1);
            }
        } catch (err: any) {
            if (err.name !== 'AbortError') {
                setResults([]);
                setIsOpen(false);
                setHasSearched(true);
            }
        } finally {
            setIsLoading(false);
        }
    }, []);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleSearch = () => {
        const trimmed = query.trim();
        if (trimmed.length < MIN_QUERY_LEN) return;
        fetchResults(trimmed);
    };

    const handleSelect = (result: GeoSearchResult) => {
        setQuery(result.displayName);
        setIsOpen(false);
        setResults([]);
        setHasSearched(false);
        onResultSelect(result.latitude, result.longitude);
        inputRef.current?.blur();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (isOpen && activeIndex >= 0 && results[activeIndex]) {
                handleSelect(results[activeIndex]);
            } else {
                handleSearch();
            }
            return;
        }

        if (!isOpen) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setActiveIndex(i => Math.min(i + 1, results.length - 1));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setActiveIndex(i => Math.max(i - 1, -1));
                break;
            case 'Escape':
                setIsOpen(false);
                inputRef.current?.blur();
                break;
        }
    };

    const handleClear = () => {
        setQuery('');
        setResults([]);
        setIsOpen(false);
        setHasSearched(false);
        inputRef.current?.focus();
    };

    // ── Render ──────────────────────────────────────────────────────────────

    return (
        <div ref={containerRef} className="relative flex items-center gap-2 flex-1">
            {/* Input */}
            <div className="relative flex-1">
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={e => {
                        setQuery(e.target.value);
                        setHasSearched(false);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder="Search for a waterway or location..."
                    autoComplete="off"
                    className="w-full pl-4 pr-8 py-2 text-sm rounded-lg border-2 border-gray-200 bg-white text-gray-800 placeholder-gray-400 focus:outline-none focus:border-aqua-brand transition-colors"
                />
                {query && (
                    <button
                        onClick={handleClear}
                        className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                        aria-label="Clear search"
                        tabIndex={-1}
                    >
                        <ClearIcon />
                    </button>
                )}
            </div>

            {/* Search button */}
            <button
                onClick={handleSearch}
                disabled={isLoading || query.trim().length < MIN_QUERY_LEN}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                style={{ background: '#009CDE' }}
                aria-label="Search"
            >
                <SearchIcon spinning={isLoading} />
                <span className="hidden sm:inline">Search</span>
            </button>

            {/* Dropdown */}
            {isOpen && results.length > 0 && (
                <ul
                    ref={listRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[1000] max-h-72 overflow-y-auto"
                >
                    {results.map((result, i) => (
                        <li
                            key={`${result.latitude}-${result.longitude}-${i}`}
                            onMouseDown={() => handleSelect(result)}
                            onMouseEnter={() => setActiveIndex(i)}
                            className="flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors border-b border-gray-50 last:border-0"
                            style={{ backgroundColor: i === activeIndex ? 'rgba(0, 156, 222, 0.08)' : undefined }}
                        >
                            <span className="shrink-0 text-base leading-none">💧</span>
                            <div className="flex flex-col min-w-0 flex-1">
                                <span className="text-sm font-medium text-gray-800 truncate">{result.name}</span>
                                <span className="text-xs text-gray-400 truncate">{result.displayName}</span>
                            </div>
                            <span
                                className="shrink-0 text-xs px-1.5 py-0.5 rounded font-medium"
                                style={{ background: 'rgba(0, 156, 222, 0.1)', color: '#009CDE' }}
                            >
                                {result.featureType}
                            </span>
                        </li>
                    ))}
                </ul>
            )}

            {/* No results state */}
            {hasSearched && !isLoading && results.length === 0 && (
                <div className="absolute top-full left-0 right-16 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-[1000] px-4 py-3">
                    <p className="text-sm text-gray-400 text-center">No waterways found for "{query}"</p>
                </div>
            )}
        </div>
    );
};

export default MapSearch;