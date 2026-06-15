# Ayuda a Diego: Aprendiendo con IA

Plataforma educativa de adivinanza de palabras desarrollada como proyecto final para la materia **Tecnologías Educativas**. Transforma el clásico juego del ahorcado en una experiencia de aprendizaje interactiva con IA generativa, modos multijugador en tiempo real y herramientas para el docente.

---

## Características principales

- **Plataforma educativa**: dos perfiles de usuario — Primaria (5°–7° grado) y Adultos Mayores
- **Alegoría visual**: progresión por fases ilustradas (castillo, nene y dragón) — sin imágenes de violencia
- **IA generativa**: pistas y definiciones automáticas via Groq (modelo llama)
- **Salas del docente**: el profesor crea una lista de palabras propias y comparte un código de 6 caracteres
  - **Modo Tarea**: cada alumno juega su propia sesión independiente desde casa
  - **Clase en vivo**: el docente juega proyectado, la clase dicta las letras
- **Modos de juego**: Solitario, Local Versus, Online Coop, Online Versus
- **Tiempo real**: comunicación via SignalR (WebSockets)
- **Daily Challenge**: palabra diaria compartida con sistema de compartir resultado

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Backend | ASP.NET Core 10, C# |
| Tiempo real | SignalR |
| Frontend | React 19, TypeScript, Vite |
| Estilos | Tailwind CSS v4, Framer Motion |
| IA | Groq API (llama) |
| Base de datos | Supabase (PostgreSQL) / InMemory (dev) |
| Auth | JWT + Supabase Auth |

---

## Instalación local

### Requisitos

- .NET 10 SDK
- Node.js 20+
- (Opcional) Cuenta Supabase y clave de Groq para IA y persistencia

### Backend

```powershell
cd backend\AhorcadoPro.Backend
dotnet run
```

El backend corre en `http://localhost:5000`. Si `ConnectionStrings:Default` apunta a localhost o está vacío, usa base de datos en memoria automáticamente.

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

El frontend corre en `http://localhost:5173`.

### Variables de entorno

Crear `frontend/.env`:
```
VITE_API_URL=http://localhost:5000/api
VITE_HUB_URL=http://localhost:5000/hubs/game
```

Configurar `backend/AhorcadoPro.Backend/appsettings.json` (no commitear):
```json
{
  "ConnectionStrings": {
    "Default": "Host=...;Database=postgres;Username=...;Password=...;SSL Mode=Require"
  },
  "Groq": {
    "ApiKey": "TU_CLAVE_GROQ"
  },
  "Jwt": {
    "Key": "clave-segura-de-produccion"
  }
}
```

### Tests

```powershell
dotnet test backend\AhorcadoPro.Tests
```

---

## Licencia

MIT
