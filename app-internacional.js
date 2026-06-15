import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { doc, getDoc, onSnapshot, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { auth, db, collection, addDoc } from './firebase-config.js';

// --- 1. Inicialización de Cupos ---
const initCupos = () => {
    const viajesRef = collection(db, "viajes");
    onSnapshot(viajesRef, (snapshot) => {
        snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            const contenedor = document.querySelector(`[data-id="${docSnap.id}"]`);
            if (!contenedor) return;

            const setText = (clase, valor) => {
                const el = contenedor.querySelector(clase);
                if (el) el.innerText = valor || "--";
            };

            // 1. Actualizar textos simples
            setText('.tour-titulo', data.Titulo);
            setText('.tour-subtitulo', data.Subtitulo);
            setText('.tour-precio', data.precio?.toLocaleString());
            setText('.tour-fecha-evento', data["fecha evento"]);
            setText('.tour-salida', data["fecha salida"]);
            setText('.tour-regreso', data["fecha regreso"]);
            
            // 2. Actualizar Cupos y Barra visual
            const oc = Number(data.cuposOcupados) || 0;
            const tot = Number(data.cuposTotales) || 0;
            
            setText('.tour-cupos-ocupados', oc);
            setText('.tour-cupos-totales', tot);

            // --- LÓGICA DE LA BARRA ---
            const elBarra = contenedor.querySelector('.barra-progreso');
            const elPct = contenedor.querySelector('.porcentaje-cupo');

            if (elBarra && elPct) {
                if (tot > 0) {
                    const porcentaje = Math.min((oc / tot) * 100, 100);
                    elBarra.style.width = porcentaje + "%";
                    elPct.innerText = Math.round(porcentaje) + "%";
                } else {
                    elBarra.style.width = "0%";
                    elPct.innerText = "0%";
                }
            }
        });
    });
};


// --- 2. Lógica de Admin ---
const verificarAdmin = async (user) => {
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === 'admin') {
            document.querySelectorAll('.admin-controls').forEach(el => {
                el.classList.remove('hidden');
            });
        }
    } catch (error) {
        console.error("Error al verificar admin:", error);
    }
};

// --- 3. Funciones del Modal y Admin (Expuestas a Window) ---

window.guardarCambiosInternacional = async (btn) => {
    // 1. Aislamiento total: Buscamos solo dentro de este contenedor
    const contenedor = btn.closest('[data-id]');
    const idTour = contenedor.getAttribute('data-id');
    
    if (!idTour) {
        window.mostrarNotificacion("Error: No se pudo identificar el tour.", true);
        return;
    }

    const datosAEnviar = {};

    try {
        // Función interna para capturar
        const addIfNotEmpty = (key, selector, isNumber = false) => {
            const el = contenedor.querySelector(selector); // <--- IMPORTANTE: Solo dentro del contenedor
            const valor = el?.value;
            if (valor !== "" && valor !== undefined && valor !== null) {
                datosAEnviar[key] = isNumber ? Number(valor) : valor;
            }
        };

        // Captura usando prefijos únicos (ej: .inter-input-titulo)
        // Asegúrate de que en tu HTML estas clases sean exclusivas de Internacionales
        addIfNotEmpty("Titulo", ".inter-input-titulo");
        addIfNotEmpty("Subtitulo", ".inter-input-subtitulo");
        addIfNotEmpty("fecha evento", ".inter-input-fecha-evento");
        addIfNotEmpty("fecha salida", ".inter-input-salida");
        addIfNotEmpty("fecha regreso", ".inter-input-regreso");
        addIfNotEmpty("precio", ".inter-input-precio", true);
        addIfNotEmpty("cuposOcupados", ".inter-input-ocupados", true);
        addIfNotEmpty("cuposTotales", ".inter-input-totales", true);
        addIfNotEmpty("itinerario", ".inter-input-itinerario");
        addIfNotEmpty("terminos", ".inter-input-terminos");

        if (Object.keys(datosAEnviar).length === 0) {
            window.mostrarNotificacion("No has realizado cambios para guardar.");
            return;
        }

        // 2. Guardar en Firebase
        const tourRef = doc(db, "viajes", idTour);
        await setDoc(tourRef, datosAEnviar, { merge: true });

        // 3. Notificación de éxito
        window.mostrarNotificacion("Cambios guardados correctamente.");

        // 4. Limpieza de campos (SOLO dentro de este contenedor)
        contenedor.querySelectorAll('input, textarea').forEach(el => {
            if (el.tagName !== 'BUTTON' && el.type !== 'submit') {
                el.value = '';
            }
        });

        console.log("Datos guardados en ID:", idTour, datosAEnviar);

    } catch (error) {
        console.error("Error al guardar:", error);
        window.mostrarNotificacion("Error: " + error.message, true);
    }
};


//abre terminos y condi
window.abrirModalReserva = async (btn) => {
    // Validación de sesión
    if (!auth.currentUser) {
        window.mostrarNotificacion("Por favor, inicia sesión para reservar tú lugar.", true);
        return;
    }

    const contenedor = btn.closest('[data-id]');
    if (!contenedor) return;
    
    const idTour = contenedor.getAttribute('data-id');
    try {
        const tourRef = doc(db, "viajes", idTour);
        const docSnap = await getDoc(tourRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            // CORRECCIÓN: Validamos 'Título' (con acento) y 'Titulo' de tu BD antes de los demás respaldos
            window.viajeSeleccionado = data.Título || data.Titulo || data.titulo || data.nombre || data.destino || btn.dataset.titulo || "Viaje Internacional";

            // Inyectar en el modal
            document.getElementById('modal-itinerario-text').innerText = data.itinerario || "Sin itinerario disponible.";
            document.getElementById('modal-terminos-text').innerText = data.terminos || "Sin políticas disponibles.";
        }

        // === NUEVA LÓGICA DE CONTROL (RESETEO) ===
        const checkbox = document.getElementById('check-terminos'); 
        const btnReservar = document.getElementById('btn-confirmar-reserva'); 

        if (checkbox && btnReservar) {
            checkbox.checked = false;   // Forzamos a que el check siempre inicie DESACTIVADO
            btnReservar.disabled = true; // Forzamos a que el botón inicie BLOQUEADO
        }
        // =========================================

        document.getElementById('modal-politicas').classList.remove('hidden');
    } catch (error) {
        console.error("Error al cargar modal:", error);
        window.mostrarNotificacion("Error al cargar modal: " + error.message, true);
    }
};







//boton reserva confirmada
window.confirmarReservaInternacional = async (btn) => {
    // 1. Validamos el checkbox
    const checkbox = document.getElementById('check-inter-terminos');
    if (checkbox && !checkbox.checked) {
        alert("Debes aceptar los términos y condiciones.");
        return;
    }

    // 2. Obtenemos el usuario logueado
    const user = auth.currentUser;
    if (!user) {
        alert("Debes iniciar sesión para reservar.");
        return;
    }

    try {
        // Obtenemos el título guardado globalmente por abrirModalReserva
        const tituloViaje = window.viajeSeleccionado || "Viaje Internacional";

        // Buscamos el nombre del usuario directamente en Firestore (Colección 'users')
        let nombreUsuario = user.displayName;
        
        try {
            const userRef = doc(db, "users", user.uid); 
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                // Intenta obtener el nombre según cómo se llame tu campo en la base de datos
                nombreUsuario = userData.nombre || userData.nombreCompleto || userData.name || nombreUsuario;
            }
        } catch (dbError) {
            console.error("Error al obtener nombre de usuario desde Firestore:", dbError);
        }

        // Si no hay nombre en la base de datos ni en auth, usamos el correo antes del @
        if (!nombreUsuario && user.email) {
            nombreUsuario = user.email.split('@')[0];
        }
        if (!nombreUsuario) {
            nombreUsuario = "Usuario registrado";
        }

        // --- LÓGICA DE WHATSAPP ---
        const numeroWhatsApp = "5215518102711"; // Tu número registrado
        const mensaje = `¡Hola! 👋\n` +
                        `Quiero solicitar la información de pago para poder reservar.\n\n` +
                        `Datos:\n` +
                        `- Viaje: ${tituloViaje}\n` +
                        `- Nombre: ${nombreUsuario}\n` +
                        `- Estado: Acepté términos y condiciones.\n\n` +
                        `¿Me podrían proporcionar los datos para el depósito o pago con tarjeta?`;

        // Abrir WhatsApp con el mensaje
        window.open(`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`, '_blank');
        
        // 4. Mostramos el mensaje de confirmación
        alert("Redirigiendo a WhatsApp para completar tu reserva.");
        
        // 5. Cerramos el modal
        const modal = document.getElementById('modal-politicas');
        if (modal) modal.classList.add('hidden');

    } catch (error) {
        console.error("Error al procesar:", error);
        alert("Ocurrió un error al procesar tu solicitud. Intenta de nuevo.");
    }
};





// --- 4. Ejecución principal ---
document.addEventListener('DOMContentLoaded', () => {
    initCupos();
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await verificarAdmin(user);
    }
});

//tache para cerrar terminos y conwindow.cerrarModalReserva = () => {
    // === NUEVA LÓGICA DE RESETEO ===
    const checkbox = document.getElementById('check-inter-terminos'); 
    const btnReservar = document.getElementById('btn-confirmar-reserva'); 

    if (checkbox && btnReservar) {
        checkbox.checked = false;   // Desmarca el checkbox
        btnReservar.disabled = true; // Bloquea el botón de nuevo
    }
    // ===============================

    // Tu código original que ya funcionaba:
    document.getElementById('modal-politicas').classList.add('hidden');
};


