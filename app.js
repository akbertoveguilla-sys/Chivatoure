import { auth, db } from './firebase-config.js';
import { 
    doc, 
    updateDoc, 
    setDoc,
    getDocs, 
    collection,
    onSnapshot,
    addDoc,
    increment // <--- NUEVO: Importado para actualizar la barra de progreso de forma segura
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- 1. Estado Global ---
let datosReservaPendiente = null;

// --- 2. Funciones de Interfaz (UI) ---

// Actualiza los textos de una tarjeta específica cuando llegan datos de Firebase
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
    
    // Actualizar barra de progreso
    const bar = card.querySelector('.tour-progress-bar');
    const txt = card.querySelector('.tour-porcentaje-texto');
    if (bar && txt) {
        const ocupados = Number(data.cupo_disponible) || 0;
        const total = Number(data.cupo_total) || 1;
        const porcentaje = Math.min(Math.round((ocupados / total) * 100), 100);
        bar.style.width = `${porcentaje}%`;
        txt.innerText = `${porcentaje}%`;
    }
}

// --- 3. Funciones de Reserva y Administración ---

window.cerrarModal = () => {
    const modal = document.getElementById('modal-informacion');
    if (modal) modal.classList.add('hidden');
};

window.reservarTour = (id, nombre, fecha, precio, urlPago) => { // <--- MODIFICADO: Ahora recibe el id del partido
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

    datosReservaPendiente = { id, nombre, fecha, precio, urlPago }; // <--- Guardamos el id en el estado global

    // --- NUEVO: Resetear el selector a 1 lugar y poner el precio base al abrir el modal ---
    const selectLugares = document.getElementById('select-lugares');
    const totalPagoTxt = document.getElementById('modal-total-pago');
    if (selectLugares) selectLugares.value = "1";
    if (totalPagoTxt) totalPagoTxt.innerText = precio;

    const modal = document.getElementById('modal-informacion');
    if (modal) modal.classList.remove('hidden');
};

window.prepararReserva = (boton) => {
    const card = boton.closest('.card-hover');
    const id = card.getAttribute('data-id'); // <--- NUEVO: Captura el ID único del partido
    const nombre = card.querySelector('.tour-titulo').innerText;
    const fecha = card.querySelector('.tour-fecha-partido').innerText;
    const precio = card.querySelector('.tour-precio').innerText;
    const urlPago = boton.getAttribute('data-url'); // <--- Aquí captura el link de Mercado Pago
    window.reservarTour(id, nombre, fecha, precio, urlPago); // <--- Enviamos el id
};

window.guardarCambiosTour = async function(btn) {
    const card = btn.closest('.card-hover');
    if (!card) return;
    const docId = card.getAttribute('data-id');
    let datosActualizar = {};
    
    const capturar = (selector, campoBD) => {
        const input = card.querySelector(selector);
        if (input && input.value.trim() !== "") {
            datosActualizar[campoBD] = input.value;
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
    capturar('.input-totales', 'cupo_totales');

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
        if (datosActualizar.cupo_disponible) card.querySelector('.tour-cupos-ocupados').textContent = datosActualizar.cupo_disponible;
        if (datosActualizar.cupo_total) card.querySelector('.tour-cupos-totales').textContent = datosActualizar.cupo_total;

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
    
    const btnConfirmar = document.getElementById('btn-confirmar');
    const checkbox = document.getElementById('check-terminos');
    const selectLugares = document.getElementById('select-lugares'); // <--- NUEVO
    const totalPagoTxt = document.getElementById('modal-total-pago'); // <--- NUEVO

    // --- NUEVO: Multiplicar el total en la interfaz del modal al cambiar cantidad de lugares ---
    if (selectLugares && totalPagoTxt) {
        selectLugares.addEventListener('change', () => {
            if (!datosReservaPendiente) return;
            // MODIFICADO: Ahora toma el valor de 'apartar' en lugar de 'precio'
            const precioUnitario = parseFloat(String(datosReservaPendiente.apartar).replace(/[^0-9.]/g, '')) || 0;
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

                // --- NUEVO: Calcular los lugares y el total final multiplicado ---
                const cantidadLugares = selectLugares ? parseInt(selectLugares.value) : 1;
                // MODIFICADO: Ahora toma el valor de 'apartar' en lugar de 'precio'
                const precioUnitario = parseFloat(String(datosReservaPendiente.apartar).replace(/[^0-9.]/g, '')) || 0;
                const totalFinal = precioUnitario * cantidadLugares;

                // Se sigue guardando el registro en Firebase con estatus "Pendiente Pago"
                await addDoc(collection(db, "pedidos"), {
                    userId: auth.currentUser.uid,
                    userEmail: auth.currentUser.email,
                    partido: datosReservaPendiente.nombre,
                    fechaPartido: datosReservaPendiente.fecha,
                    lugaresReservados: cantidadLugares, // <--- NUEVO: Guarda cuántos compró
                    total: totalFinal, // <--- MODIFICADO: Guarda el total real multiplicado
                    fechaCompra: new Date().toISOString(),
                    estatus: "Pendiente Pago"
                });

                // --- NUEVO: Actualizar de forma atómica los cupos del partido en Firebase ---
                if (datosReservaPendiente.id) {
                    const partidoRef = doc(db, "partidos", datosReservaPendiente.id);
                    await updateDoc(partidoRef, {
                        cupo_disponible: increment(cantidadLugares)
                    });
                }

                // --- NUEVO: Redirección final al link de Mercado Pago ---
                if (datosReservaPendiente.urlPago && datosReservaPendiente.urlPago.trim() !== "") {
                    window.open(datosReservaPendiente.urlPago, '_blank');
                    window.cerrarModal();
                    window.mostrarNotificacion("Redirigiendo a Mercado Pago...");
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
