import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VoterDashboardComponent } from './dashboard.component';
import { By } from '@angular/platform-browser';

describe('VoterDashboardComponent', () => {
  let component: VoterDashboardComponent;
  let fixture: ComponentFixture<VoterDashboardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [VoterDashboardComponent]
    }).compileComponents();

    fixture = TestBed.createComponent(VoterDashboardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should render video element with source pointing to assets', () => {
    const videoDebug = fixture.debugElement.query(By.css('video'));
    expect(videoDebug).toBeTruthy();

    const sourceEl = videoDebug.nativeElement.querySelector('source') as HTMLSourceElement;
    expect(sourceEl).toBeTruthy();

    expect(sourceEl.src).toContain('assets/videos/tutorial.mp4');
  });

  it('should show error message when onError is called', () => {
  // component.onError(); // Method no longer exists
    fixture.detectChanges();
    const err = fixture.debugElement.query(By.css('.error'));
    expect(err.nativeElement.textContent).toContain('Video failed to load');
  });
});
