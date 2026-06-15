import { auth, db } from './firebase-config.js';
import { 
    doc, 
    updateDoc, 
    setDoc,
    getDocs, 
    collection,
    onSnapshot,
    addDoc
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

// Genera el calendario dinámico lateral
const generarCalendarioCompleto = () => {
    const grid = document.getElementById('calendario-grid');
    const titulo = document.getElementById('mes-titulo');
    if (!grid) return;

    grid.innerHTML = "";
    
    const fechaActual = new Date();
    const mes = fechaActual.getMonth();
    const anio = fechaActual.getFullYear();
    
    // Título del mes
    titulo.innerText = fechaActual.toLocaleString('es-ES', { month: 'long', year: 'numeric' });

    // Días en el mes
    const primerDia = new Date(anio, mes, 1).getDay(); // Día de la semana en que inicia
    const totalDias = new Date(anio, mes + 1, 0).getDate(); // Cuántos días tiene el mes

    // Crear espacios vacíos previos al inicio del mes
    // (Ajuste para que el calendario empiece en Lunes: (primerDia === 0 ? 6 : primerDia - 1))
    const espacios = (primerDia === 0 ? 6 : primerDia - 1);
    for (let i = 0; i < espacios; i++) {
        grid.appendChild(document.createElement('div'));
    }

    // Obtener días con partidos desde tus tarjetas
    const tarjetas = document.querySelectorAll('.card-hover');
    const diasConPartido = [];
    tarjetas.forEach(card => {
        const fechaTexto = card.querySelector('.tour-fecha-partido')?.innerText || "";
        const diaNum = parseInt(fechaTexto.match(/\d+/)); // Extrae el número del texto
        if (diaNum) diasConPartido.push({ dia: diaNum, id: card.id });
    });

    // Dibujar los días del mes
    for (let i = 1; i <= totalDias; i++) {
        const div = document.createElement('div');
        div.className = "aspect-square flex items-center justify-center text-xs rounded-full cursor-pointer transition-all";
        div.innerText = i;

        // Verificar si este día tiene partido
        const partido = diasConPartido.find(p => p.dia === i);
        
        if (partido) {
            div.classList.add("bg-[#C4151C]", "text-white", "font-bold", "shadow-lg");
            div.onclick = () => {
                const el = document.getElementById(partido.id);
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                el.classList.add('ring-2', 'ring-yellow-500');
                setTimeout(() => el.classList.remove('ring-2', 'ring-yellow-500'), 1500);
            };
        } else {
            div.classList.add("text-gray-600");
        }

        grid.appendChild(div);
    }
};

// --- 3. Funciones de Reserva y Administración ---

window.cerrarModal = () => {
    const modal = document.getElementById('modal-informacion');
    if (modal) modal.classList.add('hidden');
};

window.reservarTour = (nombre, fecha, precio, urlPago) => {
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

    datosReservaPendiente = { nombre, fecha, precio, urlPago };
    const modal = document.getElementById('modal-informacion');
    if (modal) modal.classList.remove('hidden');
};

window.prepararReserva = (boton) => {
    const card = boton.closest('.card-hover');
    const nombre = card.querySelector('.tour-titulo').innerText;
    const fecha = card.querySelector('.tour-fecha-partido').innerText;
    const precio = card.querySelector('.tour-precio').innerText;
    const urlPago = boton.getAttribute('data-url');
    window.reservarTour(nombre, fecha, precio, urlPago);
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
    capturar('.input-totales', 'cupo_total');

    if (Object.keys(datosActualizar).length === 0) {
        window.mostrarNotificacion("No hay datos nuevos para guardar.", true);
        return;
    }

    try {
        await setDoc(doc(db, "partidos", docId), datosActualizar, { merge: true });
        
        // --- AQUÍ ESTÁ LO NUEVO PARA QUE SE VEA EN LA WEB ---
        if (datosActualizar.aparta) card.querySelector('.tour-aparta').textContent = datosActualizar.aparta;
        if (datosActualizar.precio) card.querySelector('.tour-precio').textContent = datosActualizar.precio;
        if (datosActualizar.titulo) card.querySelector('.tour-titulo').textContent = datosActualizar.titulo;
        if (datosActualizar.fecha_partido) card.querySelector('.tour-fecha-partido').textContent = datosActualizar.fecha_partido;
        if (datosActualizar.fecha_salida) card.querySelector('.tour-fecha-salida').textContent = datosActualizar.fecha_salida;
        if (datosActualizar.cupo_disponible) card.querySelector('.tour-cupos-ocupados').textContent = datosActualizar.cupo_disponible;
        if (datosActualizar.cupo_total) card.querySelector('.tour-cupos-totales').textContent = datosActualizar.cupo_total;
        // ----------------------------------------------------

        window.mostrarNotificacion("Cambios guardados correctamente.");
        btn.classList.add('bg-green-600');
    } catch (error) {
        window.mostrarNotificacion("Error: " + error.message, true);
    }
};

window.addEventListener('DOMContentLoaded', async () => {
    // 1. Buscamos el documento en Firebase
    const docRef = doc(db, "partidos", "tour_toluca");
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
        const data = docSnap.data();
        const card = document.getElementById('partido-toluca');

        // 2. Si el dato existe en la base, lo inyectamos en el HTML
        if (data.titulo) card.querySelector('.tour-titulo').textContent = data.titulo;
        if (data.precio) card.querySelector('.tour-precio').textContent = data.precio;
        if (data.aparta) card.querySelector('.tour-aparta').textContent = data.aparta;
        if (data.fecha_partido) card.querySelector('.tour-fecha-partido').textContent = data.fecha_partido;
        if (data.fecha_salida) card.querySelector('.tour-fecha-salida').textContent = data.fecha_salida;
        if (data.cupo_disponible) card.querySelector('.tour-cupos-ocupados').textContent = data.cupo_disponible;
        if (data.cupo_total) card.querySelector('.tour-cupos-totales').textContent = data.cupo_total;
    }
});

// --- 4. Firebase y Inicialización ---

const initPartidos = () => {
    onSnapshot(collection(db, "partidos"), (snapshot) => {
        snapshot.forEach((docSnap) => {
            const card = document.querySelector(`[data-id="${docSnap.id}"]`);
            if (card) {
                actualizarTarjetaUI(card, docSnap.data());
            }
        });
        // Actualizamos calendario cada vez que cambian los datos
        generarCalendarioCompleto();
    });
};

document.addEventListener("DOMContentLoaded", () => {
    // 1. Iniciar conexión Firebase
    initPartidos();
    
    // 2. Configurar botón confirmar
    const btnConfirmar = document.getElementById('btn-confirmar');
    const checkbox = document.getElementById('check-terminos');

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

                await addDoc(collection(db, "pedidos"), {
                    userId: auth.currentUser.uid,
                    userEmail: auth.currentUser.email,
                    partido: datosReservaPendiente.nombre,
                    fechaPartido: datosReservaPendiente.fecha,
                    total: parseFloat(String(datosReservaPendiente.precio).replace(/[^0-9.]/g, '')) || 0,
                    fechaCompra: new Date().toISOString(),
                    estatus: "Pendiente WhatsApp"
                });

                const numeroWhatsApp = "5215518102711";
                const mensaje = `¡Hola! Me gustaría apartar mi lugar para: ${datosReservaPendiente.nombre}.\n\n` +
                                `Datos:\n- Partido: ${datosReservaPendiente.nombre}\n` +
                                `- Fecha: ${datosReservaPendiente.fecha}\n` +
                                `¿Me podrías dar información para realizar el pago?`;

                window.open(`https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(mensaje)}`, '_blank');
                window.cerrarModal();
                window.mostrarNotificacion("Redirigiendo a WhatsApp...");

            } catch (error) {
                console.error("Error:", error);
                window.mostrarNotificacion("Ocurrió un error al procesar tu reserva.", true);
            } finally {
                btnConfirmar.disabled = false;
                btnConfirmar.innerText = "Confirmar y Pagar";
            }
        });
    }
});
