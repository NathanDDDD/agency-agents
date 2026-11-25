import type {
  Accommodation,
  ActivityCategory,
  BookingType,
  BudgetRange,
  ExpenseCategory,
  Pace,
  TravelParty,
  TravelPreferences,
  TravelStyle,
} from "./types";

export const TRAVEL_STYLES: { value: TravelStyle; label: string; hint: string }[] = [
  { value: "luxury", label: "Luxury", hint: "Five-star stays, fine dining" },
  { value: "comfort", label: "Comfort", hint: "Quality without excess" },
  { value: "balanced", label: "Balanced", hint: "Splurge where it counts" },
  { value: "budget", label: "Budget", hint: "Smart value, local gems" },
  { value: "backpacker", label: "Backpacker", hint: "Hostels, street food" },
  { value: "adventure", label: "Adventure", hint: "Off the beaten path" },
];

export const BUDGET_RANGES: { value: BudgetRange; label: string }[] = [
  { value: "under-1k", label: "Under $1,000" },
  { value: "1k-3k", label: "$1,000 – $3,000" },
  { value: "3k-6k", label: "$3,000 – $6,000" },
  { value: "6k-10k", label: "$6,000 – $10,000" },
  { value: "10k-plus", label: "$10,000+" },
];

export const ACCOMMODATIONS: { value: Accommodation; label: string }[] = [
  { value: "luxury-hotel", label: "Luxury hotel" },
  { value: "boutique-hotel", label: "Boutique hotel" },
  { value: "mid-range-hotel", label: "Mid-range hotel" },
  { value: "apartment", label: "Apartment / rental" },
  { value: "resort", label: "Resort" },
  { value: "hostel", label: "Hostel" },
];

export const FOOD_OPTIONS = [
  "Fine dining",
  "Local cuisine",
  "Street food",
  "Wine bars",
  "Cafés",
  "Vegetarian",
  "Vegan",
  "Gluten-free",
  "Halal",
  "Kosher",
  "Seafood",
];

export const ACTIVITY_OPTIONS = [
  "History",
  "Art & museums",
  "Architecture",
  "Food tours",
  "Nightlife",
  "Nature & hiking",
  "Beaches",
  "Shopping",
  "Wellness & spa",
  "Photography",
  "Live music",
  "Local experiences",
];

export const PACES: { value: Pace; label: string; hint: string }[] = [
  { value: "relaxed", label: "Relaxed", hint: "2–3 things a day, long lunches" },
  { value: "balanced", label: "Balanced", hint: "A full day with breathing room" },
  { value: "packed", label: "Packed", hint: "See as much as possible" },
];

export const PARTIES: { value: TravelParty; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "couple", label: "Couple" },
  { value: "family", label: "Family" },
  { value: "friends", label: "Friends" },
  { value: "business", label: "Business" },
];

export const CATEGORY_META: Record<ActivityCategory, { label: string; color: string }> = {
  sightseeing: { label: "Sightseeing", color: "#456CFF" },
  museum: { label: "Museum", color: "#7C5CFF" },
  food: { label: "Food", color: "#DDA96C" },
  restaurant: { label: "Restaurant", color: "#C48F50" },
  nightlife: { label: "Nightlife", color: "#B0469A" },
  outdoors: { label: "Outdoors", color: "#2F8F6B" },
  shopping: { label: "Shopping", color: "#D46A4C" },
  wellness: { label: "Wellness", color: "#3BA7A0" },
  experience: { label: "Experience", color: "#E07A5F" },
  transport: { label: "Transport", color: "#5B6478" },
  accommodation: { label: "Stay", color: "#26375A" },
  other: { label: "Other", color: "#8A93A6" },
};

export const BOOKING_TYPES: { value: BookingType; label: string }[] = [
  { value: "flight", label: "Flight" },
  { value: "hotel", label: "Hotel" },
  { value: "restaurant", label: "Restaurant" },
  { value: "activity", label: "Activity" },
  { value: "transport", label: "Transportation" },
  { value: "car_rental", label: "Car rental" },
  { value: "other", label: "Other" },
];

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string; color: string }[] = [
  { value: "accommodation", label: "Accommodation", color: "#26375A" },
  { value: "food", label: "Food & drink", color: "#DDA96C" },
  { value: "activities", label: "Activities", color: "#456CFF" },
  { value: "transport", label: "Transport", color: "#3BA7A0" },
  { value: "shopping", label: "Shopping", color: "#D46A4C" },
  { value: "flights", label: "Flights", color: "#7C5CFF" },
  { value: "other", label: "Other", color: "#8A93A6" },
];

export const DAY_COLORS = ["#456CFF", "#DDA96C", "#2F8F6B", "#B0469A", "#D46A4C", "#3BA7A0", "#7C5CFF", "#26375A"];

export function dayColor(dayNumber: number) {
  return DAY_COLORS[(dayNumber - 1) % DAY_COLORS.length];
}

export const DEFAULT_PREFERENCES: TravelPreferences = {
  travel_style: "balanced",
  budget_range: "3k-6k",
  accommodation: "boutique-hotel",
  food_preferences: ["Local cuisine"],
  activities: ["History", "Food tours"],
  pace: "balanced",
  travel_party: "couple",
  preferred_destinations: [],
  accessibility_needs: "",
};
