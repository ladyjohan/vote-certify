import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VoterSidenavComponent } from './voter-sidenav.component';

describe('VoterSidenavComponent', () => {
  let component: VoterSidenavComponent;
  let fixture: ComponentFixture<VoterSidenavComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoterSidenavComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VoterSidenavComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
