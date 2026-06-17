// admin.js
import { auth, db } from './firebase-config.js'; // Verifica que la ruta sea correcta
import { 
    doc, 
    getDoc, // <--- Asegúrate de tener esto
    updateDoc, 
    setDoc,
    getDocs, 
    collection,
    onSnapshot,
    addDoc,
    increment 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";



window.cargarNotasAdmin = async () => {
    try {
        // Usamos una variable llamada 'notaRef' para no entrar en conflicto con la función 'doc'
        const notaRef = doc(db, "admin", "bloque_notas"); 
        const docSnap = await getDoc(notaRef);
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            for (let i = 1; i <= 9; i++) {
                const tituloInput = document.getElementById(`nota-titulo-${i}`);
                const textoInput = document.getElementById(`nota-texto-${i}`);
                
                if (data[`nota_${i}`]) {
                    if (tituloInput) tituloInput.value = data[`nota_${i}`].titulo || '';
                    if (textoInput) textoInput.value = data[`nota_${i}`].texto || '';
                }
            }
        }
    } catch (error) {
        console.error("Error al cargar las notas de administración:", error);
    }
};


// Guardar una nota individual en Firebase
window.guardarNotaAdmin = async (id) => {
    const titulo = document.getElementById(`nota-titulo-${id}`).value.trim();
    const texto = document.getElementById(`nota-texto-${id}`).value.trim();

    try {
        // Guardamos o actualizamos solo la casilla correspondiente usando setDoc con { merge: true }
        await setDoc(doc(db, "admin", "bloque_notas"), {
            [`nota_${id}`]: {
                titulo: titulo,
                texto: texto,
                ultimaActualizacion: new Date()
            }
        }, { merge: true });

        window.mostrarNotificacion(`✅ Nota #${id} guardada correctamente.`);
    } catch (error) {
        console.error("Error al guardar la nota:", error);
        window.mostrarNotificacion("❌ Error al guardar la nota en la base de datos", true);
    }
};


