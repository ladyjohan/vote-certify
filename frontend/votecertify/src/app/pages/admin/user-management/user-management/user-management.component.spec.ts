import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminUserManagementComponent } from './user-management.component';

describe('UserManagementComponent', () => {
  let component: AdminUserManagementComponent;
  let fixture: ComponentFixture<AdminUserManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminUserManagementComponent]  // Use the correct component here
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminUserManagementComponent);  // Use the correct component here
    component = fixture.componentInstance;
    fixture.detectChanges();
  });


  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
