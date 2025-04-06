import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore, Firestore } from '@angular/fire/firestore';
import { environment } from './environments/environment';
import { getDoc, doc } from '@angular/fire/firestore';

// ✅ Set up Firebase providers correctly
export const firebaseProviders = [
  provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
  provideAuth(() => getAuth()),
  provideFirestore(() => getFirestore())
];

export class ExampleService {
  private firestore: Firestore = getFirestore(); // ✅ Initialize Firestore properly

  async getDocument(collection: string, id: string): Promise<any> {
    try {
      const docRef = doc(this.firestore, collection, id);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        console.log('✅ Document Data:', docSnap.data());
        return docSnap.data();
      } else {
        console.warn('⚠️ No such document!');
        return null;
      }
    } catch (error) {
      console.error('❌ Error fetching document:', error);
      return null;
    }
  }
}
