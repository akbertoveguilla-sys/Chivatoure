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
                if (el) el.innerText = valor ?? "--"; 
            };

            // 1. Actualizar textos simples
            setText('.tour-titulo', data.titulo);
            setText('.tour-subtitulo', data.subtitulo);
            setText('.tour-precio', data.precio?.toLocaleString());
            setText('.tour-fecha-evento', data.fecha_evento);
            setText('.tour-salida', data.fecha_salida);
            setText('.tour-regreso', data.fecha_regreso);
            
            // 2. Actualizar Cupos
            const oc = Number(data.cupos_ocupados) || 0;
            const tot = Number(data.cupos_totales) || 0;
            
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

            // --- LÓGICA DEL BOTÓN AGOTADO / SIN CUPOS ---
            const btn = contenedor.querySelector('.btn-reservar-internacional');
            
            if (btn) {
                // MODIFICACIÓN: Se agrega la condición (tot === 0)
                if (tot === 0 || oc >= tot) {
                    // ESTADO AGOTADO / NO DISPONIBLE
                    btn.innerText = "AGOTADO";
                    btn.disabled = true;
                    btn.style.backgroundColor = "#6b7280";
                    btn.style.cursor = "not-allowed";
                    btn.style.opacity = "0.6";
                } else {
                    // ESTADO DISPONIBLE
                    btn.innerText = "Reservar";
                    btn.disabled = false;
                    btn.style.backgroundColor = "#C4151C";
                    btn.style.cursor = "pointer";
                    btn.style.opacity = "1";
                }
            }
        });
    });
};

// --- 2. Lógica de Admin ---
const verificarAdmin = async (user) => {
    const adminControls = document.querySelectorAll('.admin-controls');
    
    adminControls.forEach(el => el.classList.add('hidden'));

    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        
        if (userDoc.exists() && userDoc.data().role === 'admin') {
            adminControls.forEach(el => el.classList.remove('hidden'));
        }
    } catch (error) {
        console.error("Error al verificar admin:", error);
    }
};

// --- 3. Funciones del Modal y Admin (Expuestas a Window) ---
window.guardarCambiosInternacional = async (btn) => {
    const contenedor = btn.closest('[data-id]');
    const idTour = contenedor ? contenedor.getAttribute('data-id') : null;
    
    if (!idTour) {
        window.mostrarNotificacion("Error: No se pudo identificar el tour.", true);
        return;
    }

    const datosAEnviar = {};

    try {
        const addIfNotEmpty = (key, selector, isNumber = false) => {
            const el = contenedor.querySelector(selector); 
            const valor = el?.value;
            if (valor !== "" && valor !== undefined && valor !== null) {
                datosAEnviar[key] = isNumber ? Number(valor) : valor;
            }
        };

        addIfNotEmpty("titulo", ".inter-input-titulo");
        addIfNotEmpty("subtitulo", ".inter-input-subtitulo");
        addIfNotEmpty("fecha_evento", ".inter-input-fecha-evento");
        addIfNotEmpty("fecha_salida", ".inter-input-salida");
        addIfNotEmpty("fecha_regreso", ".inter-input-regreso");
        addIfNotEmpty("precio", ".inter-input-precio", true);
        addIfNotEmpty("cupos_ocupados", ".inter-input-ocupados", true);
        addIfNotEmpty("cupos_totales", ".inter-input-totales", true);
        addIfNotEmpty("itinerario", ".inter-input-itinerario");
        addIfNotEmpty("terminos", ".inter-input-terminos");

        if (Object.keys(datosAEnviar).length === 0) {
            window.mostrarNotificacion("No has realizado cambios para guardar.");
            return;
        }

        const tourRef = doc(db, "viajes", idTour);
        await setDoc(tourRef, datosAEnviar, { merge: true });

        window.mostrarNotificacion("Cambios guardados correctamente.");

        contenedor.querySelectorAll('input, textarea').forEach(el => {
            if (el.tagName !== 'BUTTON' && el.type !== 'submit') {
                el.value = '';
            }
        });

    } catch (error) {
        console.error("Error al guardar:", error);
        window.mostrarNotificacion("Error: " + error.message, true);
    }
};

window.abrirModalReserva = async (btn) => {
    if (!auth.currentUser) {
        if (typeof window.mostrarNotificacion === "function") {
            window.mostrarNotificacion("Por favor, inicia sesión para reservar tu lugar.", true);
        } else {
            alert("Por favor, inicia sesión para reservar tu lugar.");
        }
        return;
    }

    const contenedor = btn.closest('[data-id]');
    if (!contenedor) return;
    
    const idTour = contenedor.getAttribute('data-id');
    const modalPoliticas = document.getElementById('modal-politicas');

    if (!modalPoliticas) {
        console.error("Error de configuración: El elemento #modal-politicas no existe en esta página.");
        return;
    }

    try {
        const tourRef = doc(db, "viajes", idTour);
        const docSnap = await getDoc(tourRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // --- INICIO DE VALIDACIÓN DE CUPO ---
            const ocupados = Number(data.cupos_ocupados) || 0;
            const totales = Number(data.cupos_totales) || 0;

            // MODIFICACIÓN: Se agrega la condición (totales === 0)
            if (totales === 0 || ocupados >= totales) {
                window.mostrarNotificacion("¡Tour no disponible o agotado!", true);
                return; 
            }
            // --- FIN DE VALIDACIÓN ---

            window.viajeSeleccionado = data.Título || data.Titulo || data.titulo || data.nombre || data.destino || btn.dataset.titulo || "Viaje Internacional";

            const elItinerario = document.getElementById('modal-itinerario-text');
            const elTerminos = document.getElementById('modal-terminos-text');
            if (elItinerario) elItinerario.innerText = data.itinerario || "Sin itinerario disponible.";
            if (elTerminos) elTerminos.innerText = data.terminos || "Sin políticas disponibles.";
        }

        const checkboxInter = document.getElementById('check-inter-terminos');
        const btnConfirmarInter = document.getElementById('btn-confirmar-reserva');

        if (checkboxInter) checkboxInter.checked = false;
        if (btnConfirmarInter) {
            btnConfirmarInter.disabled = true;
            btnConfirmarInter.classList.add('opacity-50');
        }

        modalPoliticas.classList.remove('hidden');

    } catch (error) {
        console.error("Error al cargar modal:", error);
    }
};

window.confirmarReservaInternacional = async (btn) => {
    const checkbox = document.getElementById('check-inter-terminos');
    if (checkbox && !checkbox.checked) {
        alert("Debes aceptar los términos y condiciones.");
        return;
    }

    const user = auth.currentUser;
    if (!user) {
        alert("Debes iniciar sesión para reservar.");
        return;
    }

    try {
        const tituloViaje = window.viajeSeleccionado || "Viaje Internacional";
        let nombreUsuario = user.displayName;
        
        try {
            const userRef = doc(db, "users", user.uid); 
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                nombreUsuario = userData.nombre || userData.nombreCompleto || userData.name || nombreUsuario;
            }
        } catch (dbError) {
            console.error("Error al obtener nombre de usuario desde Firestore:", dbError);
        }

        if (!nombreUsuario && user.email) {
            nombreUsuario = user.email.split('@')[0];
        }
        if (!nombreUsuario) {
            nombreUsuario = "Usuario registrado";
        }

        const numeroWhatsApp = "5215529944781"; 
        const mensaje = `¡Hola! 👋\n` +
                        `Quiero solicitar la información de pago para poder reservar.\n\n` +
                        `Datos:\n` +
                        `- Viaje: ${tituloViaje}\n` +
                        `- Nombre: ${nombreUsuario}\n` +
                        `- Estado: Acepté términos y condiciones.\n\n` +
                        `¿Me podrían proporcionar los datos para el depósito o pago con tarjeta?`;

        window.open(`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`, '_blank');
        
        alert("Redirigiendo a WhatsApp para completar tu reserva.");
        
        window.cerrarModalReserva();

    } catch (error) {
        console.error("Error al procesar:", error);
        alert("Ocurrió un error al procesar tu solicitud. Intenta de nuevo.");
    }
};

// --- 4. Ejecución principal ---
document.addEventListener('DOMContentLoaded', () => {
    initCupos();

    const checkbox = document.getElementById('check-inter-terminos');
    const btnReservar = document.getElementById('btn-confirmar-reserva');
    
    if (checkbox && btnReservar) {
        checkbox.checked = false;
        btnReservar.disabled = true;
        btnReservar.classList.add("opacity-50");

        checkbox.addEventListener('change', function() {
            if (this.checked) {
                btnReservar.disabled = false;
                btnReservar.classList.remove("opacity-50"); 
            } else {
                btnReservar.disabled = true;
                btnReservar.classList.add("opacity-50");    
            }
        });
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        await verificarAdmin(user);
    } else {
        document.querySelectorAll('.admin-controls').forEach(el => el.classList.add('hidden'));
    }
});

window.cerrarModalReserva = () => {
    const checkbox = document.getElementById('check-inter-terminos'); 
    const btnReservar = document.getElementById('btn-confirmar-reserva'); 

    if (checkbox) checkbox.checked = false;   
    if (btnReservar) {
        btnReservar.disabled = true; 
        btnReservar.classList.add("opacity-50");
    }

    const modalPoliticas = document.getElementById('modal-politicas');
    if (modalPoliticas) modalPoliticas.classList.add('hidden');
};

window.abrirModalInfo = (btn) => {
    const contenedor = btn.closest('[data-id]');
    
    const precioTexto = contenedor.querySelector('.tour-precio').innerText;
    const precioUnitario = parseFloat(precioTexto.replace(/[^0-9.]/g, '')) || 0;
    
    const ocupadosTexto = contenedor.querySelector('.tour-cupos-ocupados').innerText;
    const ocupados = parseInt(ocupadosTexto) || 0;

    const totalVendido = precioUnitario * ocupados;
    const diezPorciento = totalVendido * 0.10;
    const repartoPatrocinador = diezPorciento / 5;
    
    const formato = (num) => `$${num.toLocaleString('es-MX', { minimumFractionDigits: 2 })}`;

    const mensaje = `
        <div class="text-white text-center">
            <h3 class="font-black text-xl mb-4">Desglose de Patrocinios</h3>
            <p class="text-gray-400">Cupos Ocupados: <span class="font-bold text-white">${ocupados}</span></p>
            <p class="text-gray-400">Total Acumulado: ${formato(totalVendido)}</p>
            <div class="my-4 p-3 bg-gray-700 rounded-lg">
                <p class="text-yellow-500 font-bold">Comisión Total (10%): ${formato(diezPorciento)}</p>
            </div>
            <p class="text-sm">Repartido entre 5 patrocinadores:</p>
            <p class="text-2xl font-black text-green-500 mt-1">${formato(repartoPatrocinador)} <span class="text-sm font-normal">c/u</span></p>
        </div>
    `;
    
    window.mostrarModalInfo(mensaje);
};

window.mostrarModalInfo = (contenidoHTML) => {
    const modal = document.getElementById('modal-info');
    const contenido = document.getElementById('modal-info-contenido');
    
    if (modal && contenido) {
        contenido.innerHTML = contenidoHTML;
        modal.classList.remove('hidden');
    } else {
        console.error("El contenedor del modal 'modal-info' no existe en el DOM.");
    }
};

window.cerrarModalInfo = () => {
    const modal = document.getElementById('modal-info');
    if (modal) modal.classList.add('hidden');
};

window.actualizarProgresoTours = () => {
    document.querySelectorAll('[data-id]').forEach(card => {
        const ocupadosElement = card.querySelector('.tour-cupos-ocupados');
        const totalesElement = card.querySelector('.tour-cupos-totales');
        const porcentajeElement = card.querySelector('.porcentaje-cupo');
        const barraElement = card.querySelector('.barra-progreso');

        if (ocupadosElement && totalesElement) {
            const ocupados = parseInt(ocupadosElement.innerText) || 0;
            const totales = parseInt(totalesElement.innerText) || 0;

            const porcentaje = totales > 0 ? Math.round((ocupados / totales) * 100) : 0;

            if (porcentajeElement) porcentajeElement.innerText = `${porcentaje}%`;
            if (barraElement) barraElement.style.width = `${porcentaje}%`;
        }
    });
};