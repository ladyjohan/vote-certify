import { Routes } from '@angular/router';
import { RegisterComponent } from './pages/register/register.component';
import { LoginComponent } from './pages/login/login.component';
import { VoterDashboardComponent } from './pages/voter-dashboard/voter-dashboard.component';
import { AdminDashboardComponent } from './pages/admin-dashboard/admin-dashboard.component';
import { StaffDashboardComponent } from './pages/staff-dashboard/staff-dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  { path: 'voter-dashboard', component: VoterDashboardComponent },
  { path: 'admin-dashboard', component: AdminDashboardComponent },
  { path: 'staff-dashboard', component: StaffDashboardComponent },
];
