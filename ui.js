import { auth } from './firebase-config.js';
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";


// 5. NAVEGACIÓN
window.switchPage = (pageId) => {
    // 1. Quitar 'active' de todas las secciones
    document.querySelectorAll('.page-section').forEach(section => {
        section.classList.remove('active');
    });
    
    // 2. Buscar y activar la seleccionada (Soporta tanto 'page-id' como el 'id' directo)
    let target = document.getElementById('page-' + pageId);
    if (!target) {
        target = document.getElementById(pageId);
    }
    
    if (target) {
        target.classList.add('active'); // El CSS se encarga de mostrarla
        console.log("Sección activada con éxito.");
    } else {
        console.error("Error: No encuentro el elemento con ID: 'page-" + pageId + "' ni '" + pageId + "'");
    }
    
    // 3. Cerrar menú móvil si existe
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) mobileMenu.classList.add('hidden');
};

// ui.js (al final del archivo)

// Esta función conecta los botones cuando el HTML ya existe
const vincularBotones = () => {
    // Lista de botones de navegación (Se incluye el botón de notas de admin)
    const navButtons = [
        { id: 'btn-viajes', page: 'viajes' },
        { id: 'btn-internacionales', page: 'internacionales' },
        { id: 'btn-shop', page: 'shop' },
        { id: 'btn-comunidad', page: 'comunidad' },
        { id: 'btn-notas', page: 'admin-notes-page' }
    ];

    navButtons.forEach(btnInfo => {
        const btn = document.getElementById(btnInfo.id);
        if (btn) {
            btn.addEventListener('click', () => window.switchPage(btnInfo.page));
        }
    });

    // También puedes conectar botones de reserva si los tienes
    const btnReserva = document.getElementById('btn-reservar-tour');
    if (btnReserva) {
        btnReserva.addEventListener('click', () => {
             // Aquí llamas a la función que necesites de app.js
             if (window.reservarTour) window.reservarTour(); 
        });
    }
};

// Ejecutar la vinculación cuando la página cargue
document.addEventListener('DOMContentLoaded', () => {
    // 1. Vinculamos los botones (esto es lo que ya tenías)
    if (typeof vincularBotones === 'function') {
        vincularBotones();
    }

    // 2. Fuerza a que se vea la sección de inicio al abrir la página
    // IMPORTANTE: Asegúrate de que el ID sea 'page-inicio'
    const seccionInicio = document.getElementById('page-inicio');
    if (seccionInicio) {
        seccionInicio.classList.add('active');
        console.log("Página de inicio cargada correctamente.");
    } else {
        console.error("No se encontró el elemento con ID 'page-inicio'");
    }
});




// --- LÓGICA DE CONTROL PARA LOS 9 BLOCKS DE NOTAS ---

// Cargar todas las notas desde la base de datos
window.cargarNotasAdmin = async () => {
    try {
        // Guardamos las notas en un documento centralizado llamado "bloque_notas" dentro de la colección "admin"
        const docSnap = await getDoc(doc(db, "admin", "bloque_notas"));
        
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Iteramos del 1 al 9 para rellenar los campos
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

