import { lazy, type ComponentType } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { DashLayout, PublicLayout, RequireAuth, RequireRole, type DashLink } from './layouts/Layouts';
import Home from './pages/public/Home';

// Every page except Home is its own chunk, loaded when first visited (and prefetched in the background below),
// so the first visit downloads only what the home page needs; the admin and organizer dashboards never load for travellers.
const load = {
  admin: () => import('./pages/admin/Admin'),
  organizer: () => import('./pages/organizer/Organizer'),
  traveler: () => import('./pages/traveler/Traveler'),
  shared: () => import('./pages/Shared'),
  destinations: () => import('./pages/public/Destinations'),
  pages: () => import('./pages/public/Pages'),
  tripDetail: () => import('./pages/public/TripDetail'),
  trips: () => import('./pages/public/Trips'),
};
/** React.lazy for a named export. */
function page<M, K extends keyof M>(loader: () => Promise<M>, name: K) {
  return lazy(() => loader().then((m) => ({ default: m[name] as unknown as ComponentType<any> })));
}

const { AdminHome, AdminDestinations, TransportPrices, AdminSupport, Announcements, Applications, AuditLog, Categories, Organizers, ReviewsReports, SettingsPage, Users } = {
  AdminHome: page(load.admin, 'AdminHome'), AdminDestinations: page(load.admin, 'AdminDestinations'), TransportPrices: page(load.admin, 'TransportPrices'),
  AdminSupport: page(load.admin, 'AdminSupport'), Announcements: page(load.admin, 'Announcements'), Applications: page(load.admin, 'Applications'),
  AuditLog: page(load.admin, 'AuditLog'), Categories: page(load.admin, 'Categories'), Organizers: page(load.admin, 'Organizers'),
  ReviewsReports: page(load.admin, 'ReviewsReports'), SettingsPage: page(load.admin, 'SettingsPage'), Users: page(load.admin, 'Users'),
};
const { AllRegistrations, ManageTrips, OrganizerHome, OrganizerProfileEdit, OrganizerReviews, TripForm, TripRegistrations } = {
  AllRegistrations: page(load.organizer, 'AllRegistrations'), ManageTrips: page(load.organizer, 'ManageTrips'), OrganizerHome: page(load.organizer, 'OrganizerHome'),
  OrganizerProfileEdit: page(load.organizer, 'OrganizerProfileEdit'), OrganizerReviews: page(load.organizer, 'OrganizerReviews'),
  TripForm: page(load.organizer, 'TripForm'), TripRegistrations: page(load.organizer, 'TripRegistrations'),
};
const { MyRegistrations, MyReviews, MySupport, SavedTrips, TravelerHome } = {
  MyRegistrations: page(load.traveler, 'MyRegistrations'), MyReviews: page(load.traveler, 'MyReviews'), MySupport: page(load.traveler, 'MySupport'),
  SavedTrips: page(load.traveler, 'SavedTrips'), TravelerHome: page(load.traveler, 'TravelerHome'),
};
const Notifications = page(load.shared, 'Notifications'), ProfileForm = page(load.shared, 'ProfileForm');
const Destinations = page(load.destinations, 'Destinations'), DestinationDetail = page(load.destinations, 'DestinationDetail');
const { About, BecomeOrganizer, Contact, ForgotPassword, Login, NotFound, OrganizerProfile, Planner, Register, ResetPassword } = {
  About: page(load.pages, 'About'), BecomeOrganizer: page(load.pages, 'BecomeOrganizer'), Contact: page(load.pages, 'Contact'),
  ForgotPassword: page(load.pages, 'ForgotPassword'), Login: page(load.pages, 'Login'), NotFound: page(load.pages, 'NotFound'),
  OrganizerProfile: page(load.pages, 'OrganizerProfile'), Planner: page(load.pages, 'Planner'), Register: page(load.pages, 'Register'), ResetPassword: page(load.pages, 'ResetPassword'),
};
const TripDetail = page(load.tripDetail, 'default'), Trips = page(load.trips, 'default');

/** Once the first page is up and the browser is idle, fetch the public pages so later navigation is instant. */
export function prefetchPages() {
  const run = () => { for (const k of ['trips', 'destinations', 'tripDetail', 'pages'] as const) load[k]().catch(() => undefined); };
  const idle = (window as any).requestIdleCallback as ((cb: () => void, o?: { timeout: number }) => void) | undefined;
  if (idle) idle(run, { timeout: 4000 }); else setTimeout(run, 2500);
}

const travelerLinks: DashLink[] = [
  { icon: 'grid', to: '/traveler', label: 'dash.overview', end: true }, { icon: 'clipboard', to: '/traveler/registrations', label: 'tr.registrations' }, { icon: 'heart', to: '/traveler/saved', label: 'tr.saved' }, { icon: 'star', to: '/traveler/reviews', label: 'tr.reviews' },
  { icon: 'bell', to: '/traveler/notifications', label: 'dash.notifications' }, { icon: 'help', to: '/traveler/support', label: 'dash.support' }, { icon: 'user', to: '/traveler/profile', label: 'dash.profile' }];
const organizerLinks: DashLink[] = [
  { icon: 'grid', to: '/organizer', label: 'dash.overview', end: true }, { icon: 'mountain', to: '/organizer/trips', label: 'org.my_trips' }, { icon: 'plus', to: '/organizer/trips/new', label: 'org.create_trip' }, { icon: 'clipboard', to: '/organizer/registrations', label: 'org.registrations' },
  { icon: 'star', to: '/organizer/reviews', label: 'org.reviews' }, { icon: 'bell', to: '/organizer/notifications', label: 'dash.notifications' }, { icon: 'user', to: '/organizer/profile', label: 'dash.profile' }, { icon: 'shield', to: '/traveler/profile', label: 'dash.change_password' }];
const adminLinks: DashLink[] = [
  { icon: 'grid', to: '/admin', label: 'dash.overview', end: true }, { icon: 'users', to: '/admin/users', label: 'ad.users', group: 'ad.users' }, { icon: 'flag', to: '/admin/applications', label: 'ad.applications', group: 'ad.users' }, { icon: 'shield', to: '/admin/organizers', label: 'ad.organizers', group: 'ad.users' },
  { icon: 'pin', to: '/admin/destinations', label: 'ad.destinations', group: 'ad.trips' }, { icon: 'map', to: '/admin/transport', label: 'ad.transport', group: 'ad.trips' }, { icon: 'mountain', to: '/admin/trips', label: 'ad.trips', group: 'ad.trips' }, { icon: 'clipboard', to: '/admin/registrations', label: 'ad.registrations', group: 'ad.trips' },
  { icon: 'star', to: '/admin/reviews', label: 'ad.reviews', group: 'ad.settings' }, { icon: 'help', to: '/admin/support', label: 'ad.support', group: 'ad.settings' }, { icon: 'tag', to: '/admin/categories', label: 'ad.categories', group: 'ad.settings' }, { icon: 'megaphone', to: '/admin/announcements', label: 'ad.announcements', group: 'ad.settings' },
  { icon: 'history', to: '/admin/audit', label: 'ad.audit', group: 'ad.settings' }, { icon: 'settings', to: '/admin/settings', label: 'ad.settings', group: 'ad.settings' }, { icon: 'bell', to: '/admin/notifications', label: 'dash.notifications', group: 'ad.settings' }, { icon: 'user', to: '/admin/profile', label: 'dash.profile', group: 'ad.settings' }];

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} /><Route path="/destinations" element={<Destinations />} /><Route path="/destinations/:id" element={<DestinationDetail />} />
        <Route path="/trips" element={<Trips />} /><Route path="/trips/:id" element={<TripDetail />} /><Route path="/planner" element={<Planner />} />
        <Route path="/about" element={<About />} /><Route path="/contact" element={<Contact />} /><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} /><Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/become-organizer" element={<BecomeOrganizer />} />
        <Route element={<RequireAuth />}><Route path="/organizers/:id" element={<OrganizerProfile />} /></Route>
        <Route path="*" element={<NotFound />} />
      </Route>

      <Route element={<RequireRole roles={['traveler', 'organizer']} />}>
        <Route path="/traveler" element={<DashLayout links={travelerLinks} title="Traveler" />}>
          <Route index element={<TravelerHome />} /><Route path="registrations" element={<MyRegistrations />} /><Route path="saved" element={<SavedTrips />} /><Route path="reviews" element={<MyReviews />} />
          <Route path="notifications" element={<Notifications />} /><Route path="support" element={<MySupport />} /><Route path="profile" element={<ProfileForm />} />
        </Route>
      </Route>

      <Route element={<RequireRole roles={['organizer']} />}>
        <Route path="/organizer" element={<DashLayout links={organizerLinks} title="Organizer" />}>
          <Route index element={<OrganizerHome />} /><Route path="trips" element={<ManageTrips />} /><Route path="trips/new" element={<TripForm />} /><Route path="trips/:id/edit" element={<TripForm />} />
          <Route path="trips/:id/registrations" element={<TripRegistrations />} /><Route path="registrations" element={<AllRegistrations />} /><Route path="reviews" element={<OrganizerReviews />} />
          <Route path="notifications" element={<Notifications />} /><Route path="profile" element={<OrganizerProfileEdit />} />
        </Route>
      </Route>

      <Route element={<RequireRole roles={['admin']} />}>
        <Route path="/admin" element={<DashLayout links={adminLinks} title="Admin" />}>
          <Route index element={<AdminHome />} /><Route path="users" element={<Users />} /><Route path="applications" element={<Applications />} /><Route path="organizers" element={<Organizers />} />
          <Route path="destinations" element={<AdminDestinations />} /><Route path="transport" element={<TransportPrices />} /><Route path="trips" element={<ManageTrips admin />} /><Route path="trips/new" element={<TripForm admin />} /><Route path="trips/:id/edit" element={<TripForm admin />} />
          <Route path="trips/:id/registrations" element={<TripRegistrations admin />} /><Route path="registrations" element={<AllRegistrations admin />} /><Route path="reviews" element={<ReviewsReports />} />
          <Route path="support" element={<AdminSupport />} /><Route path="categories" element={<Categories />} /><Route path="announcements" element={<Announcements />} /><Route path="audit" element={<AuditLog />} />
          <Route path="settings" element={<SettingsPage />} /><Route path="notifications" element={<Notifications />} /><Route path="profile" element={<ProfileForm />} />
        </Route>
      </Route>
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
