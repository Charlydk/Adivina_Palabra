# Documentación Técnica - Ahorcado Pro

## Introducción
Ahorcado Pro es una plataforma de juego distribuida que utiliza tecnologías de vanguardia para ofrecer una experiencia de usuario superior y capacidades de IA generativa.

## Componentes del Sistema

### 1. Backend (ASP.NET Core 10)
- **GameManager.cs**: Cerebro de la aplicación. Gestiona el estado de todas las partidas activas, la validación de letras y la lógica de victoria/derrota.
- **GeminiService.cs**: Se comunica con la API de Google Gemini para obtener palabras temáticas y pistas inteligentes.
- **GameHub.cs**: Implementa SignalR para permitir que múltiples jugadores se unan a la misma partida y vean cambios instantáneamente.
- **CleanupService.cs**: Servicio en segundo plano que libera memoria eliminando partidas inactivas.

### 2. Frontend (React 19)
- **LivingHangman.tsx**: Componente SVG animado con Framer Motion que reacciona visualmente al estado del juego.
- **useGame.ts**: Hook personalizado que encapsula la lógica de conexión a SignalR y las llamadas a la API.
- **Tailwind v4**: Utiliza las nuevas capacidades de motor de Tailwind para una UI oscura con acentos "Halloween".

## Flujo de Juego
1. El usuario ingresa su alias.
2. Selecciona un modo (Solitario, Coop, Versus).
3. El servidor solicita una palabra a Gemini (o usa el banco local si falla).
4. El juego comienza. Cada letra enviada se procesa en el servidor y se notifica a todos los clientes del grupo.

## Configuración de IA
Para que la IA funcione, se debe configurar una API Key de Google Gemini en `appsettings.json`:
```json
"Gemini": {
  "ApiKey": "TU_API_KEY"
}
```
Si no se proporciona, el sistema usará automáticamente un banco de palabras predefinido.
