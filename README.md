# 🎲 Ahorcado Pro - Full-Stack con .NET, React y Gemini AI

Este proyecto es una evolución masiva del clásico juego del Ahorcado, transformada en una aplicación web moderna de alto rendimiento. Combina un backend robusto en **ASP.NET Core** con un frontend dinámico en **React** y potencia de **Inteligencia Artificial** mediante la API de Google Gemini.

## 🚀 Novedades de la Versión Pro

*   **Inteligencia Artificial (Gemini AI):** Integración con modelos de IA para generar categorías dinámicas, palabras creativas y pistas inteligentes.
*   **Seguridad:** Implementación de autenticación basada en **JWT (JSON Web Tokens)**.
*   **UI/UX Moderna:** Interfaz reconstruida con **Tailwind CSS v4** y animaciones fluidas mediante **Framer Motion**.
*   **Arquitectura React + TypeScript:** Frontend tipado y escalable.

---

## 🏛️ Arquitectura Técnica

*   **Backend (ASP.NET Core 10):**
    *   **Gemini Integration:** Servicio para interactuar con la IA de Google.
    *   **SignalR Hub:** Comunicación en tiempo real para modos multijugador.
    *   **Hybrid Storage:** Soporte para PostgreSQL y fallback automático a base de datos en memoria.
*   **Frontend (React 19 + Vite):**
    *   **Componentes Reactivos:** Gestión de estado con Hooks y Context.
    *   **Tailwind CSS v4:** Estilos de vanguardia.
    *   **Framer Motion:** Animaciones cinematográficas.

---

## ⚙️ Instalación y Ejecución Local

### Requisitos
* .NET 10 SDK
* Node.js 20+

### Pasos

1.  **Backend:**
    ```bash
    cd backend/AhorcadoPro.Backend
    dotnet run
    ```

2.  **Frontend:**
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

---

## 📄 Licencia
Este proyecto está bajo la Licencia MIT.
