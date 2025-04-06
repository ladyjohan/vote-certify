import { Injectable } from '@angular/core';
import { inject } from '@angular/core';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { provideFirestore, getFirestore, Firestore } from '@angular/fire/firestore';
import { environment } from './environments/environment';
import { getDoc, doc } from 'firebase/firestore';

// ✅ Set up Firebase providers correctly for Angular
export const firebaseProviders = [
  provideFirebaseApp(() => initializeApp(environment.firebaseConfig)),
  provideAuth(() => getAuth()),
  provideFirestore(() => getFirestore())
];

@Injectable({
  providedIn: 'root'
})
export class ExampleService {
  private firestore: Firestore = inject(Firestore); // ✅ Inject Firestore service

  // ✅ Get a Firestore document by collection name and document ID
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
