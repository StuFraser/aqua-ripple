
export default interface LocationLookupResponse {
    is_water: boolean;
    name: string | null;
    subtype: string | null;
    class: string | null;
    category: string | null;
    is_salt: boolean | null;
    is_intermittent: boolean | null;
    confidence: string | null;
    nearest_water: unknown | null;
}