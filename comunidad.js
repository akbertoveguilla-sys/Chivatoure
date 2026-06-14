// --- 1. IMPORTACIONES ---
import { db, auth } from './firebase-config.js'; 
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";
import { 
    collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, 
    doc, getDoc, deleteDoc, updateDoc, arrayUnion 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

const storage = getStorage();
const ADMIN_UID = "f0M2dGbM7aQPVKI2P4Fr7P6NJnX2";
let galeriaDatos = []; // Se llena desde Firebase

// --- 2. FUNCIONES ADMIN ---
window.cambiarTitulo = async (docId, nuevoTitulo) => {
    if (auth.currentUser?.uid !== ADMIN_UID) return window.mostrarNotificacion("No autorizado", true);
    try {
        await updateDoc(doc(db, "galerias", docId), { titulo: nuevoTitulo });
        window.mostrarNotificacion("Título actualizado");
    } catch (e) { window.mostrarNotificacion("Error al actualizar", true); }
};

window.subirFoto = async (docId, file) => {
    if (auth.currentUser?.uid !== ADMIN_UID) return window.mostrarNotificacion("No autorizado", true);
    try {
        const storageRef = ref(storage, `galeria/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        await updateDoc(doc(db, "galerias", docId), { fotos: arrayUnion(url) });
        window.mostrarNotificacion("Foto subida");
    } catch (e) { window.mostrarNotificacion("Error al subir", true); }
};

window.borrarComentario = async (idComentario) => {
    if (!auth.currentUser || auth.currentUser.uid !== ADMIN_UID) {
        return window.mostrarNotificacion("No tienes permiso para esta acción.", true);
    }
    try {
        await deleteDoc(doc(db, "comentarios", idComentario));
        window.mostrarNotificacion("Comentario eliminado correctamente.");
    } catch (error) {
        console.error("Error al borrar:", error);
        window.mostrarNotificacion("Error al borrar el comentario.", true);
    }
};

// --- 3. LÓGICA DE RENDERIZADO (NUEVA ESTRUCTURA) ---

function renderizarGaleria() {
    const container = document.getElementById('gallery-container');
    if(!container) return;

    container.innerHTML = "";
    const esAdmin = auth.currentUser?.uid === ADMIN_UID;

    galeriaDatos.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = "flex flex-col items-center";
        
        div.innerHTML = `
            <div class="bloque-marco bg-gray-900 border-4 border-[#8B5E3C] rounded-lg overflow-hidden h-64 w-full relative group">
                <div class="carrusel-track flex overflow-x-auto h-full snap-x snap-mandatory scrollbar-hide">
                    ${item.fotos.map((url, imgIdx) => `<img src="${url}" class="min-w-full h-full object-cover cursor-pointer flex-shrink-0" onclick="window.abrirLightbox(${idx}, ${imgIdx})">`).join('')}
                </div>
            </div>
            ${esAdmin ? `
                <div class="admin-only mt-2 p-2 bg-gray-800 rounded w-full">
                    <input type="text" value="${item.titulo}" onchange="window.cambiarTitulo('${item.id}', this.value)" class="text-black p-1 text-sm w-full" placeholder="Nuevo título">
                    <input type="file" onchange="window.subirFoto('${item.id}', this.files[0])" class="text-white text-xs mt-1">
                </div>` : ''}
            <h3 class="mt-3 text-white font-bold text-sm uppercase">${item.titulo}</h3>
        `;
        container.appendChild(div);
    });
}

// --- 4. LÓGICA DE INICIO ---
let currentGalleryIdx = 0; 
let currentPhotoIdx = 0;
let ultimoSnapshot = null;

document.addEventListener("DOMContentLoaded", () => {
    // A. Escuchar cambios en la base de datos
    onSnapshot(collection(db, "galerias"), (snapshot) => {
        galeriaDatos = []; 
        snapshot.forEach((doc) => {
            galeriaDatos.push({ id: doc.id, ...doc.data() }); 
        });
        renderizarGaleria(); // Redibujar cuando hay datos nuevos
    });

    // B. Comentarios
    const lista = document.getElementById('comment-list');
    if(lista) {
        const q = query(collection(db, "comentarios"), orderBy("fecha", "desc"), limit(20));
        onSnapshot(q, (snapshot) => { pintarComentarios(snapshot); });
    }
    
    iniciarCarruseles();
});

// --- 5. AUTENTICACIÓN Y UI (REACTIVA) ---
onAuthStateChanged(auth, async (user) => {
    // 1. Redibujar la galería al cambiar de sesión (Login/Logout)
    renderizarGaleria(); 

    // 2. Lógica de inputs de usuario
    const nombreInput = document.getElementById('nombre-usuario');
    const comentarioInput = document.getElementById('txt-comentario');
    const btnEnviar = document.getElementById('btn-enviar');

    if (user && nombreInput) {
        let nombreFinal = user.displayName;
        if (!nombreFinal) {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) nombreFinal = userDoc.data().nombre;
            } catch (e) { console.error("Error al obtener perfil:", e); }
        }
        
        nombreInput.value = nombreFinal || user.email || "Usuario";
        nombreInput.disabled = true; 
        nombreInput.classList.add('opacity-50', 'cursor-not-allowed');
        
        if (comentarioInput) {
            comentarioInput.disabled = false;
            comentarioInput.placeholder = "Escribe tu comentario...";
        }
        if (btnEnviar) btnEnviar.disabled = false;

    } else if (nombreInput) {
        nombreInput.value = "";
        nombreInput.disabled = true;
        nombreInput.classList.remove('opacity-50', 'cursor-not-allowed');
        if (comentarioInput) {
            comentarioInput.value = "";
            comentarioInput.disabled = true;
            comentarioInput.placeholder = "⚠️ Inicia sesión para comentar";
        }
        if (btnEnviar) btnEnviar.disabled = true;
    }

    if (ultimoSnapshot) pintarComentarios(ultimoSnapshot);
});

// --- 6. FUNCIONES GLOBALES ---
window.validarSesion = () => {
    if (!auth.currentUser) {
        window.mostrarNotificacion("⚠️ Inicia sesión para comentar.", true);
        return false;
    }
    return true;
};

window.enviarComentario = async () => { 
    if (!window.validarSesion()) return;
    const nombreInput = document.getElementById('nombre-usuario');
    const textoInput = document.getElementById('txt-comentario');
    const rating = parseInt(document.getElementById('select-rating')?.value || 5);

    if (nombreInput.value.trim() === "" || textoInput.value.trim() === "") {
        window.mostrarNotificacion("⚠️ Completa los campos.", true);
        return;
    }

    try {
        await addDoc(collection(db, "comentarios"), { 
            nombre: nombreInput.value.trim(), 
            texto: textoInput.value.trim(), 
            rating, 
            fecha: serverTimestamp(), 
            uid: auth.currentUser.uid 
        });
        window.mostrarNotificacion("¡Comentario enviado!");
        textoInput.value = "";
    } catch (e) { window.mostrarNotificacion("Error: " + e.message, true); }
};

window.abrirLightbox = (idx, photoIdx = 0) => {
    currentGalleryIdx = idx; 
    currentPhotoIdx = photoIdx;
    const lightbox = document.getElementById('lightbox');
    const img = document.getElementById('lightbox-img');
    if (lightbox && img) {
        lightbox.classList.remove('hidden');
        img.src = galeriaDatos[currentGalleryIdx].fotos[currentPhotoIdx];
    }
};

window.cerrarLightbox = () => {
    const lightbox = document.getElementById('lightbox');
    if(lightbox) lightbox.classList.add('hidden');
};

window.cambiarFotoManual = (direccion) => {
    const galeria = galeriaDatos[currentGalleryIdx].fotos;
    currentPhotoIdx = (currentPhotoIdx + direccion + galeria.length) % galeria.length;
    const img = document.getElementById('lightbox-img');
    if (img) img.src = galeria[currentPhotoIdx];
};

const iniciarCarruseles = () => {
    const tracks = document.querySelectorAll('.carrusel-track');
    if (tracks.length === 0) return;
    setInterval(() => {
        tracks.forEach((track) => {
            if (track.scrollLeft + track.clientWidth >= track.scrollWidth - 10) {
                track.scrollTo({ left: 0, behavior: 'smooth' });
            } else {
                track.scrollBy({ left: track.clientWidth, behavior: 'smooth' });
            }
        });
    }, 4000);
};

function pintarComentarios(snapshot) {
    ultimoSnapshot = snapshot;
    const lista = document.getElementById('comment-list');
    const scoreText = document.getElementById('promedio-score');
    const starsContainer = document.getElementById('stars-container');

    if (!lista) return;
    lista.innerHTML = "";
    let sumaRatings = 0;
    let totalComentarios = 0;

    snapshot.forEach((doc) => {
        const data = doc.data();
        if(data.rating) {
            sumaRatings += data.rating;
            totalComentarios++;
        }

        const esAdmin = auth.currentUser && auth.currentUser.uid === ADMIN_UID;
        const botonBorrar = esAdmin 
            ? `<button onclick="window.borrarComentario('${doc.id}')" class="text-red-500 hover:text-red-700 ml-2 font-bold cursor-pointer">🗑️</button>` 
            : '';

        lista.innerHTML += `
        <div class="bg-gray-900 p-4 rounded-lg border-l-4 border-[#C4151C]">
            <div class="flex justify-between items-center">
                <p class="font-bold text-white">${data.nombre} 
                    <span class="text-amber-400">${data.rating}/5</span>
                </p>
                ${botonBorrar}
            </div>
            <p class="text-gray-300">${data.texto}</p>
        </div>`;
    });

    if (totalComentarios > 0) {
        const promedio = (sumaRatings / totalComentarios);
        if(scoreText) scoreText.innerText = promedio.toFixed(1);
        if(starsContainer) {
            starsContainer.innerHTML = "";
            const estrellasLlenas = Math.round(promedio);
            for(let i = 1; i <= 5; i++) {
                const icon = i <= estrellasLlenas ? 'fas fa-star' : 'far fa-star';
                starsContainer.innerHTML += `<i class="${icon}"></i>`;
            }
        }
    }
}