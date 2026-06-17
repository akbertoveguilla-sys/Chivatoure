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




