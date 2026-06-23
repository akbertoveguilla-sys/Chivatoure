import { auth, db } from './firebase-config.js';
import { 
    doc, 
    updateDoc, 
    setDoc,
    getDocs, 
    collection,
    onSnapshot,
    addDoc,
    increment 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- 1. Estado Global ---
let datosReservaPendiente = null;

// --- 2. Funciones de Interfaz (UI) ---

function actualizarTarjetaUI(card, data) {
    const mapeo = {
        '.tour-titulo': data.titulo,
        '.tour-fecha-partido': data.fecha_partido,
        '.tour-fecha-salida': data.fecha_salida,
        '.tour-puntos': data.puntos_salida,
        '.tour-precio': data.precio,
        '.tour-aparta': data.aparta,
        '.tour-cupos-ocupados': data.cupo_disponible,
        '.tour-cupos-totales': data.cupo_total
    };
    
    for (const selector in mapeo) {
        const elemento = card.querySelector(selector);
        if (elemento && mapeo[selector] !== undefined) {
            selector === '.tour-puntos' ? elemento.innerHTML = mapeo[selector] : elemento.innerText = mapeo[selector];
        }
    }
    
    const bar = card.querySelector('.tour-progress-bar');
    const txt = card.querySelector('.tour-porcentaje-texto');
    if (bar && txt) {
        const ocupados = Number(data.cupo_disponible) || 0;
        const total = Number(data.cupo_total) || 1;
        const porcentaje = Math.min(Math.round((ocupados / total) * 100), 100);
        bar.style.width = `${porcentaje}%`;
        txt.innerText = `${porcentaje}%`;
    }

    const btn = card.querySelector('.btn-reservar-tour');
    if (btn) { // Corrección: Validación añadida para proteger el flujo del script
        const ocupados = Number(data.cupo_disponible) || 0;
        const total = Number(data.cupo_total) || 1;
        if (ocupados >= total) {
            btn.innerText = "AGOTADO";
            btn.classList.replace('bg-[#C4151C]', 'bg-gray-500');
            btn.disabled = true;
        } else {
            btn.innerText = "Reservar";
            btn.classList.replace('bg-gray-500', 'bg-[#C4151C]');
            btn.disabled = false;
        }
    }
}

// --- 3. Funciones de Reserva y Administración ---

window.cerrarModal = () => {
    const modal = document.getElementById('modal-informacion');
    if (modal) modal.classList.add('hidden');
};

// Corrección: Limpieza del bloque duplicado y unificación de parámetros
window.reservarTour = (id, nombre, fecha, precio, urlPago, aparta, ocupados, totales) => { 
    if (!auth || !auth.currentUser) {
        window.mostrarNotificacion("Por favor, inicia sesión para reservar.", true);
        return;
    }

    const checkbox = document.getElementById('check-terminos');
    const btn = document.getElementById('btn-confirmar');
    if (checkbox) checkbox.checked = false;
    if (btn) {
        btn.disabled = true;
        btn.classList.add("opacity-50");
        btn.innerText = "Confirmar y Pagar";
    }

    // Guardamos absolutamente todo en el estado global para el momento del pago
    datosReservaPendiente = { id, nombre, fecha, precio, urlPago, aparta, ocupados, totales }; 

    const selectLugares = document.getElementById('select-lugares');
    const totalPagoTxt = document.getElementById('modal-total-pago');
    
    // Reconstrucción dinámica de las opciones del select
    if (selectLugares) {
        selectLugares.innerHTML = ""; 
        const disponibles = totales - ocupados;
        
        // Forzamos un mínimo de 1 opción por seguridad visual si los números fallan
        const maxOpciones = disponibles > 0 ? Math.min(disponibles, 10) : 1; 
        
        for (let i = 1; i <= maxOpciones; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.innerText = i;
            selectLugares.appendChild(option);
        }
        selectLugares.value = "1"; 
    }
    
    if (totalPagoTxt) totalPagoTxt.innerText = aparta; 

    const modal = document.getElementById('modal-informacion');
    if (modal) modal.classList.remove('hidden');
};

window.prepararReserva = (boton) => {
    if (!auth.currentUser) {
        window.mostrarNotificacion("Debes iniciar sesión para reservar", true);
        return;
    }

    const card = boton.closest('.card-hover');
    
    // Extraemos el texto de forma segura
    const ocupadosTexto = card.querySelector('.tour-cupos-ocupados')?.innerText || "0";
    const totalesTexto = card.querySelector('.tour-cupos-totales')?.innerText || "0";
