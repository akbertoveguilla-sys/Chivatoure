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

// --- 3. Funciones de Reserva y Administración ---

window.cerrarModal = () => {
    const modal = document.getElementById('modal-informacion');
    if (modal) modal.classList.add('hidden');
};

// MODIFICADO: Ahora recibe el parámetro 'aparta'
window.reservarTour = (id, nombre, fecha, precio, urlPago, aparta) => { 
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

    // MODIFICADO: Guardamos 'aparta' dentro del estado global
    datosReservaPendiente = { id, nombre, fecha, precio, urlPago, aparta }; 

    const selectLugares = document.getElementById('select-lugares');
    const totalPagoTxt = document.getElementById('modal-total-pago');
    if (selectLugares) selectLugares.value = "1";
    
    // MODIFICADO: El modal ahora arranca mostrando el precio de apartado
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
    // Validar cupos antes de abrir el modal
    const ocupados = parseInt(card.querySelector('.tour-cupos-ocupados').innerText) || 0;
    const totales = parseInt(card.querySelector('.tour-cupos-totales').innerText) || 0;

    if (ocupados >= totales) {
        window.mostrarNotificacion("¡Tour agotado! No hay cupos disponibles.", true);
        return;
    }

    const id = card.getAttribute('data-id'); 
    const nombre = card.querySelector('.tour-titulo').innerText;
    const fecha = card.querySelector('.tour-fecha-partido').innerText;
    const precio = card.querySelector('.tour-precio').innerText;
    const aparta = card.querySelector('.tour-aparta').innerText;
    const urlPago = boton.getAttribute('data-url'); 
    
    window.reservarTour(id, nombre, fecha, precio, urlPago, aparta); 
};

window.guardarCambiosTour = async function(btn) {
    const card = btn.closest('.card-hover');
    if (!card) return;
    const docId = card.getAttribute('data-id');
    let datosActualizar = {};
    
    const capturar = (selector, campoBD) => {
        const input = card.querySelector(selector);
        if (input && input.value.trim() !== "") {
            // Se convierte a número si el campo es de cupos para no romper el consecutivo de Firestore
            if (campoBD === 'cupo_disponible' || campoBD === 'cupo_total') {
                datosActualizar[campoBD] = Number(input.value) || 0;
            } else {
                datosActualizar[campoBD] = input.value;
            }
            input.value = ""; 
        }
    };
    
    capturar('.input-titulo', 'titulo');
    capturar('.input-precio', 'precio');
    capturar('.input-aparta', 'aparta'); 
    capturar('.input-fecha-partido', 'fecha_partido');
    capturar('.input-fecha-salida', 'fecha_salida');
    capturar('.input-puntos', 'puntos_salida');
    capturar('.input-ocupados', 'cupo_disponible');
    // CORRECCIÓN: Cambiado 'cupo_totales' por 'cupo_total'
    capturar('.input-totales', 'cupo_total');

    if (Object.keys(datosActualizar).length === 0) {
        window.mostrarNotificacion("No hay datos nuevos para guardar.", true);
        return;
    }

    try {
        await setDoc(doc(db, "partidos", docId), datosActualizar, { merge: true });
        
        if (datosActualizar.aparta) card.querySelector('.tour-aparta').textContent = datosActualizar.aparta;
        if (datosActualizar.precio) card.querySelector('.tour-precio').textContent = datosActualizar.precio;
        if (datosActualizar.titulo) card.querySelector('.tour-titulo').textContent = datosActualizar.titulo;
        if (datosActualizar.fecha_partido) card.querySelector('.tour-fecha-partido').textContent = datosActualizar.fecha_partido;
        if (datosActualizar.fecha_salida) card.querySelector('.tour-fecha-salida').textContent = datosActualizar.fecha_salida;
        
        // CORRECCIÓN: Se evalúa con !== undefined para permitir que el número 0 actualice la interfaz
        if (datosActualizar.cupo_disponible !== undefined) card.querySelector('.tour-cupos-ocupados').textContent = datosActualizar.cupo_disponible;
        if (datosActualizar.cupo_total !== undefined) card.querySelector('.tour-cupos-totales').textContent = datosActualizar.cupo_total;

        window.mostrarNotificacion("Cambios guardados correctamente.");
        btn.classList.add('bg-green-600');
    } catch (error) {
        window.mostrarNotificacion("Error: " + error.message, true);
    }
};



// --- 4. Firebase y Inicialización ---

const initPartidos = () => {
    onSnapshot(collection(db, "partidos"), (snapshot) => {
        snapshot.forEach((docSnap) => {
            const card = document.querySelector(`[data-id="${docSnap.id}"]`);
            if (card) {
                actualizarTarjetaUI(card, docSnap.data());
            }
        });
    });
};

document.addEventListener("DOMContentLoaded", () => {
    initPartidos();
    
    // --- NUEVO: Detección de retorno de Mercado Pago ---
    const params = new URLSearchParams(window.location.search);
    if (params.get('pago') === 'exitoso') {
        const modalInst = document.getElementById('modal-instrucciones');
        if (modalInst) {
            modalInst.classList.remove('hidden');
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    const btnConfirmar = document.getElementById('btn-confirmar');
    const checkbox = document.getElementById('check-terminos');
    const selectLugares = document.getElementById('select-lugares'); 
    const totalPagoTxt = document.getElementById('modal-total-pago'); 

    // --- Multiplicar el total en la interfaz del modal al cambiar cantidad de lugares ---
    if (selectLugares && totalPagoTxt) {
        selectLugares.addEventListener('change', () => {
            if (!datosReservaPendiente) return;
            const precioUnitario = parseFloat(String(datosReservaPendiente.aparta).replace(/[^0-9.]/g, '')) || 0;
            const cantidad = parseInt(selectLugares.value) || 1;
            const totalCalculado = precioUnitario * cantidad;
            totalPagoTxt.innerText = `$${totalCalculado.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        });
    }

    if (btnConfirmar && checkbox) {
        checkbox.addEventListener('change', (e) => {
            btnConfirmar.disabled = !e.target.checked;
            btnConfirmar.classList.toggle("opacity-50", !e.target.checked);
        });

        btnConfirmar.addEventListener('click', async () => {
            if (!datosReservaPendiente) return;

            try {
                btnConfirmar.disabled = true;
                btnConfirmar.innerText = "Procesando...";

                const cantidadLugares = selectLugares ? parseInt(selectLugares.value) : 1;
                const precioUnitario = parseFloat(String(datosReservaPendiente.aparta).replace(/[^0-9.]/g, '')) || 0;
                const totalFinal = precioUnitario * cantidadLugares;

                await addDoc(collection(db, "pedidos"), {
                    userId: auth.currentUser.uid,
                    userEmail: auth.currentUser.email,
                    partido: datosReservaPendiente.nombre,
                    fechapartido: datosReservaPendiente.fecha,
                    lugaresReservados: cantidadLugares, 
                    total: totalFinal,
                    fechaCompra: new Date().toISOString(),
                    estatus: "Pendiente Pago"
                });

                if (datosReservaPendiente.id) {
                    const partidoRef = doc(db, "partidos", datosReservaPendiente.id);
                    try {
                        await updateDoc(partidoRef, { cupo_disponible: increment(cantidadLugares) });
                    } catch (error) {
                        if (error.code === 'not-found') {
                            await setDoc(partidoRef, { cupo_disponible: cantidadLugares }, { merge: true });
                        } else {
                            throw error;
                        }
                    }
                }

                if (datosReservaPendiente.urlPago && datosReservaPendiente.urlPago.trim() !== "") {
                    // --- NUEVO: Construcción de URL con retorno automático ---
                    const urlBase = datosReservaPendiente.urlPago;
                    const separador = urlBase.includes('?') ? '&' : '?';
                    const urlConRetorno = `${urlBase}${separador}back_urls[success]=${window.location.origin}/?pago=exitoso`;
                    
                    window.open(urlConRetorno, '_self');
                    window.cerrarModal();
                } else {
                    window.mostrarNotificacion("Error: Este tour no tiene un enlace de pago configurado.", true);
                }

            } catch (error) {
                console.error("Error al procesar reserva:", error);
                window.mostrarNotificacion("Ocurrió un error al procesar tu reserva.", true);
            } finally {
                btnConfirmar.disabled = false;
                btnConfirmar.innerText = "Confirmar y Pagar";
            }
        });
    }
});


