import { Navigate, Route, Routes } from 'react-router-dom';
import { DashLayout, PublicLayout, RequireAuth, RequireRole, type DashLink } from './layouts/Layouts';
import { AdminHome, AdminDestinations, AdminSupport, Announcements, Applications, AuditLog, Categories, Organizers, ReviewsReports, SettingsPage, Users } from './pages/admin/Admin';
import { AllRegistrations, ManageTrips, OrganizerHome, OrganizerProfileEdit, OrganizerReviews, TripForm, TripRegistrations } from './pages/organizer/Organizer';
import { Destinations, DestinationDetail } from './pages/public/Destinations';
import Home from './pages/public/Home';
import { About, BecomeOrganizer, Contact, Login, NotFound, OrganizerProfile, Planner, Register } from './pages/public/Pages';
import TripDetail from './pages/public/TripDetail';
import Trips from './pages/public/Trips';
import { Notifications, ProfileForm } from './pages/Shared';
import { MyRegistrations, MyReviews, MySupport, SavedTrips, TravelerHome } from './pages/traveler/Traveler';

const travelerLinks: DashLink[] = [
  { to: '/traveler', label: 'dash.overview', end: true }, { to: '/traveler/registrations', label: 'tr.registrations' }, { to: '/traveler/saved', label: 'tr.saved' }, { to: '/traveler/reviews', label: 'tr.reviews' },
  { to: '/traveler/notifications', label: 'dash.notifications' }, { to: '/traveler/support', label: 'dash.support' }, { to: '/traveler/profile', label: 'dash.profile' }];
const organizerLinks: DashLink[] = [
  { to: '/organizer', label: 'dash.overview', end: true }, { to: '/organizer/trips', label: 'org.my_trips' }, { to: '/organizer/trips/new', label: 'org.create_trip' }, { to: '/organizer/registrations', label: 'org.registrations' },
  { to: '/organizer/reviews', label: 'org.reviews' }, { to: '/organizer/notifications', label: 'dash.notifications' }, { to: '/organizer/profile', label: 'dash.profile' }, { to: '/traveler/profile', label: 'dash.change_password' }];
const adminLinks: DashLink[] = [
  { to: '/admin', label: 'dash.overview', end: true }, { to: '/admin/users', label: 'ad.users', group: 'ad.users' }, { to: '/admin/applications', label: 'ad.applications', group: 'ad.users' }, { to: '/admin/organizers', label: 'ad.organizers', group: 'ad.users' },
  { to: '/admin/destinations', label: 'ad.destinations', group: 'ad.trips' }, { to: '/admin/trips', label: 'ad.trips', group: 'ad.trips' }, { to: '/admin/registrations', label: 'ad.registrations', group: 'ad.trips' },
  { to: '/admin/reviews', label: 'ad.reviews', group: 'ad.settings' }, { to: '/admin/support', label: 'ad.support', group: 'ad.settings' }, { to: '/admin/categories', label: 'ad.categories', group: 'ad.settings' }, { to: '/admin/announcements', label: 'ad.announcements', group: 'ad.settings' },
  { to: '/admin/audit', label: 'ad.audit', group: 'ad.settings' }, { to: '/admin/settings', label: 'ad.settings', group: 'ad.settings' }, { to: '/admin/notifications', label: 'dash.notifications', group: 'ad.settings' }, { to: '/admin/profile', label: 'dash.profile', group: 'ad.settings' }];

export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Home />} /><Route path="/destinations" element={<Destinations />} /><Route path="/destinations/:id" element={<DestinationDetail />} />
        <Route path="/trips" element={<Trips />} /><Route path="/trips/:id" element={<TripDetail />} /><Route path="/planner" element={<Planner />} />
        <Route path="/about" element={<About />} /><Route path="/contact" element={<Contact />} /><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} />
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
          <Route path="destinations" element={<AdminDestinations />} /><Route path="trips" element={<ManageTrips admin />} /><Route path="trips/new" element={<TripForm admin />} /><Route path="trips/:id/edit" element={<TripForm admin />} />
          <Route path="trips/:id/registrations" element={<TripRegistrations admin />} /><Route path="registrations" element={<AllRegistrations admin />} /><Route path="reviews" element={<ReviewsReports />} />
          <Route path="support" element={<AdminSupport />} /><Route path="categories" element={<Categories />} /><Route path="announcements" element={<Announcements />} /><Route path="audit" element={<AuditLog />} />
          <Route path="settings" element={<SettingsPage />} /><Route path="notifications" element={<Notifications />} /><Route path="profile" element={<ProfileForm />} />
        </Route>
      </Route>
      <Route path="/dashboard" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
