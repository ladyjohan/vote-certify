import { ComponentFixture, TestBed } from '@angular/core/testing';

import { VoterLayoutComponent } from './voter-layout.component';

describe('VoterLayoutComponent', () => {
  let component: VoterLayoutComponent;
  let fixture: ComponentFixture<VoterLayoutComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoterLayoutComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VoterLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
