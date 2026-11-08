export interface Org { id: number; display_name: string; verified: boolean }
export interface Trip {
  id: number; title: string; description: string; cover_image: string | null;
  destination: { id: number; name: string; slug: string; region: string };
  category: { id: number; slug: string; name_rw: string; name_en: string };
  organizer: Org; starting_location: string; meeting_point: string; latitude: number | null; longitude: number | null; coords_source: string | null;
  trip_date: string; start_time: string; duration_hours: number | null; price: number; currency: string;
  included_services: string[]; excluded_services: string[]; transport_info: string | null; food_info: string | null; bring_items: string | null;
  difficulty: 'easy' | 'moderate' | 'challenging'; capacity: number; remaining_spaces: number; registration_deadline: string; cancellation_policy: string | null;
  status: string; effective_status: string; is_open: boolean; avg_rating: number | null; review_count: number; is_demo: boolean;
  approved_seats?: number; pending_seats?: number;
  images?: { id: number; path: string }[]; costs?: Cost[]; my_registration?: { id: number; status: string; seats: number } | null; saved?: boolean;
}
export interface Cost { id: number; cost_type: string; label: string | null; amount: number | null; currency: string; source_type: string; source_note: string | null; scope: string }
export interface Category { id: number; slug: string; name_rw: string; name_en: string }
export interface Destination {
  id: number; name: string; slug: string; region: string; description_rw: string; description_en: string; latitude: number | null; longitude: number | null;
  image_path: string | null; is_demo: boolean; categories: Category[]; costs: Cost[]; available_trips: number; is_published?: number;
}
export interface Rec {
  id: number; title: string; link: string; destination: string; region: string; category_slug: string; category_name_rw: string; category_name_en: string;
  trip_date: string; start_time: string; price: number; currency: string; remaining_spaces: number; capacity: number; organizer: string; verified: boolean;
  cover_image: string | null; difficulty: string; reasons: string[]; alternative: boolean; over_budget_by?: number; starting_location: string;
  extra_costs: { cost_type: string; label: string | null; amount: number | null; source_type: string }[];
}
export interface AssistantReply {
  message: string; understood: string[]; trips: Rec[]; alternatives: Rec[]; alternatives_title?: string; destinations: { id: number; name: string; region: string; link: string; image_path: string | null }[];
  destinations_note?: string; hints: string[]; clarification?: { question: string; options: string[] }; suggestions?: string[]; engine: string; context: unknown;
}
export interface User {
  id: number; full_name: string; email: string; phone: string | null; role: 'traveler' | 'organizer' | 'admin'; preferred_language: 'rw' | 'en';
  organizer: { id: number; display_name: string; status: string } | null; application: { id: number; status: string; organizer_name: string; review_note: string | null } | null; unread_notifications: number;
}
