// js/api.js - Centralizador de datos
const API = {
    guardar: (key, data) => {
        localStorage.setItem(key, JSON.stringify(data));
        console.log(`Guardado en local: ${key}`);
    },
    obtener: (key) => {
        return JSON.parse(localStorage.getItem(key)) || [];
    },
    eliminar: (key) => {
        localStorage.removeItem(key);
        console.log(`Eliminado de local: ${key}`);
    }
};
