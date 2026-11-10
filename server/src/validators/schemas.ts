import { z } from 'zod';

const str = (min: number, max: number) => z.string().trim().min(min).max(max);
export const password = z.string().min(8).max(100)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'password_weak');
const phone = z.string().trim().regex(/^\+?[0-9 ]{9,15}$/, 'invalid_phone');
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date');
const time = z.string().regex(/^\d{2}:\d{2}$/, 'invalid_time');
const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'invalid_datetime');

export const registerSchema = z.object({
  full_name: str(2, 100), email: z.string().trim().email().max(150), phone: phone.optional().or(z.literal('')),
  password, preferred_language: z.enum(['rw', 'en']).optional(),
});
export const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1).max(100) });
export const profileSchema = z.object({
  full_name: str(2, 100), phone: phone.optional().or(z.literal('')), preferred_language: z.enum(['rw', 'en']).optional(),
});
export const passwordChangeSchema = z.object({ current_password: z.string().min(1), new_password: password });

export const applicationSchema = z.object({
  organizer_name: str(2, 120), applicant_name: str(2, 100), email: z.string().trim().email().max(150),
  phone, experience: str(20, 3000), location: str(2, 150), supporting_info: z.string().trim().max(3000).optional(),
  password: password.optional(), // required only when not logged in (checked in route)
});

export const tripSchema = z.object({
  title: str(3, 120), description: str(10, 5000),
  destination_id: z.coerce.number().int().positive(), category_id: z.coerce.number().int().positive(),
  starting_location: str(2, 150), meeting_point: str(2, 200),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  trip_date: date, start_time: time, duration_hours: z.coerce.number().min(0.5).max(240).nullable().optional(),
  price: z.coerce.number().int().min(0).max(100_000_000), currency: z.literal('RWF').default('RWF'),
  included_services: z.array(str(1, 120)).max(30).default([]),
  excluded_services: z.array(str(1, 120)).max(30).default([]),
  transport_info: z.string().trim().max(1000).nullable().optional(),
  food_info: z.string().trim().max(1000).nullable().optional(),
  bring_items: z.string().trim().max(1000).nullable().optional(),
  difficulty: z.enum(['easy', 'moderate', 'challenging']).default('easy'),
  capacity: z.coerce.number().int().min(1).max(500),
  registration_deadline: dateTime,
  cancellation_policy: z.string().trim().max(1000).nullable().optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  organizer_id: z.coerce.number().int().positive().optional(), // admin only
}).refine((t) => t.registration_deadline <= `${t.trip_date}T${t.start_time}`, {
  path: ['registration_deadline'], message: 'deadline_after_trip',
});

export const registrationCreateSchema = z.object({
  seats: z.coerce.number().int().min(1).max(10).default(1), note: z.string().trim().max(500).optional(),
});
export const decisionSchema = z.object({
  decision: z.enum(['approved', 'rejected']), note: z.string().trim().max(500).optional(),
});
export const reviewSchema = z.object({ rating: z.coerce.number().int().min(1).max(5), comment: str(3, 1500) });
export const supportSchema = z.object({
  name: str(2, 100), email: z.string().trim().email().max(150), subject: str(3, 150), message: str(10, 3000),
});
export const destinationSchema = z.object({
  name: str(2, 120), region: str(2, 120), description_rw: str(5, 3000), description_en: str(5, 3000),
  latitude: z.coerce.number().min(-90).max(90).nullable().optional(),
  longitude: z.coerce.number().min(-180).max(180).nullable().optional(),
  is_published: z.boolean().default(true), category_ids: z.array(z.coerce.number().int()).default([]),
});
export const categorySchema = z.object({ slug: z.string().trim().regex(/^[a-z0-9-]{2,40}$/), name_rw: str(2, 80), name_en: str(2, 80), is_active: z.boolean().default(true) });
export const costSchema = z.object({
  trip_id: z.coerce.number().int().positive().optional(), destination_id: z.coerce.number().int().positive().optional(),
  cost_type: z.enum(['package', 'transport', 'entry_fee', 'food', 'accommodation', 'activity', 'other']),
  label: z.string().trim().max(120).optional(), amount: z.coerce.number().int().min(0).nullable().optional(),
  source_type: z.enum(['organizer', 'official', 'community', 'system_estimate', 'unknown']),
  source_note: z.string().trim().max(300).optional(),
}).refine((c) => c.trip_id || c.destination_id, { message: 'target_required' });
export const announcementSchema = z.object({
  title_rw: str(2, 150), title_en: str(2, 150), body_rw: str(2, 2000), body_en: str(2, 2000), is_active: z.boolean().default(true),
});
export const adminUserCreateSchema = z.object({
  full_name: str(2, 100), email: z.string().trim().email(), phone: phone.optional().or(z.literal('')),
  password, role: z.enum(['traveler', 'admin']).default('traveler'),
});
export const organizerProfileSchema = z.object({
  display_name: str(2, 120), bio: z.string().trim().max(2000).optional(), location: z.string().trim().max(150).optional(),
  contact_phone: phone.optional().or(z.literal('')), contact_email: z.string().trim().email().optional().or(z.literal('')),
});
export const assistantSchema = z.object({
  message: str(1, 500), lang: z.enum(['rw', 'en']).default('rw'),
  context: z.object({
    budget: z.number().optional(), category: z.string().max(40).optional(), destination: z.string().max(100).optional(),
    location: z.string().max(100).optional(), people: z.number().int().min(1).max(10).optional(),
    date: z.object({ dateFrom: date, dateTo: date, weekdays: z.array(z.number().int().min(0).max(6)).optional(),
      label: z.string().max(60), labelKey: z.string().max(40), exact: z.boolean().optional() }).optional(),
    origin: z.string().trim().max(100).optional(),
    budgetType: z.enum(['total', 'activity']).optional(),
    transportIncluded: z.boolean().optional(),
    lastRequest: z.string().max(300).optional(),
    lastTripIds: z.array(z.number().int().positive()).max(50).optional(),
    lastNearbyIds: z.array(z.number().int().positive()).max(50).optional(),
    pending: z.union([z.object({ kind: z.literal('place_role'), place: z.string().trim().min(1).max(100) }), z.object({ kind: z.literal('origin') })]).optional(),
  }).partial().optional(),
});
