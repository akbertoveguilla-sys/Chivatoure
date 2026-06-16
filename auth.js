import { auth, db } from './firebase-config.js'; 

import { 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    createUserWithEmailAndPassword, 
    signOut, 
    sendPasswordResetEmail ,
    updateProfile
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

import { 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc,
    collection,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// --- FUNCIÓN ÚNICA DE NOTIFICACIÓN ---
window.mostrarNotificacion = (mensaje, esError = false) => {
    const toast = document.createElement('div');
    toast.className = `fixed top-5 right-5 z-[999999] px-6 py-3 rounded-xl shadow-2xl text-white font-bold transition-all duration-300 transform scale-100 ${esError ? 'bg-red-600' : 'bg-[#C4151C]'}`;
    toast.style.fontFamily = 'sans-serif';
    toast.innerText = mensaje;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 1500);
};

// 1. INICIO DE SESIÓN
function togglePassword() {
    const passInput = document.getElementById('login-pass');
    if (passInput.type === 'password') {
        passInput.type = 'text';
    } else {
        passInput.type = 'password';
    }
}

// Tu código original permanece intacto:
window.iniciarSesion = async () => {
    const email = document.getElementById('login-email').value.trim();
    const passInput = document.getElementById('login-pass');
    try {
        await signInWithEmailAndPassword(auth, email, passInput.value);
        passInput.value = '';
        window.showView('view-dashboard');
    } catch (error) {
        window.mostrarNotificacion("Correo o contraseña incorrectos.", true);
    }
};

// 2. CAMBIO DE VISTA
window.showView = (viewId) => {
    const vistas = ['view-login', 'view-register', 'view-forgot', 'view-dashboard', 'view-mis-pedidos', 'view-perfil'];
    vistas.forEach(id => {
        const el = document.getElementById(id);
        if(el) { el.classList.add('hidden'); el.classList.remove('flex'); }
    });
    const target = document.getElementById(viewId);
    if(target) { target.classList.remove('hidden'); target.classList.add('flex'); }
    
    if (viewId === 'view-mis-pedidos' && typeof window.cargarPedidos === 'function') {
        window.cargarPedidos();
    }
};

// 3. TOGGLE MODAL
window.toggleLoginModal = () => {
    const modal = document.getElementById('login-modal');
    if (modal) { modal.classList.toggle('hidden'); modal.classList.toggle('flex'); }
};

// 4. REGISTRO
window.registrarse = async () => {
    const nombre = document.getElementById('reg-nombre').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const celular = document.getElementById('reg-celular').value.trim();
    const passInput = document.getElementById('reg-pass');
    const confirmPassInput = document.getElementById('reg-pass-confirm'); // Nuevo campo

    if (nombre.length < 8) { mostrarNotificacion("⚠️ Nombre corto (min 8 car.)", true); return; }
    if (celular.length < 10) { mostrarNotificacion("⚠️ Celular inválido", true); return; }
    
    // Nueva validación
    if (passInput.value !== confirmPassInput.value) {
        mostrarNotificacion("⚠️ Las contraseñas no coinciden", true);
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, passInput.value);
        
        // --- AQUÍ ESTÁ LO NUEVO ---
        await updateProfile(userCredential.user, { displayName: nombre });
        // --------------------------

        await setDoc(doc(db, "users", userCredential.user.uid), {
            nombre, email, celular, role: "user", fechaRegistro: new Date()
        });
        await signOut(auth);
        mostrarNotificacion("✅ Cuenta creada. Inicia sesión.");
        window.showView('view-login');
        document.getElementById('reg-celular').value = '';
        document.getElementById('reg-nombre').value = '';
        document.getElementById('reg-email').value = '';
    } catch (error) { 
        // Aquí detectamos si el correo ya existe
        if (error.code === 'auth/email-already-in-use') {
            mostrarNotificacion("⚠️ Este correo ya se encuentra registrado.", true);
        } else {
            mostrarNotificacion("❌ Error: " + error.message, true);
        }
    }
    finally { 
        passInput.value = ''; 
        confirmPassInput.value = ''; // Limpiamos también el nuevo campo
    }
};


// 5. CERRAR SESIÓN
window.cerrarSesion = async () => {
    try {
        await signOut(auth);
        window.mostrarNotificacion("Sesión finalizada.");
        setTimeout(() => window.location.reload(), 900);
    } catch (error) { mostrarNotificacion("Error al cerrar sesión", true); }
};

// 6. CAMBIAR PASSWORD
window.cambiarPassword = async () => {
    if (auth.currentUser) {
        try {
            await sendPasswordResetEmail(auth, auth.currentUser.email);
            mostrarNotificacion("📧 Correo de recuperación enviado.");
        } catch (error) { mostrarNotificacion("❌ Error al enviar correo", true); }
    }
};

// 7. RECUPERAR PASS
window.recuperarPass = async (event) => {
    const emailInput = document.getElementById('forgot-email');
    const email = emailInput.value.trim().toLowerCase();
    try {
        await sendPasswordResetEmail(auth, email);
        mostrarNotificacion("✅ ¡Correo enviado!");
        window.showView('view-login');
        emailInput.value = '';
    } catch (error) { mostrarNotificacion("❌ Verifica el correo", true); }
};

// 8. CAMBIAR NOMBRE / CELULAR
window.cambiarNombre = async (event) => {
    const nuevoNombre = document.getElementById('input-nuevo-nombre').value.trim();
    if (nuevoNombre.length < 8) { mostrarNotificacion("⚠️ Mínimo 8 caracteres", true); return; }
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { nombre: nuevoNombre });
        mostrarNotificacion("✅ Nombre actualizado");
        document.querySelectorAll('.display-nombre').forEach(el => el.innerText = nuevoNombre);
        window.showView('view-dashboard');
    } catch (error) { mostrarNotificacion("❌ Error al actualizar", true); }
};

window.cambiarCelular = async (event) => {
    const nuevoCelular = document.getElementById('input-nuevo-celular').value.trim();
    if (nuevoCelular.length < 10) { mostrarNotificacion("⚠️ Celular inválido", true); return; }
    try {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { celular: nuevoCelular });
        mostrarNotificacion("✅ Número actualizado");
        document.querySelectorAll('.display-celular').forEach(el => el.innerText = nuevoCelular);
        window.showView('view-dashboard');
    } catch (error) { mostrarNotificacion("❌ Error al actualizar", true); }
};

// 9. ABRIR CORREO
window.abrirCorreo = () => {
    navigator.clipboard.writeText("linearojiblanca@gmail.com").then(() => {
        mostrarNotificacion("Correo copiado al portapapeles");
    });
};

// --- CARGAR PEDIDOS SIN REQUERIR ÍNDICES COMPUESTOS ---
window.cargarPedidos = async () => {
    // Vinculado al id="contenedor-pedidos" de tu HTML
    const contenedorPedidos = document.getElementById('contenedor-pedidos');
    if (!contenedorPedidos) return;

    if (!auth.currentUser) {
        contenedorPedidos.innerHTML = `
            <div class="text-center py-12">
                <p class="text-gray-400">Inicia sesión para ver tu historial de viajes y boletos.</p>
            </div>
        `;
        return;
    }

    contenedorPedidos.innerHTML = `
        <div class="text-white text-center py-8">
            <i class="fa-solid fa-spinner animate-spin text-xl mb-2 text-[#C4151C]"></i>
            <p class="text-xs">Cargando tus Chivatours...</p>
        </div>
    `;
    console.log("[Pedidos] Solicitando viajes para el UID:", auth.currentUser.uid);

    try {
        // Consulta base filtrada por el usuario
        const q = query(
            collection(db, "pedidos"),
            where("userId", "==", auth.currentUser.uid)
        );

        const querySnapshot = await getDocs(q);
        console.log("[Pedidos] Respuesta recibida de Firestore. Documentos totales encontrados:", querySnapshot.size);

        if (querySnapshot.empty) {
            contenedorPedidos.innerHTML = `
                <div class="text-center py-12 border border-dashed border-gray-700 rounded-3xl bg-gray-800/20">
                    <p class="text-gray-400">Aún no tienes ningún viaje reservado. ¡Elige tu próximo partido!</p>
                </div>
            `;
            return;
        }

        const listaPedidos = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            
            // FILTRO ESTRICTO: 
            // 1. Debe ser obligatoriamente tu UID.
            // 2. Debe poseer un estatus real de confirmation (evita basura o clicks cancelados en la base de datos).
            const estatusValidos = ["Pendiente Pago", "Pagado", "Confirmado"];
            
            if (data.userId === auth.currentUser.uid && estatusValidos.includes(data.estatus)) {
                listaPedidos.push({ id: docSnap.id, ...data });
            }
        });

        // Si después de limpiar los borradores o pruebas la lista queda vacía
        if (listaPedidos.length === 0) {
            contenedorPedidos.innerHTML = `
                <div class="text-center py-12 border border-dashed border-gray-700 rounded-3xl bg-gray-800/20">
                    <p class="text-gray-400">No tienes pedidos confirmados bajo esta cuenta. ¡Elige tu próximo partido!</p>
                </div>
            `;
            return;
        }

        // Ordenamos por fecha de compra/creación descendente (Los más recientes primero)
        listaPedidos.sort((a, b) => {
            const fechaA = a.fechaCompra || a.fechaCreacion || 0;
            const fechaB = b.fechaCompra || b.fechaCreacion || 0;
            
            const tiempoA = fechaA.seconds ? fechaA.seconds * 1000 : new Date(fechaA).getTime();
            const tiempoB = fechaB.seconds ? fechaB.seconds * 1000 : new Date(fechaB).getTime();
            return tiempoB - tiempoA;
        });

        let htmlContenido = "";

        listaPedidos.forEach((pedido) => {
            let colorEstatus = "bg-yellow-900/50 text-yellow-400 border-yellow-600";
            if (pedido.estatus === "Pagado" || pedido.estatus === "Confirmado") {
                colorEstatus = "bg-green-900/50 text-green-400 border-green-600";
            }

            // Mapeo seguro e inteligente de los campos que vengan de app.js
            const nombreTour = pedido.partido || pedido.nombreTour || 'Chivatour';
            const fechaTour = pedido.fechaPartido || pedido.fechaTour || 'No especificada';
            const precioTotal = pedido.total || pedido.precioTotal || 'N/A';
            const montoApartado = pedido.montoApartado || 'Pendiente';

            htmlContenido += `
                <div class="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 transition hover:border-red-600/50 w-full">
                    <div>
                        <div class="flex items-center gap-3">
                            <h4 class="text-xl font-black text-white">${nombreTour}</h4>
                            <span class="text-xs font-bold px-2.5 py-1 rounded-full border ${colorEstatus}">
                                ${pedido.estatus || 'Pendiente'}
                            </span>
                        </div>
                        <p class="text-gray-400 text-sm mt-1">🗓️ Fecha de viaje: <span class="text-gray-200 font-semibold">${fechaTour}</span></p>
                        <p class="text-gray-500 text-xs mt-1">ID Reserva: ${pedido.id}</p>
                    </div>
                    
                    <div class="text-left md:text-right w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0 border-gray-700">
                        <p class="text-xs text-gray-400">Total: <span class="text-sm font-bold text-white">${precioTotal}</span></p>
                        <p class="text-sm text-red-400 font-bold mt-1">Apartado con: ${montoApartado}</p>
                    </div>
                </div>
            `;
        });

        contenedorPedidos.innerHTML = htmlContenido;

    } catch (error) {
        console.error("[Pedidos] Error crítico al obtener Firestore:", error);
        contenedorPedidos.innerHTML = `
            <div class="text-center py-6 text-red-500">
                ⚠️ Error al cargar los datos: ${error.message}. Revisa la consola para más detalles.
            </div>
        `;
    }
};



// 10. ESTADO DE SESIÓN
onAuthStateChanged(auth, async (user) => {
    const btn = document.getElementById('auth-btn');
    const btnNotas = document.getElementById('btn-notas');

    if (user) {
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-user"></i> <span class="hidden sm:inline display-nombre">Mi Cuenta</span>';
            btn.onclick = () => { window.toggleLoginModal(); window.showView('view-dashboard'); };
        }
        try {
            const docSnap = await getDoc(doc(db, "users", user.uid));
            if (docSnap.exists()) {
                const data = docSnap.data();
                document.querySelectorAll('.display-nombre').forEach(el => el.innerText = data.nombre);
                document.querySelectorAll('.display-celular').forEach(el => el.innerText = data.celular || "No disponible");
                
                // --- AJUSTE NUEVO: Muestra o esconde el botón según el rol del usuario ---
                if (btnNotas) {
                    if (data.role === 'admin') {
                        btnNotas.classList.remove('hidden');
                    } else {
                        btnNotas.classList.add('hidden');
                    }
                }
            }
        } catch (e) { console.error(e); }
        if (typeof window.cargarPedidos === 'function') window.cargarPedidos();
    } else {
        // --- AJUSTE NUEVO: Si no hay sesión iniciada, asegura que el botón esté oculto ---
        if (btnNotas) {
            btnNotas.classList.add('hidden');
        }

        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-user"></i> <span class="hidden sm:inline">Ingresar</span>';
            btn.onclick = () => window.toggleLoginModal();
        }
    }

};


document.addEventListener("DOMContentLoaded", () => {
    // Inicializa el grid de notas al cargar el sitio
    inicializarPanelNotas();
});

function inicializarPanelNotas() {
    const gridContenedor = document.getElementById('notes-grid');
    if (!gridContenedor) return;

    gridContenedor.innerHTML = ''; // Limpiar contenedor

    // Bucle para construir los 9 bloques de notas independientes
    for (let i = 1; i <= 9; i++) {
        // Recuperar información previa guardada en el navegador
        const tituloGuardado = localStorage.getItem(`chiva-nota-titulo-${i}`) || `Bloque de Nota #${i}`;
        const contenidoGuardado = localStorage.getItem(`chiva-nota-txt-${i}`) || '';

        const tarjetaNota = document.createElement('div');
        tarjetaNota.className = "bg-gray-950/60 p-4 rounded-xl border border-gray-800/80 flex flex-col gap-3 transition-all duration-300 hover:border-red-600/50 shadow-md card-hover group";
        
        tarjetaNota.innerHTML = `
            <div class="flex justify-between items-center border-b border-gray-800 pb-2">
                <input type="text" id="input-titulo-${i}" value="${tituloGuardado}" 
                    class="bg-transparent font-medium text-red-400 focus:outline-none border-b border-transparent focus:border-red-500 w-4/5 text-sm transition-colors"
                    placeholder="Título de la nota" onchange="guardarNotaEspecifica(${i})">
                <span class="text-[10px] text-gray-600 font-mono bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">Nota ${i}</span>
            </div>
            
            <textarea id="txt-contenido-${i}" rows="6" 
                class="w-full bg-gray-900/50 text-gray-300 p-3 rounded-lg border border-gray-800 focus:outline-none focus:border-red-600/70 resize-none text-xs leading-relaxed font-sans placeholder-gray-600 transition-colors"
                placeholder="Escribe tus apuntes, pendientes o recordatorios aquí..."
                oninput="actualizarIndicadorGuardado(${i})">${contenidoGuardado}</textarea>
            
            <div class="flex justify-between items-center mt-1">
                <span id="status-${i}" class="text-[10px] text-gray-500 italic flex items-center gap-1">
                    <i class="fa-solid fa-check text-gray-600"></i> Sin cambios
                </span>
                <button onclick="guardarNotaEspecifica(${i})" 
                    class="bg-gray-800 hover:bg-red-600 hover:text-white text-gray-400 px-2.5 py-1 rounded-md transition-all duration-200 text-[11px] flex items-center gap-1">
                    <i class="fa-solid fa-floppy-disk"></i> Guardar
                </button>
            </div>
        `;
        gridContenedor.appendChild(tarjetaNota);
    }
}

// Guarda una nota individual
function guardarNotaEspecifica(id) {
    const titulo = document.getElementById(`input-titulo-${id}`).value;
    const contenido = document.getElementById(`txt-contenido-${id}`).value;

    localStorage.setItem(`chiva-nota-titulo-${id}`, titulo);
    localStorage.setItem(`chiva-nota-txt-${id}`, contenido);

    const statusElement = document.getElementById(`status-${id}`);
    statusElement.innerHTML = `<i class="fa-solid fa-circle-check text-green-500"></i> ¡Guardado!`;
    statusElement.classList.replace('text-gray-500', 'text-green-400');

    setTimeout(() => {
        statusElement.innerHTML = `<i class="fa-solid fa-check text-gray-600"></i> Guardado`;
        statusElement.classList.replace('text-green-400', 'text-gray-500');
    }, 2000);
}

// Función para el botón general que guarda los 9 bloques al mismo tiempo
function guardarTodasLasNotas() {
    for (let i = 1; i <= 9; i++) {
        guardarNotaEspecifica(i);
    }
    // Lanza notificación global (Aprovechando tus clases CSS para Toasts)
    mostrarAvisoGlobal("Las 9 notas se guardaron correctamente");
}

function actualizarIndicadorGuardado(id) {
    const statusElement = document.getElementById(`status-${id}`);
    statusElement.innerHTML = `<i class="fa-solid fa-pen text-amber-500"></i> Modificando...`;
    statusElement.classList.replace('text-gray-500', 'text-amber-400');
}

// Alerta flotante basada en tu estilo de animación '.animate-toast'
function mostrarAvisoGlobal(texto) {
    const toast = document.createElement('div');
    toast.className = "fixed bottom-5 right-5 bg-gradient-to-r from-green-600 to-emerald-700 text-white px-4 py-2.5 rounded-xl shadow-2xl z-50 flex items-center gap-2 text-xs font-semibold animate-toast border border-green-500/30";
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-base"></i> ${texto}`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
}
    
});
