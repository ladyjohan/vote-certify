import { Routes } from '@angular/router';
import { RegisterComponent } from './pages/register/register.component';
import { LoginComponent } from './pages/login/login.component';
import { VerifyEmailComponent } from './pages/verify-email/verify-email.component'; // ✅ Import VerifyEmailComponent

// Layout Components
import { AdminLayoutComponent } from './pages/admin/admin-layout/admin-layout.component';
import { StaffLayoutComponent } from './pages/staff/staff-layout/staff-layout.component';
import { VoterLayoutComponent } from './pages/voter/voter-layout/voter-layout.component';

// Page Components
import { VoterDashboardComponent } from './pages/voter/dashboard/dashboard/dashboard.component';
import { LandingComponent } from './pages/landing/landing/landing.component';
import { AdminDashboardComponent } from './pages/admin/dashboard/dashboard/dashboard.component';
import { StaffDashboardComponent } from './pages/staff/dashboard/dashboard/dashboard.component';
import { RequestFormComponent } from './pages/voter/request-form/request-form/request-form.component';
import { CertificateStatusComponent } from './pages/voter/certificate-status/certificate-status/certificate-status.component';
import { VoterChatComponent } from './pages/voter/chat/voter-chat/voter-chat.component';
import { RequestManagementComponent } from './pages/staff/request-management/request-management/request-management.component';
import { StatusOverviewComponent } from './pages/staff/status-overview/status-overview/status-overview.component';
import { AdminRequestOverviewComponent } from './pages/admin/request-overview/request-overview/request-overview.component';
import { AdminUserManagementComponent } from './pages/admin/user-management/user-management/user-management.component';
import { StaffProfileComponent } from './pages/staff/staff-profile/staff-profile.component';
import { StaffChatComponent } from './pages/staff/chat/staff-chat/staff-chat.component';

export const routes: Routes = [
  { path: '', component: LandingComponent },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'verify-email', component: VerifyEmailComponent },

  // Admin Routes (with AdminLayout)
  {
    path: 'admin',
    component: AdminLayoutComponent,
    children: [
      { path: 'dashboard', component: AdminDashboardComponent },
      { path: 'request-overview', component: AdminRequestOverviewComponent },
      { path: 'user-management', component: AdminUserManagementComponent },
    ],
  },

  // Staff Routes (with StaffLayout)
  {
    path: 'staff',
    component: StaffLayoutComponent,
    children: [
      { path: 'dashboard', component: StaffDashboardComponent },
      { path: 'request-management', component: RequestManagementComponent },
      { path: 'status-overview', component: StatusOverviewComponent },
      { path: 'staff-profile', component: StaffProfileComponent },
      { path: 'chat', component: StaffChatComponent },
      { path: 'chat/:requestId', component: StaffChatComponent }
    ],
  },

  // Voter Routes (with VoterLayout)
  {
    path: 'voter',
    component: VoterLayoutComponent, // layout with sidenav + header
    children: [
      { path: 'dashboard', component: VoterDashboardComponent },
      { path: 'request-form', component: RequestFormComponent },
      { path: 'certificate-status', component: CertificateStatusComponent },
      { path: 'chat', component: VoterChatComponent },
      { path: 'chat/:requestId', component: VoterChatComponent }
    ],
  },
  
  // Wildcard route - must be last
  { path: '**', redirectTo: '/', pathMatch: 'full' }
];
