import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, collection, addDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyC9U5zMzDzKjQ7ACWSxUJKNT79d_cZi7as",
    authDomain: "chivatours-d50ee.firebaseapp.com",
    projectId: "chivatours-d50ee",
    storageBucket: "chivatours-d50ee.firebasestorage.app",
    messagingSenderId: "691235625092",
    appId: "1:691235625092:web:56fb750785e14d9c1f8ad1"
};

const app = initializeApp(firebaseConfig);


// 3. INICIALIZACIÓN
export const auth = getAuth(app);
export const db = getFirestore(app);
export { collection, addDoc }; // <--- AGREGAR ESTA LÍNEA




