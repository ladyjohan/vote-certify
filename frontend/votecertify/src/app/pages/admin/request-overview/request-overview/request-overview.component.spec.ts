import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminRequestOverviewComponent } from './request-overview.component';

describe('RequestOverviewComponent', () => {
  let component: AdminRequestOverviewComponent;
  let fixture: ComponentFixture<AdminRequestOverviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminRequestOverviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AdminRequestOverviewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
