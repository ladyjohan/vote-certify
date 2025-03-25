import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StaffSidenavComponent } from './staff-sidenav.component';

describe('StaffSidenavComponent', () => {
  let component: StaffSidenavComponent;
  let fixture: ComponentFixture<StaffSidenavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [StaffSidenavComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StaffSidenavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
