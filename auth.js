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
    updateDoc 
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

// 10. ESTADO DE SESIÓN
onAuthStateChanged(auth, async (user) => {
    const btn = document.getElementById('auth-btn');
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
            }
        } catch (e) { console.error(e); }
        if (typeof window.cargarPedidos === 'function') window.cargarPedidos();
    } else if (btn) {
        btn.innerHTML = '<i class="fa-solid fa-user"></i> <span class="hidden sm:inline">Ingresar</span>';
        btn.onclick = () => window.toggleLoginModal();
    }
});
